
const dotenv = require('dotenv');
dotenv.config();
const app = require("./app")
const mongoose = require('mongoose');


mongoose.connect(process.env.MONGO_URI,)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection error: ", err));




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
