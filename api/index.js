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
    status: { type: String, default: "new" },
    redeemCode: { type: String, default: "" },
    totalLikes: { type: Number, default: 0 },
    expiryDate: Date,
    history: []
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

app.post('/api/request-active', async (req, res) => {
    const { username, uid, code } = req.body;
    await User.findOneAndUpdate({ username: username.toLowerCase() }, { uid, status: "pending", redeemCode: code });
    res.json({ success: true });
});

// Admin All Users
app.post('/api/admin/all', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const users = await User.find({});
    res.json(users);
});

// Admin Approve
app.post('/api/admin/update-user', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const exp = new Date();
    exp.setDate(exp.getDate() + parseInt(req.body.days || 30));
    await User.findByIdAndUpdate(req.body.id, { status: req.body.status, expiryDate: exp });
    res.json({ success: true });
});

module.exports = app;
