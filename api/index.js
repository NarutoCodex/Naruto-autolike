const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

// Model Updates
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    isBanned: { type: Boolean, default: false },
    pendingPayments: [{ amount: Number, utr: String, date: { type: Date, default: Date.now } }],
    messages: [{ sender: String, text: String, date: { type: Date, default: Date.now } }],
    orders: [{
        planName: String, uid: String, price: Number, days: Number, 
        expiryDate: Date, totalDone: { type: Number, default: 0 }
    }]
}));

const Settings = mongoose.model('Settings', new mongoose.Schema({
    p30: { type: Number, default: 100 },
    p60: { type: Number, default: 200 },
    p90: { type: Number, default: 300 },
    p120: { type: Number, default: 400 }
}));

// --- ROUTES ---
app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase(), password: req.body.password });
    if (!user) return res.status(401).json({ success: false, msg: "Wrong ID/Pass" });
    if (user.isBanned) return res.status(403).json({ success: false, msg: "Account BANNED!" });
    res.json({ success: true, user });
});

app.get('/api/get-prices', async (req, res) => {
    let s = await Settings.findOne();
    if(!s) s = await Settings.create({});
    res.json(s);
});

app.post('/api/support/send', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase() });
    user.messages.push({ sender: 'user', text: req.body.text });
    await user.save();
    res.json({ success: true });
});

// --- ADMIN API ---
app.post('/api/admin/users', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const users = await User.find();
    res.json(users);
});

app.post('/api/admin/action', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const { userId, action, amount, planKey, price, text } = req.body;
    
    if (action === 'ban') await User.findByIdAndUpdate(userId, { isBanned: true });
    if (action === 'approve') {
        const u = await User.findById(userId);
        u.balance += parseInt(amount);
        u.pendingPayments = [];
        await u.save();
    }
    if (action === 'setPrice') await Settings.findOneAndUpdate({}, { [planKey]: price });
    if (action === 'reply') {
        const u = await User.findById(userId);
        u.messages.push({ sender: 'admin', text: text });
        await u.save();
    }
    res.json({ success: true });
});

module.exports = app;
