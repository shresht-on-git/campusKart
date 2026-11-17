const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        return v.endsWith('@thapar.edu');
      },
      message: props => `${props.value} is not a valid Thapar email address!`
    }
  },
  password: {
    type: String,
    required: true,
  },
  hostel: {
    type: String,
    required: true,
    enum: ['A', 'B', 'C', 'D', 'H', 'J']
  },
  role: {
    type: String,
    default: 'student',
    enum: ['student'] // ensuring no admin registration via this schema
  },
  sellerRating: {
    type: Number,
    default: 0
  },
  sellerReviewCount: {
    type: Number,
    default: 0
  },
  sellerCompletedTransactions: {
    type: Number,
    default: 0
  },
  buyerRating: {
    type: Number,
    default: 0
  },
  buyerReviewCount: {
    type: Number,
    default: 0
  },
  buyerCompletedTransactions: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
