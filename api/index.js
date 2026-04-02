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
  .catch(err => console.log("DB Error: ", err));

// Models
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    uid: { type: String, default: "" },
    status: { type: String, default: "new" }, // new, pending, active, rejected
    redeemCode: { type: String, default: "" },
    expiry: Date,
    totalLikes: { type: Number, default: 0 }
}));

const Plan = mongoose.model('Plan', new mongoose.Schema({
    days: Number, price: Number, oldPrice: Number, tag: String, totalLikes: Number
}));

// --- AUTH SYSTEM ---
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const u = username.toLowerCase().trim();
        const exists = await User.findOne({ username: u });
        if (exists) return res.status(400).json({ success: false, msg: "User already exists!" });

        const user = new User({ username: u, password: password.trim() });
        await user.save();
        res.json({ success: true, msg: "Registered! Please Login." });
    } catch (e) { res.status(500).json({ success: false, msg: "Signup Failed" }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username: username.toLowerCase().trim(), password: password.trim() });
        if (!user) return res.status(401).json({ success: false, msg: "Invalid ID or Password!" });
        res.json({ success: true, user });
    } catch (e) { res.status(500).json({ success: false, msg: "Login Failed" }); }
});

// --- ADMIN SYSTEM ---
app.post('/api/admin/all', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).json({msg: "Wrong Key"});
    const users = await User.find({});
    res.json(users);
});

app.post('/api/admin/update-user', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const { id, status, days } = req.body;
    let update = { status };
    if (status === 'active' && days) {
        let exp = new Date();
        exp.setDate(exp.getDate() + parseInt(days));
        update.expiry = exp;
    }
    await User.findByIdAndUpdate(id, update);
    res.json({ success: true });
});

app.post('/api/admin/add-plan', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const plan = new Plan(req.body);
    await plan.save();
    res.json({ success: true });
});

// --- PUBLIC DATA ---
app.get('/api/plans', async (req, res) => {
    const plans = await Plan.find({});
    res.json(plans);
});

app.post('/api/request-active', async (req, res) => {
    const { username, uid, code } = req.body;
    await User.findOneAndUpdate({ username: username.toLowerCase() }, { uid, status: "pending", redeemCode: code });
    res.json({ success: true });
});

// --- CRON JOB ---
app.get('/api/cron/daily-likes', async (req, res) => {
    const activeUsers = await User.find({ status: "active" });
    for (let u of activeUsers) {
        try {
            await axios.get(`https://your-api.com/send?uid=${u.uid}`); // Add your Like API link
            u.totalLikes += 100;
            await u.save();
        } catch (err) { console.log("Failed for " + u.uid); }
    }
    res.send("Done");
});

module.exports = app;
