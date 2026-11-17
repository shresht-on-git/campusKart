const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Electronics',
      'Books',
      'Notes',
      'Cycles',
      'Hostel Essentials',
      'Study Materials',
      'Sports',
      'Accessories',
      'Other'
    ],
  },
  condition: {
    type: String,
    required: true,
    enum: ['New', 'Like New', 'Good', 'Fair'],
  },
  images: [{
    type: String,
  }],
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  hostel: {
    type: String,
    required: true,
    enum: ['A', 'B', 'C', 'D', 'H', 'J'],
  },
  status: {
    type: String,
    default: 'available',
    enum: ['available', 'sold'],
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Listing', listingSchema);
