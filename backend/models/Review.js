const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  purchaseRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseRequest',
    required: true
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  revieweeRole: {
    type: String,
    enum: ['buyer', 'seller'],
    required: true
  },
  interactionType: {
    type: String,
    enum: ['negotiation', 'completed_transaction'],
    required: true
  },
  criteria: {
    type: Map,
    of: Number,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true,
    default: ''
  }
}, { timestamps: true });

// Compound unique index: Enforce maximum one review per reviewer per conversation
reviewSchema.index({ conversation: 1, reviewer: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);

