const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("DB Connected"))
    .catch(err => console.log("DB Error"));

// User Schema (Like Before/After Hata Diya Hai)
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
    status: { type: String, default: "new" },
    redeemCode: { type: String, default: "" },
    activePlans: [{
        type: { type: String }, // "like" or "visit"
        uid: String,
        region: String,
        days: Number,
        expiryDate: Date,
        totalDone: { type: Number, default: 0 }
    }]
}));

// --- AUTH ROUTES ---
app.post('/api/auth/signup', async (req, res) => {
    try {
        const user = new User({ username: req.body.username.toLowerCase(), password: req.body.password });
        await user.save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ success: false, msg: "User already exists!" }); }
});

app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase(), password: req.body.password });
    if (!user) return res.status(401).json({ success: false, msg: "Invalid Credentials" });
    res.json({ success: true, user });
});

// --- WALLET & BUY PLAN ---
app.post('/api/add-balance', async (req, res) => {
    await User.findOneAndUpdate(
        { username: req.body.username.toLowerCase() }, 
        { pendingBalance: req.body.amount, redeemCode: req.body.code, status: "pending_balance" }
    );
    res.json({ success: true });
});

app.post('/api/buy-plan', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.username.toLowerCase() });
        if (user.balance < req.body.price) return res.json({ success: false, msg: "Insufficient Balance!" });

        let exp = new Date();
        exp.setDate(exp.getDate() + parseInt(req.body.days));

        user.balance -= req.body.price;
        user.activePlans.push({
            type: req.body.type, // 'like' or 'visit'
            uid: req.body.uid,
            region: req.body.region,
            days: req.body.days,
            expiryDate: exp,
            totalDone: 0
        });

        await user.save();
        res.json({ success: true, msg: req.body.type.toUpperCase() + " Plan Activated!" });
    } catch (e) { res.status(500).json({ success: false, msg: "Purchase Failed" }); }
});

// --- ADMIN ROUTES ---
app.post('/api/admin/all', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("Unauthorized");
    const users = await User.find({ status: "pending_balance" });
    res.json(users);
});

app.post('/api/admin/approve-balance', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("Unauthorized");
    const user = await User.findById(req.body.id);
    user.balance += user.pendingBalance;
    user.pendingBalance = 0;
    user.status = "new";
    await user.save();
    res.json({ success: true });
});

// --- CRON JOB (DAILY PROCESSOR FOR LIKE & VISIT) ---
app.get('/api/cron/process', async (req, res) => {
    try {
        const users = await User.find({ "activePlans.0": { $exists: true } });
        let successCount = 0;
        const now = new Date();

        for (let user of users) {
            let updated = false;
            for (let plan of user.activePlans) {
                if (new Date(plan.expiryDate) > now) {
                    let apiUrl = "";
                    if (plan.type === 'like') {
                        apiUrl = `https://pnx-like-rosy.vercel.app/like?uid=${plan.uid}&region=${plan.region}&key=UDIT`;
                    } else {
                        apiUrl = `https://star-visit.vercel.app/${plan.region}/${plan.uid}`;
                    }

                    try {
                        const resp = await axios.get(apiUrl);
                        if (resp.status === 200) {
                            plan.totalDone += 100;
                            successCount++;
                            updated = true;
                        }
                    } catch (err) { console.log("API Fetch Error"); }
                }
            }
            if (updated) await user.save();
        }
        res.send(`Successfully processed ${successCount} orders.`);
    } catch (e) { res.status(500).send("Cron Error"); }
});

module.exports = app;
