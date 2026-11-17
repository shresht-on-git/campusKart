const User = require('../models/User');
const Review = require('../models/Review');
const PurchaseRequest = require('../models/PurchaseRequest');

const NEGOTIATION_CRITERIA = [
  { key: 'respectfulness', label: 'Respectfulness' },
  { key: 'communication', label: 'Communication' },
  { key: 'responsiveness', label: 'Responsiveness' }
];

const COMPLETED_BUYER_RATES_SELLER_CRITERIA = [
  { key: 'respectfulness', label: 'Respectfulness' },
  { key: 'communication', label: 'Communication' },
  { key: 'responsiveness', label: 'Responsiveness' },
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'itemAccuracy', label: 'Item accuracy / condition as described' },
  { key: 'smoothHandover', label: 'Smooth handover' }
];

const COMPLETED_SELLER_RATES_BUYER_CRITERIA = [
  { key: 'respectfulness', label: 'Respectfulness' },
  { key: 'communication', label: 'Communication' },
  { key: 'responsiveness', label: 'Responsiveness' },
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'paymentReliability', label: 'Payment reliability' },
  { key: 'smoothHandover', label: 'Smooth handover' }
];

const getApplicableCriteria = (interactionType, revieweeRole) => {
  if (interactionType === 'negotiation') {
    return NEGOTIATION_CRITERIA;
  }
  if (interactionType === 'completed_transaction') {
    if (revieweeRole === 'seller') {
      return COMPLETED_BUYER_RATES_SELLER_CRITERIA;
    }
    return COMPLETED_SELLER_RATES_BUYER_CRITERIA;
  }
  return [];
};

const updateUserReputation = async (userId) => {
  try {
    // 1. Seller reviews & completed transactions
    const sellerReviews = await Review.find({ reviewee: userId, revieweeRole: 'seller' });
    const sellerReviewCount = sellerReviews.length;
    const sellerAvgRating = sellerReviewCount > 0
      ? Math.round((sellerReviews.reduce((sum, r) => sum + r.rating, 0) / sellerReviewCount) * 10) / 10
      : 0;
    const sellerCompletedTransactions = await PurchaseRequest.countDocuments({
      seller: userId,
      status: 'accepted'
    });

    // 2. Buyer reviews & completed transactions
    const buyerReviews = await Review.find({ reviewee: userId, revieweeRole: 'buyer' });
    const buyerReviewCount = buyerReviews.length;
    const buyerAvgRating = buyerReviewCount > 0
      ? Math.round((buyerReviews.reduce((sum, r) => sum + r.rating, 0) / buyerReviewCount) * 10) / 10
      : 0;
    const buyerCompletedTransactions = await PurchaseRequest.countDocuments({
      buyer: userId,
      status: 'accepted'
    });

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        sellerRating: sellerAvgRating,
        sellerReviewCount,
        sellerCompletedTransactions,
        buyerRating: buyerAvgRating,
        buyerReviewCount,
        buyerCompletedTransactions
      },
      { new: true }
    );

    return updatedUser;
  } catch (error) {
    console.error('Error updating user reputation:', error);
    throw error;
  }
};

module.exports = {
  NEGOTIATION_CRITERIA,
  COMPLETED_BUYER_RATES_SELLER_CRITERIA,
  COMPLETED_SELLER_RATES_BUYER_CRITERIA,
  getApplicableCriteria,
  updateUserReputation
};

