const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI);

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    email: String,
    uid: String,
    region: String,
    status: { type: String, default: "new" },
    expiry: Date,
    logs: []
});

const User = mongoose.model('User', UserSchema);

// --- AUTH ROUTES ---
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const newUser = new User({ 
            username: username.trim().toLowerCase(), 
            password: password.trim() 
        });
        await newUser.save();
        res.json({ success: true, msg: "Registered! Now please Login." });
    } catch (err) {
        res.status(400).json({ success: false, msg: "Username already exists!" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ 
            username: username.trim().toLowerCase(), 
            password: password.trim() 
        });
        if (!user) return res.status(401).json({ success: false, msg: "Wrong ID or Password!" });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, msg: "Login Error!" });
    }
});

// --- USER ACTION ---
app.post('/api/request-active', async (req, res) => {
    const { username, uid, region, code } = req.body;
    await User.findOneAndUpdate(
        { username: username.toLowerCase() }, 
        { uid, region, status: "pending", logs: [{date: new Date(), msg: code}] }
    );
    res.json({ success: true, msg: "Request sent to Admin!" });
});

// --- ADMIN ROUTES ---
app.post('/api/admin/all', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).json({msg: "Access Denied"});
    const users = await User.find({});
    res.json(users);
});

app.post('/api/admin/approve', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).json({msg: "Access Denied"});
    const { uid, days } = req.body;
    let exp = new Date();
    exp.setDate(exp.getDate() + parseInt(days));
    await User.findOneAndUpdate({ uid }, { status: "active", expiry: exp });
    res.json({ success: true, msg: "User Activated!" });
});

module.exports = app;
