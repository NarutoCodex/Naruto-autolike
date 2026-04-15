const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

// Schema Updates
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, lowercase: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    isBanned: { type: Boolean, default: false },
    pendingBalance: { type: Number, default: 0 },
    redeemCode: { type: String, default: "" },
    status: { type: String, default: "active" },
    messages: [{ sender: String, text: String, date: { type: Date, default: Date.now } }],
    activePlans: [{
        type: String, uid: String, price: Number, days: Number, 
        expiryDate: Date, totalDone: { type: Number, default: 0 }
    }]
}));

const Settings = mongoose.model('Settings', new mongoose.Schema({
    p30: { type: Number, default: 100 },
    p60: { type: Number, default: 200 },
    p90: { type: Number, default: 300 },
    p120: { type: Number, default: 400 }
}));

// --- AUTH ---
app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase(), password: req.body.password });
    if (!user) return res.status(401).json({ success: false, msg: "Wrong ID/Pass" });
    if (user.isBanned) return res.status(403).json({ success: false, msg: "Your account is BANNED!" });
    res.json({ success: true, user });
});

// --- SETTINGS (Price Fetch) ---
app.get('/api/settings', async (req, res) => {
    let s = await Settings.findOne();
    if(!s) s = await Settings.create({});
    res.json(s);
});

// --- SUPPORT CHAT ---
app.post('/api/support/send', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase() });
    user.messages.push({ sender: "user", text: req.body.text });
    await user.save();
    res.json({ success: true });
});

// --- ADMIN CONTROL ---
app.post('/api/admin/users', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const users = await User.find();
    res.json(users);
});

app.post('/api/admin/ban', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    await User.findByIdAndUpdate(req.body.id, { isBanned: true });
    res.json({ success: true });
});

app.post('/api/admin/update-price', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    await Settings.findOneAndUpdate({}, { [req.body.plan]: req.body.price });
    res.json({ success: true });
});

app.post('/api/admin/reply', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const user = await User.findById(req.body.id);
    user.messages.push({ sender: "admin", text: req.body.text });
    await user.save();
    res.json({ success: true });
});

module.exports = app;
