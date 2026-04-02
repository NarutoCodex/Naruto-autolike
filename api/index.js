const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI);

// User Schema
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    uid: { type: String, default: "" },
    status: { type: String, default: "new" },
    redeemCode: { type: String, default: "" },
    totalLikes: { type: Number, default: 0 }
}));

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = new User({ username: username.toLowerCase().trim(), password: password.trim() });
        await user.save();
        res.json({ success: true, msg: "Registered!" });
    } catch (e) { res.status(400).json({ success: false, msg: "User exists!" }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username: username.toLowerCase().trim(), password: password.trim() });
        if (!user) return res.status(401).json({ success: false, msg: "Wrong ID/Pass" });
        res.json({ success: true, user });
    } catch (e) { res.status(500).json({ success: false, msg: "Login Error" }); }
});

// Admin Routes
app.post('/api/admin/all', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("Unauthorized");
    const users = await User.find({});
    res.json(users);
});

app.post('/api/admin/update-user', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("Unauthorized");
    await User.findByIdAndUpdate(req.body.id, { status: req.body.status });
    res.json({ success: true });
});

module.exports = app;
