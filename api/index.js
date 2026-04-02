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
    balance: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
    redeemCode: { type: String, default: "" },
    expiryDate: Date,
    totalLikes: { type: Number, default: 0 },
    history: []
}));

app.post('/api/auth/signup', async (req, res) => {
    try {
        const user = new User({ username: req.body.username.toLowerCase(), password: req.body.password });
        await user.save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ success: false, msg: "Username taken!" }); }
});

app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase(), password: req.body.password });
    if (!user) return res.status(401).json({ success: false, msg: "Wrong ID/Pass" });
    res.json({ success: true, user });
});

app.post('/api/add-balance', async (req, res) => {
    await User.findOneAndUpdate({ username: req.body.username.toLowerCase() }, { pendingBalance: req.body.amount, redeemCode: req.body.code, status: "pending_balance" });
    res.json({ success: true });
});

app.post('/api/buy-likes', async (req, res) => {
    const user = await User.findOne({ username: req.body.username.toLowerCase() });
    if (user.balance < req.body.price) return res.json({ success: false, msg: "Low Balance" });
    
    let exp = new Date(); exp.setDate(exp.getDate() + parseInt(req.body.days));
    user.balance -= req.body.price;
    user.status = "active"; user.uid = req.body.uid; user.expiryDate = exp;
    await user.save();
    res.json({ success: true, msg: "Plan Activated!" });
});

app.post('/api/admin/all', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const users = await User.find({ status: "pending_balance" });
    res.json(users);
});

app.post('/api/admin/approve-balance', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No");
    const user = await User.findById(req.body.id);
    user.balance += user.pendingBalance; user.pendingBalance = 0; user.status = "new";
    await user.save();
    res.json({ success: true });
});

module.exports = app;
