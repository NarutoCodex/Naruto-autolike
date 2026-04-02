const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios'); 
const app = express();

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI);

// --- MODELS ---
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    uid: { type: String, default: "" },
    status: { type: String, default: "new" }, // new, pending, active
    expiryDate: Date,
    totalLikesSent: { type: Number, default: 0 },
    lastLikeDate: Date,
    redeemCode: String
}));

const Plan = mongoose.model('Plan', new mongoose.Schema({
    days: Number, price: Number, oldPrice: Number, tag: String, totalLikes: Number
}));

// --- ROUTES ---

// 1. Get All Dynamic Plans
app.get('/api/plans', async (req, res) => {
    const plans = await Plan.find({});
    res.json(plans);
});

// 2. Auth: Login & Signup
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = new User({ username: username.trim().toLowerCase(), password: password.trim() });
        await user.save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ success: false, msg: "Username taken!" }); }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username.trim().toLowerCase(), password: password.trim() });
    if (!user) return res.status(401).json({ success: false, msg: "Wrong ID/Pass!" });
    res.json({ success: true, user });
});

// 3. User: Submit Activation Request
app.post('/api/request-active', async (req, res) => {
    const { username, uid, code } = req.body;
    await User.findOneAndUpdate({ username: username.toLowerCase() }, { uid, status: "pending", redeemCode: code });
    res.json({ success: true });
});

// 4. Admin: Plan & User Management
app.post('/api/admin/add-plan', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const newPlan = new Plan(req.body);
    await newPlan.save();
    res.json({ success: true });
});

app.post('/api/admin/approve', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const { uid, days } = req.body;
    let exp = new Date();
    exp.setDate(exp.getDate() + parseInt(days || 30));
    await User.findOneAndUpdate({ uid }, { status: "active", expiryDate: exp });
    res.json({ success: true });
});

app.post('/api/admin/all', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const users = await User.find({});
    res.json(users);
});

// 5. CRON JOB: Daily 5 AM Like Sender
app.get('/api/cron/daily-likes', async (req, res) => {
    const activeUsers = await User.find({ status: "active" });
    for (let u of activeUsers) {
        try {
            // Replace with your actual Like API
            await axios.get(`https://your-api.com/like?uid=${u.uid}`);
            u.totalLikesSent += 100;
            u.lastLikeDate = new Date();
            await u.save();
        } catch (err) { console.log("Failed for " + u.uid); }
    }
    res.send("Daily Likes Task Done!");
});

module.exports = app;
