const mongoose = require('mongoose');
const axios = require('axios');

// MongoDB Connection (Vercel Env se lega)
const MONGO_URI = process.env.MONGO_URI;

// User Model Define karein (Same as index.js)
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    username: String,
    uid: String,
    status: String,
    totalLikes: { type: Number, default: 0 },
    lastLikeDate: Date
}));

export default async function handler(req, res) {
    // Sirf GET request allow karein
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. Database se connect karein
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(MONGO_URI);
        }

        // 2. Sirf 'active' users ko dhoondhein
        const activeUsers = await User.find({ status: 'active' });

        if (activeUsers.length === 0) {
            return res.status(200).send("No active users found for likes.");
        }

        let successCount = 0;
        let failCount = 0;

        // 3. Loop chala kar sabko 100 likes bhejein
        for (let user of activeUsers) {
            try {
                // YAHAN APNI ACTUAL LIKE API LINK DAALEIN
                const likeApiUrl = `https://your-freefire-api.com/send?uid=${user.uid}&count=100`;
                
                const response = await axios.get(likeApiUrl);

                if (response.status === 200) {
                    // Database update karein
                    user.totalLikes = (user.totalLikes || 0) + 100;
                    user.lastLikeDate = new Date();
                    await user.save();
                    successCount++;
                }
            } catch (err) {
                console.error(`Error sending to ${user.uid}:`, err.message);
                failCount++;
            }
        }

        return res.status(200).json({
            success: true,
            message: `Cron Job Finished. Success: ${successCount}, Failed: ${failCount}`
        });

    } catch (error) {
        console.error("CRON MASTER ERROR:", error);
        return res.status(500).json({ error: error.message });
    }
}
