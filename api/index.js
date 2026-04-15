const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    isBanned: { type: Boolean, default: false },
    pendingPayments: [{ amount: Number, utr: String, date: { type: Date, default: Date.now } }],
    messages: [{ sender: String, text: String, date: { type: Date, default: Date.now } }],
    activePlans: [{
        type: { type: String },
        uid: String,
        region: String,
        days: Number,
        expiryDate: Date,
        totalDone: { type: Number, default: 0 }
    }]
}));

const Config = mongoose.model('Config', new mongoose.Schema({
    p30: { type: Number, default: 100 }, p60: { type: Number, default: 200 },
    p90: { type: Number, default: 300 }, p120: { type: Number, default: 400 }
}));

// AUTH (No changes)
app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase(), password: req.body.password });
    if (!user) return res.status(401).json({ success: false, msg: "Wrong ID/Pass" });
    if (user.isBanned) return res.status(403).json({ success: false, msg: "BANNED!" });
    res.json({ success: true, user });
});

app.get('/api/prices', async (req, res) => {
    let conf = await Config.findOne(); if(!conf) conf = await Config.create({});
    res.json(conf);
});

// --- ADMIN API ---
app.post('/api/admin/all-users', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No Access");
    const users = await User.find(); res.json(users);
});

app.post('/api/admin/action', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No Access");
    const { userId, action, amount, planKey, price } = req.body;
    if (action === 'ban') await User.findByIdAndUpdate(userId, { isBanned: true });
    if (action === 'approve') {
        const user = await User.findById(userId);
        user.balance += parseInt(amount);
        user.pendingPayments = []; await user.save();
    }
    if (action === 'setPrice') await Config.findOneAndUpdate({}, { [planKey]: price });
    res.json({ success: true });
});

// Chron job logic stays the same...

module.exports = app;
