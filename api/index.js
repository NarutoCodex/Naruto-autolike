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
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    uid: String,
    status: { type: String, default: "new" }, // new, pending, active
    logs: []
}));

// --- API ROUTES ---

// Signup
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = new User({ username: username.trim().toLowerCase(), password: password.trim() });
        await user.save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ success: false, msg: "Name already taken!" }); }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username.trim().toLowerCase(), password: password.trim() });
    if (!user) return res.status(401).json({ success: false, msg: "Wrong ID or Pass!" });
    res.json({ success: true, user });
});

// Request Activation
app.post('/api/request-active', async (req, res) => {
    const { username, uid, code } = req.body;
    await User.findOneAndUpdate(
        { username: username.toLowerCase() }, 
        { uid, status: "pending", logs: [{msg: code}] }
    );
    res.json({ success: true });
});

// Admin All Users
app.post('/api/admin/all', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const users = await User.find({});
    res.json(users);
});

// Admin Approve
app.post('/api/admin/approve', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    await User.findOneAndUpdate({ uid: req.body.uid }, { status: "active" });
    res.json({ success: true, msg: "Approved!" });
});

module.exports = app;
