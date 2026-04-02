const axios = require('axios');
const mongoose = require('mongoose');

export default async function handler(req, res) {
    await mongoose.connect(process.env.MONGO_URI);
    const User = mongoose.model('User');
    const activeUsers = await User.find({ status: "active", expiry: { $gt: new Date() } });

    for (let user of activeUsers) {
        try {
            await axios.get(`https://pnx-like-rosy.vercel.app/like?uid=${user.uid}&region=${user.region}&key=UDIT`);
            user.logs.push({ date: new Date().toLocaleDateString(), status: "Success" });
            await user.save();
        } catch (e) { console.log("Error API"); }
    }
    res.status(200).send("Done");
}
