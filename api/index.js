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
    balance: { type: Number, default: 0 },
    isBanned: { type: Boolean, default: false },
    status: { type: String, default: "ACT" },
    messages: [{ sender: String, text: String, date: { type: Date, default: Date.now } }],
    pendingPayments: [{ amount: Number, utr: String, status: { type: String, default: "Pending" } }],
    orders: [{ planName: String, uid: String, price: Number, days: Number, expiryDate: Date }]
}));

// Auth Route
app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase(), password: req.body.password });
    if (!user) return res.status(401).json({ success: false, msg: "Invalid Credentials" });
    if (user.isBanned) return res.status(403).json({ success: false, msg: "BANNED!" });
    res.json({ success: true, user });
});

// Admin Stats Logic (As seen in Video)
app.post('/api/admin/stats', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No Access");
    const uniqueUsers = await User.countDocuments();
    const allUsers = await User.find();
    let totalRevenue = 0;
    allUsers.forEach(u => u.orders.forEach(o => totalRevenue += o.price));
    res.json({ uniqueUsers, totalRevenue, users: allUsers });
});

module.exports = app;
