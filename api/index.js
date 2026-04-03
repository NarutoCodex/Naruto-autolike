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
    pendingBalance: { type: Number, default: 0 },
    status: { type: String, default: "new" },
    redeemCode: { type: String, default: "" },
    activePlans: [{
        type: { type: String },
        uid: String,
        region: String,
        days: Number,
        expiryDate: Date,
        totalDone: { type: Number, default: 0 }
    }]
}));

// --- BUY PLAN (FIXED 100%) ---
app.post('/api/buy-plan', async (req, res) => {
    try {
        const { username, type, price, days, uid, region } = req.body;
        const user = await User.findOne({ username: username.toLowerCase() });
        
        if (!user) return res.status(404).json({ success: false, msg: "User not found!" });
        if (user.balance < price) return res.json({ success: false, msg: "Low Balance!" });

        let exp = new Date();
        exp.setDate(exp.getDate() + parseInt(days));

        const newPlan = {
            type: type,
            uid: uid,
            region: region,
            days: parseInt(days),
            expiryDate: exp,
            totalDone: 0
        };

        // Atomic Update: Balance kam karo aur Plan push karo ek saath
        const updatedUser = await User.findOneAndUpdate(
            { username: username.toLowerCase() },
            { 
                $inc: { balance: -price },
                $push: { activePlans: newPlan }
            },
            { new: true, runValidators: true }
        );

        res.json({ success: true, msg: type.toUpperCase() + " Plan Activated!", user: updatedUser });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, msg: "Database Error!" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase(), password: req.body.password });
    if (!user) return res.status(401).json({ success: false, msg: "Wrong ID/Pass" });
    res.json({ success: true, user });
});

app.post('/api/auth/signup', async (req, res) => {
    try {
        const user = new User({ username: req.body.username.toLowerCase(), password: req.body.password });
        await user.save();
        res.json({ success: true });
    } catch (e) { res.json({ success: false, msg: "Already exists!" }); }
});

app.post('/api/add-balance', async (req, res) => {
    await User.findOneAndUpdate({ username: req.body.username.toLowerCase() }, { pendingBalance: req.body.amount, redeemCode: req.body.code, status: "pending_balance" });
    res.json({ success: true });
});

module.exports = app;
