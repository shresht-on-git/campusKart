const mongoose = require('mongoose');

const purchaseRequestSchema = new mongoose.Schema({
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    required: true
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "negotiating", "accepted", "rejected", "cancelled"],
    default: "pending"
  },
  sellerMessage: {
    type: String
  },
  pendingSellerDecision: {
    type: Boolean,
    default: false
  },
  buyerEndedNegotiation: {
    type: Boolean,
    default: false
  },
  buyerEndedAt: {
    type: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('PurchaseRequest', purchaseRequestSchema);
