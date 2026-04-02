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
    region: { type: String, default: "" },
    status: { type: String, default: "new" }, // new, pending, active
    redeemCode: { type: String, default: "" },
    totalLikes: { type: Number, default: 0 }
}));

const Plan = mongoose.model('Plan', new mongoose.Schema({
    days: Number, price: Number, oldPrice: Number, tag: String, totalLikes: Number
}));

// Pre-fill Plans (Tujhe add karne ki tension nahi)
const defaultPlans = [
    { days: 28, price: 90, oldPrice: 119, tag: "STARTER", totalLikes: 2800 },
    { days: 60, price: 180, oldPrice: 249, tag: "POPULAR", totalLikes: 6000 },
    { days: 90, price: 250, oldPrice: 350, tag: "BEST VALUE", totalLikes: 9000 },
    { days: 120, price: 320, oldPrice: 450, tag: "ULTIMATE", totalLikes: 12000 }
];

app.get('/api/init-plans', async (req, res) => {
    await Plan.deleteMany({});
    await Plan.insertMany(defaultPlans);
    res.send("Plans Initialized!");
});

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
    if (!user) return res.status(401).json({ success: false, msg: "Invalid Credentials" });
    res.json({ success: true, user });
});

// Request Activation (Buy Button Logic)
app.post('/api/request-activation', async (req, res) => {
    const { username, uid, region, code } = req.body;
    await User.findOneAndUpdate(
        { username: username.toLowerCase() }, 
        { uid, region, redeemCode: code, status: "pending" }
    );
    res.json({ success: true, msg: "Sent to Admin for Approval!" });
});

// Admin Control
app.post('/api/admin/all', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const users = await User.find({});
    res.json(users);
});

app.post('/api/admin/approve-user', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    await User.findByIdAndUpdate(req.body.id, { status: "active" });
    res.json({ success: true });
});

app.get('/api/plans', async (req, res) => {
    const plans = await Plan.find({});
    res.json(plans);
});

module.exports = app;
