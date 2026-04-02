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
    status: { type: String, default: "new" },
    redeemCode: { type: String, default: "" },
    totalLikes: { type: Number, default: 0 },
    history: []
}));

const Plan = mongoose.model('Plan', new mongoose.Schema({
    days: Number, price: Number, oldPrice: Number, tag: String, totalLikes: Number
}));

// Auth
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

// Admin
app.post('/api/admin/all', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const users = await User.find({});
    res.json(users);
});

app.post('/api/admin/update-user', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    await User.findByIdAndUpdate(req.body.id, { status: req.body.status, uid: req.body.uid });
    res.json({ success: true });
});

app.get('/api/plans', async (req, res) => {
    const plans = await Plan.find({});
    res.json(plans);
});

app.post('/api/admin/add-plan', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const plan = new Plan(req.body);
    await plan.save();
    res.json({ success: true });
});

module.exports = app;
