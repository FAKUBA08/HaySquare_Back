const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const haysquareRoutes = require("./routes/HaySquare"); 
const hayblogRoutes = require("./routes/HayBlog");
const testimonialRoutes = require("./routes/Testimonial");
dotenv.config();

const app = express();

app.use(express.json()); 
app.use(cors());
app.use("/api/HaySquare", haysquareRoutes); 
app.use('/api/hayblog/', hayblogRoutes);
app.use("/api/Testimonial", testimonialRoutes);
app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send("Something went wrong!");
  });
  
  module.exports = app;