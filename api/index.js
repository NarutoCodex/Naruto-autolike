const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    uid: { type: String, default: "" },
    status: { type: String, default: "new" }, // new, pending, active, rejected
    redeemCode: { type: String, default: "" },
    expiryDate: Date,
    totalLikes: { type: Number, default: 0 }
}));

// SAARE PLANS KI LIST
const PLANS = [
    { days: 28, price: 90, tag: "STARTER" },
    { days: 60, price: 180, tag: "POPULAR" },
    { days: 90, price: 250, tag: "BEST VALUE" },
    { days: 120, price: 320, tag: "ULTIMATE" }
];

app.get('/api/plans', (req, res) => res.json(PLANS));

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
    try {
        const user = new User({ username: req.body.username.toLowerCase().trim(), password: req.body.password });
        await user.save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ success: false, msg: "User exists!" }); }
});

app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase().trim(), password: req.body.password });
    if (!user) return res.status(401).json({ success: false, msg: "Wrong ID/Pass" });
    res.json({ success: true, user });
});

// User Request (Status: Pending)
app.post('/api/request-active', async (req, res) => {
    const { username, uid, code } = req.body;
    await User.findOneAndUpdate({ username: username.toLowerCase() }, { uid, status: "pending", redeemCode: code });
    res.json({ success: true });
});

// Admin: Only show Pending requests
app.post('/api/admin/all', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const users = await User.find({ status: "pending" }); 
    res.json(users);
});

// Admin: Update Status & Set Expiry
app.post('/api/admin/update-status', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const { id, status, days } = req.body;
    let update = { status: status };
    if (status === 'active') {
        let exp = new Date();
        exp.setDate(exp.getDate() + parseInt(days || 30));
        update.expiryDate = exp;
    }
    await User.findByIdAndUpdate(id, update);
    res.json({ success: true });
});

module.exports = app;
