const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios'); // API call ke liye zaroori hai
const app = express();

app.use(cors());
app.use(express.json());

// MongoDB Connection (Vercel Environment Variables se lega)
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("DB Connected"))
    .catch(err => console.log("DB Error: ", err));

// --- USER SCHEMA ---
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    uid: { type: String, default: "" },
    status: { type: String, default: "new" }, // new, pending, active, rejected
    redeemCode: { type: String, default: "" },
    expiryDate: Date,
    totalLikes: { type: Number, default: 0 },
    history: [{
        date: String,
        before: Number,
        after: Number,
        added: Number
    }]
}));

// --- AUTH ROUTES ---
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = new User({ username: username.toLowerCase().trim(), password: password.trim() });
        await user.save();
        res.json({ success: true, msg: "Registered!" });
    } catch (e) { res.status(400).json({ success: false, msg: "User already exists!" }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username: username.toLowerCase().trim(), password: password.trim() });
        if (!user) return res.status(401).json({ success: false, msg: "Invalid Credentials" });
        res.json({ success: true, user });
    } catch (e) { res.status(500).json({ success: false, msg: "Login Failed" }); }
});

// --- USER REQUEST (STATUS: PENDING) ---
app.post('/api/request-active', async (req, res) => {
    try {
        const { username, uid, code } = req.body;
        await User.findOneAndUpdate(
            { username: username.toLowerCase() }, 
            { uid, status: "pending", redeemCode: code }
        );
        res.json({ success: true });
    } catch (e) { res.status(500).send("Error"); }
});

// --- ADMIN ROUTES ---
app.post('/api/admin/all', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No Access");
    const users = await User.find({ status: "pending" }); 
    res.json(users);
});

app.post('/api/admin/update-status', async (req, res) => {
    if (req.body.adminKey !== process.env.ADMIN_KEY) return res.status(403).send("No Access");
    const { id, status, days } = req.body;
    let update = { status: status };
    
    if (status === 'active') {
        let exp = new Date();
        exp.setDate(exp.getDate() + parseInt(days || 30));
        update.expiryDate = exp;
    }
    
    await User.findByIdAndUpdate(id, update);
    res.json({ success: true });
});

// --- PLANS ROUTE ---
app.get('/api/plans', (req, res) => {
    const plans = [
        { days: 28, price: 90, tag: "STARTER" },
        { days: 60, price: 180, tag: "POPULAR" },
        { days: 90, price: 250, tag: "BEST VALUE" },
        { days: 120, price: 320, tag: "ULTIMATE" }
    ];
    res.json(plans);
});

// --- DAILY AUTO-LIKE CRON JOB (USING YOUR API) ---
app.get('/api/cron/send-likes', async (req, res) => {
    try {
        const activeUsers = await User.find({ status: "active" });
        if (activeUsers.length === 0) return res.send("No active users.");

        let successCount = 0;
        for (let user of activeUsers) {
            try {
                // TUMHARI WORKING API LINK
                const apiUrl = `https://pnx-like-rosy.vercel.app/like?uid=${user.uid}&region=ind&key=UDIT`;
                
                const response = await axios.get(apiUrl);

                if (response.status === 200) {
                    const now = new Date().toLocaleString("en-IN", {timeZone: "Asia/Kolkata"});
                    const before = user.totalLikes || 0;
                    const added = 100; // API jitne likes deti hai
                    
                    // History update aur Total Likes increment
                    await User.updateOne(
                        { _id: user._id },
                        { 
                            $inc: { totalLikes: added },
                            $push: { 
                                history: {
                                    date: now,
                                    before: before,
                                    after: before + added,
                                    added: added
                                } 
                            }
                        }
                    );
                    successCount++;
                }
            } catch (err) {
                console.log(`API Error for UID: ${user.uid}`);
            }
        }
        res.send(`Done! Sent likes to ${successCount} users.`);
    } catch (e) {
        res.status(500).send("Cron Error: " + e.message);
    }
});

module.exports = app;
