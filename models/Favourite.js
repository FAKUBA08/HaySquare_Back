const mongoose = require('mongoose');

const favouriteSchema = new mongoose.Schema({
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Buyer',
    required: true,
  },
  gigId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gig',
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Favourite', favouriteSchema);
