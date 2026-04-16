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
    pendingPayments: [{ 
        amount: Number, 
        utr: String, 
        redeem: String, 
        date: { type: Date, default: Date.now } 
    }],
    activePlans: [{
        uid: String,
        planName: String,
        days: Number,
        expiryDate: Date,
        totalLikes: { type: Number, default: 0 }
    }]
}));

// --- AUTH ---
app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase(), password: req.body.password });
    if (!user) return res.status(401).json({ success: false, msg: "Wrong ID/Pass" });
    if (user.isBanned) return res.status(403).json({ success: false, msg: "Account BANNED!" });
    res.json({ success: true, user });
});

app.post('/api/auth/signup', async (req, res) => {
    try {
        const user = new User({ username: req.body.username.toLowerCase(), password: req.body.password });
        await user.save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ success: false, msg: "User exists!" }); }
});

// --- WALLET & PAYMENTS ---
app.post('/api/add-balance', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase() });
    user.pendingPayments.push({ 
        amount: parseInt(req.body.amount) || 0, 
        utr: req.body.utr || "", 
        redeem: req.body.redeem || "" 
    });
    await user.save();
    res.json({ success: true });
});

app.post('/api/buy-plan', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase() });
    if (user.balance < req.body.price) return res.json({ success: false, msg: "Low Balance! Please add money." });
    
    let exp = new Date(); exp.setDate(exp.getDate() + parseInt(req.body.days));
    user.balance -= req.body.price;
    user.activePlans.push({ 
        uid: req.body.uid, 
        planName: req.body.planName, 
        days: req.body.days, 
        expiryDate: exp 
    });
    await user.save();
    res.json({ success: true, msg: "Plan Activated!", user });
});

// --- ADMIN ---
app.post('/api/admin/users', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const users = await User.find();
    res.json(users);
});

app.post('/api/admin/pending', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const users = await User.find({ "pendingPayments.0": { $exists: true } });
    res.json(users);
});

app.post('/api/admin/action', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const user = await User.findById(req.body.id);
    if (req.body.action === 'ban') user.isBanned = true;
    if (req.body.action === 'approve') {
        user.balance += parseInt(req.body.amount);
        user.pendingPayments = user.pendingPayments.filter(p => p.utr !== req.body.utr);
    }
    await user.save();
    res.json({ success: true });
});

module.exports = app;
