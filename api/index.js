const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    uid: { type: String, default: "" },
    status: { type: String, default: "new" },
    balance: { type: Number, default: 0 }, // User ka paisa
    pendingBalance: { type: Number, default: 0 }, // Approve hone wala paisa
    redeemCode: { type: String, default: "" },
    expiryDate: Date,
    totalLikes: { type: Number, default: 0 },
    history: []
}));

// --- ADD BALANCE REQUEST ---
app.post('/api/add-balance', async (req, res) => {
    const { username, amount, code } = req.body;
    await User.findOneAndUpdate(
        { username: username.toLowerCase() },
        { pendingBalance: amount, redeemCode: code, status: "pending_balance" }
    );
    res.json({ success: true });
});

// --- BUY LIKES USING BALANCE ---
app.post('/api/buy-likes', async (req, res) => {
    const { username, price, days, uid } = req.body;
    const user = await User.findOne({ username: username.toLowerCase() });
    
    if (user.balance < price) {
        return res.json({ success: false, msg: "Insufficient Balance! Please add balance first." });
    }

    let exp = new Date();
    exp.setDate(exp.getDate() + parseInt(days));

    user.balance -= price;
    user.status = "active";
    user.uid = uid;
    user.expiryDate = exp;
    await user.save();

    res.json({ success: true, msg: "Plan Activated Successfully!" });
});

// --- ADMIN: GET ALL REQUESTS ---
app.post('/api/admin/all', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const users = await User.find({ $or: [{ status: "pending_balance" }, { status: "pending" }] });
    res.json(users);
});

// --- ADMIN: APPROVE BALANCE ---
app.post('/api/admin/approve-balance', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const user = await User.findById(req.body.id);
    user.balance += user.pendingBalance;
    user.pendingBalance = 0;
    user.status = "new"; // Balance add hone ke baad status normal
    user.redeemCode = "";
    await user.save();
    res.json({ success: true });
});

// Auth aur baki routes pehle jaise...
app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase(), password: req.body.password });
    if (!user) return res.status(401).json({ success: false, msg: "Wrong ID/Pass" });
    res.json({ success: true, user });
});

module.exports = app;
