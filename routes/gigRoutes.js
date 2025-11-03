const express = require('express');
const multer = require('multer');
const Gig = require('../models/Gig');
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });
const multiUpload = upload.fields([{ name: 'image', maxCount: 1 }]);

// ADD a Gig
router.post('/add', multiUpload, async (req, res) => {
  try {
    const { title, basicPackage, standardPackage, premiumPackage } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const imageFile = req.files?.image?.[0];
    const image = imageFile
      ? {
          data: imageFile.buffer.toString('base64'),
          contentType: imageFile.mimetype,
        }
      : null;

    const newGig = new Gig({
      title,
      image,
      basicPackage: basicPackage ? JSON.parse(basicPackage) : undefined,
      standardPackage: standardPackage ? JSON.parse(standardPackage) : undefined,
      premiumPackage: premiumPackage ? JSON.parse(premiumPackage) : undefined,
    });

    await newGig.save();
    res.status(201).json({ message: 'Gig created successfully', gig: newGig });
  } catch (error) {
    console.error('Error creating gig:', error);
    res.status(500).json({ error: 'Error creating gig', message: error.message });
  }
});

// GET all Gigs
router.get('/', async (req, res) => {
  try {
    const gigs = await Gig.find().sort({ createdAt: -1 });
    res.status(200).json(gigs);
  } catch (error) {
    console.error('Error fetching gigs:', error);
    res.status(500).json({ error: 'Error fetching gigs', message: error.message });
  }
});

// GET Gig by ID
router.get('/:id', async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) return res.status(404).json({ message: 'Gig not found' });
    res.status(200).json(gig);
  } catch (error) {
    console.error('Error fetching gig:', error);
    res.status(500).json({ error: 'Error fetching gig', message: error.message });
  }
});

// UPDATE Gig
router.put('/update/:id', multiUpload, async (req, res) => {
  try {
    const { title, basicPackage, standardPackage, premiumPackage } = req.body;

    const imageFile = req.files?.image?.[0];
    const image = imageFile
      ? {
          data: imageFile.buffer.toString('base64'),
          contentType: imageFile.mimetype,
        }
      : undefined;

    const updatedGig = await Gig.findByIdAndUpdate(
      req.params.id,
      {
        title,
        ...(image && { image }),
        ...(basicPackage && { basicPackage: JSON.parse(basicPackage) }),
        ...(standardPackage && { standardPackage: JSON.parse(standardPackage) }),
        ...(premiumPackage && { premiumPackage: JSON.parse(premiumPackage) }),
      },
      { new: true }
    );

    if (!updatedGig) return res.status(404).json({ message: 'Gig not found' });
    res.status(200).json({ message: 'Gig updated successfully', gig: updatedGig });
  } catch (error) {
    console.error('Error updating gig:', error);
    res.status(500).json({ error: 'Error updating gig', message: error.message });
  }
});

// DELETE Gig
router.delete('/delete/:id', async (req, res) => {
  try {
    const deletedGig = await Gig.findByIdAndDelete(req.params.id);
    if (!deletedGig) return res.status(404).json({ message: 'Gig not found' });
    res.status(200).json({ message: 'Gig deleted successfully' });
  } catch (error) {
    console.error('Error deleting gig:', error);
    res.status(500).json({ error: 'Error deleting gig', message: error.message });
  }
});

// LIKE a Gig
router.post('/like/:id', async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) return res.status(404).json({ message: 'Gig not found' });

    gig.likes += 1;
    await gig.save();
    res.status(200).json({ message: 'Gig liked', likes: gig.likes });
  } catch (error) {
    console.error('Error liking gig:', error);
    res.status(500).json({ error: 'Error liking gig', message: error.message });
  }
});

module.exports = router;
