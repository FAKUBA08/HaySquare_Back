const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const haysquareRoutes = require("./routes/HaySquare"); 
const hayblogRoutes = require("./routes/HayBlog");
const testimonialRoutes = require("./routes/Testimonial");
const messageRoute = require('./routes/HayCon');
const haySubRoutes = require('./routes/HaySub');
const hayLinksRoutes = require("./routes/HayLinks")
const hayMeetRoutes = require("./routes/HayMeet");
const messageRoutes = require("./routes/HayMes")
const userRoute = require("./routes/User");
const paymentRoute=require("./routes/paymentRoute");
const buyerRoutes = require('./routes/buyerRoutes');
dotenv.config();
const path = require("path");
const app = express();
app.use("/api/users", userRoute);

app.use(express.json()); 
app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
const gigRoutes = require('./routes/gigRoutes');

app.use('/api/gig', gigRoutes)
app.use("/api/haymeet", hayMeetRoutes);
app.use("/api/HaySquare", haysquareRoutes); 
app.use('/api/hayblog/', hayblogRoutes);
app.use("/api/Testimonial", testimonialRoutes);
app.use('/api/HayCon/', messageRoute);
app.use('/api/HaySub/', haySubRoutes);
app.use("/api/HayLinks", hayLinksRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/payments", paymentRoute);
app.use('/api/buyers', buyerRoutes);
app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send("Something went wrong!");
  });
  
  module.exports = app;