const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../authMiddleWare');
const Favourite = require('../models/Favourite');

// Add favourite
router.post('/', authenticateToken, async (req, res) => {
  try {
    const buyerId = req.user.id;
    const { gigId } = req.body;
    const existing = await Favourite.findOne({ buyerId, gigId });
    if (existing) return res.status(200).json(existing);

    const favourite = await Favourite.create({ buyerId, gigId });
    res.status(201).json(favourite);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.get('/count/:gigId', async (req, res) => {
  try {
    const { gigId } = req.params;
    const count = await Favourite.countDocuments({ gigId });
    res.status(200).json({ gigId, count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
// Get all favourites for logged-in buyer
router.get('/', authenticateToken, async (req, res) => {
  try {
    const buyerId = req.user.id;
    const favourites = await Favourite.find({ buyerId }).populate('gigId');
    res.status(200).json(favourites);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove favourite
router.delete('/:gigId', authenticateToken, async (req, res) => {
  try {
    const buyerId = req.user.id;
    const { gigId } = req.params;
    await Favourite.findOneAndDelete({ buyerId, gigId });
    res.status(200).json({ message: 'Removed from favourites' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Count favourites for logged-in buyer
router.get('/count', authenticateToken, async (req, res) => {
  try {
    const buyerId = req.user.id;
    const count = await Favourite.countDocuments({ buyerId });
    res.status(200).json({ buyerId, count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Count likes for a specific gig


module.exports = router;
