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

// BUY PLAN FIX
app.post('/api/buy-plan', async (req, res) => {
    try {
        const { username, type, price, days, uid, region } = req.body;
        const user = await User.findOne({ username: username.toLowerCase() });
        
        if (!user) return res.json({ success: false, msg: "User not found!" });
        if (user.balance < price) return res.json({ success: false, msg: "Low Balance!" });

        let exp = new Date();
        exp.setDate(exp.getDate() + parseInt(days));

        const newPlan = {
            type,
            uid,
            region,
            days: parseInt(days),
            expiryDate: exp,
            totalDone: 0
        };

        await User.findOneAndUpdate(
            { username: username.toLowerCase() },
            { 
                $inc: { balance: -price },
                $push: { activePlans: newPlan }
            }
        );

        res.json({ success: true, msg: type.toUpperCase() + " Plan Activated!" });
    } catch (e) {
        res.json({ success: false, msg: "Server Error!" });
    }
});

// AUTH LOGIN FIX (Data Fetch)
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
    } catch (e) { res.json({ success: false, msg: "Exists!" }); }
});

app.post('/api/add-balance', async (req, res) => {
    await User.findOneAndUpdate({ username: req.body.username.toLowerCase() }, { pendingBalance: req.body.amount, redeemCode: req.body.code, status: "pending_balance" });
    res.json({ success: true });
});

// CRON JOB
app.get('/api/cron/process', async (req, res) => {
    const users = await User.find({ "activePlans.0": { $exists: true } });
    for (let user of users) {
        for (let plan of user.activePlans) {
            if (new Date(plan.expiryDate) > new Date()) {
                let url = plan.type === 'like' ? `https://pnx-like-rosy.vercel.app/like?uid=${plan.uid}&region=${plan.region}&key=UDIT` : `https://star-visit.vercel.app/${plan.region}/${plan.uid}`;
                try { await axios.get(url); plan.totalDone += 100; } catch (e) {}
            }
        }
        await user.save();
    }
    res.send("Done");
});

module.exports = app;
