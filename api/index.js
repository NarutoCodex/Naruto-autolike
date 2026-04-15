const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

// Professional Schema
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    isBanned: { type: Boolean, default: false },
    pendingPayments: [{ amount: Number, utr: String, date: { type: Date, default: Date.now } }],
    orders: [{
        planName: String, uid: String, price: Number, days: Number, 
        expiryDate: Date, dailyLikes: { type: Number, default: 100 }
    }]
}));

// --- AUTH ---
app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase(), password: req.body.password });
    if (!user) return res.status(401).json({ success: false, msg: "Wrong ID/Pass" });
    if (user.isBanned) return res.status(403).json({ success: false, msg: "BANNED!" });
    res.json({ success: true, user });
});

// --- WALLET ---
app.post('/api/add-balance', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase() });
    if(!user) return res.json({ success: false, msg: "User not found!" });
    user.pendingPayments.push({ amount: parseInt(req.body.amount), utr: req.body.code });
    await user.save();
    res.json({ success: true });
});

// --- ADMIN PANEL API ---
app.post('/api/admin/users', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No Access");
    const users = await User.find();
    res.json(users);
});

app.post('/api/admin/pending-payments', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No Access");
    const users = await User.find({ "pendingPayments.0": { $exists: true } });
    let payments = [];
    users.forEach(u => {
        u.pendingPayments.forEach(p => {
            payments.push({ userId: u._id, username: u.username, ...p._doc });
        });
    });
    res.json(payments);
});

app.post('/api/admin/action', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No Access");
    const { userId, action, amount, utr } = req.body;
    const u = await User.findById(userId);
    if (action === 'ban') u.isBanned = true;
    if (action === 'accept') {
        u.balance += parseInt(amount);
        u.pendingPayments = u.pendingPayments.filter(p => p.utr !== utr);
    }
    if (action === 'reject') {
        u.pendingPayments = u.pendingPayments.filter(p => p.utr !== utr);
    }
    await u.save();
    res.json({ success: true });
});

module.exports = app;
