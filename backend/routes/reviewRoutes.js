const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Conversation = require('../models/Conversation');
const PurchaseRequest = require('../models/PurchaseRequest');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { getApplicableCriteria, updateUserReputation } = require('../utils/reputationHelper');

// 1. Submit a review for a closed conversation
// POST /api/reviews
router.post('/', protect, async (req, res) => {
  try {
    const { conversationId, criteria, comment, interactionType: clientInteractionType } = req.body;

    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: 'Valid conversation ID is required' });
    }

    if (!criteria || typeof criteria !== 'object') {
      return res.status(400).json({ message: 'Rating criteria are required' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isBuyer = conversation.buyer.toString() === req.user.id;
    const isSeller = conversation.seller.toString() === req.user.id;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ message: 'Not authorized: You did not participate in this conversation' });
    }

    // Conversation must be ended/closed
    if (conversation.status !== 'closed') {
      return res.status(400).json({ message: 'Conversation is still active. Reviews can only be submitted after negotiation ends.' });
    }

    const purchaseRequest = await PurchaseRequest.findById(conversation.purchaseRequest);
    if (!purchaseRequest) {
      return res.status(404).json({ message: 'Associated purchase request not found' });
    }

    // If awaiting seller decision, reviews cannot be submitted yet
    if (purchaseRequest.pendingSellerDecision) {
      return res.status(400).json({ message: 'Awaiting seller decision. Reviews can only be submitted after seller makes a decision.' });
    }

    // Check if user already reviewed this conversation
    const existingReview = await Review.findOne({
      conversation: conversation._id,
      reviewer: req.user.id
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already submitted a review for this conversation' });
    }

    // Determine reviewee and role
    const revieweeId = isBuyer ? conversation.seller : conversation.buyer;
    const revieweeRole = isBuyer ? 'seller' : 'buyer';

    // The seller's backend-confirmed decision determines the authoritative interaction category:
    // Only seller-confirmed sales (status === 'accepted') receive 'completed_transaction'.
    // All negotiations ending without sale receive 'negotiation'.
    const isDealCompleted = purchaseRequest.status === 'accepted';
    const interactionType = isDealCompleted ? 'completed_transaction' : 'negotiation';

    // Validate all mandatory criteria for this interaction
    const applicableCriteria = getApplicableCriteria(interactionType, revieweeRole);
    const sanitizedCriteria = {};
    let criteriaSum = 0;

    for (const criterion of applicableCriteria) {
      const val = criteria[criterion.key];
      const numVal = Number(val);

      if (!val || isNaN(numVal) || numVal < 1 || numVal > 5) {
        return res.status(400).json({
          message: `Mandatory criterion "${criterion.label}" must be rated between 1 and 5 stars`
        });
      }

      sanitizedCriteria[criterion.key] = Math.round(numVal);
      criteriaSum += Math.round(numVal);
    }

    // Calculate overall review rating as direct average of criteria
    const overallRating = Math.round((criteriaSum / applicableCriteria.length) * 10) / 10;

    // Create review
    const review = await Review.create({
      conversation: conversation._id,
      purchaseRequest: purchaseRequest._id,
      reviewer: req.user.id,
      reviewee: revieweeId,
      revieweeRole,
      interactionType,
      criteria: sanitizedCriteria,
      rating: overallRating,
      comment: typeof comment === 'string' ? comment.trim() : ''
    });

    // Update reviewee's cached reputation
    await updateUserReputation(revieweeId);

    const populatedReview = await Review.findById(review._id)
      .populate('reviewer', 'name hostel')
      .populate('reviewee', 'name hostel');

    res.status(201).json(populatedReview);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already submitted a review for this conversation' });
    }
    res.status(500).json({ message: error.message });
  }
});

// 2. Check review eligibility & status for a conversation
// GET /api/reviews/status/:conversationId
router.get('/status/:conversationId', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: 'Invalid conversation ID' });
    }

    const conversation = await Conversation.findById(conversationId)
      .populate('buyer', 'name hostel email')
      .populate('seller', 'name hostel email');

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isBuyer = conversation.buyer._id.toString() === req.user.id;
    const isSeller = conversation.seller._id.toString() === req.user.id;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ message: 'Not authorized to view review status for this conversation' });
    }

    const purchaseRequest = await PurchaseRequest.findById(conversation.purchaseRequest);
    if (!purchaseRequest) {
      return res.status(404).json({ message: 'Associated purchase request not found' });
    }

    if (purchaseRequest.pendingSellerDecision) {
      return res.json({
        conversationId: conversation._id,
        isClosed: true,
        pendingSellerDecision: true,
        canReview: false,
        hasReviewed: false,
        message: 'Awaiting seller decision on transaction outcome'
      });
    }

    const revieweeUser = isBuyer ? conversation.seller : conversation.buyer;
    const revieweeRole = isBuyer ? 'seller' : 'buyer';

    const isDealCompleted = purchaseRequest.status === 'accepted';
    const interactionType = isDealCompleted ? 'completed_transaction' : 'negotiation';

    const myReview = await Review.findOne({
      conversation: conversation._id,
      reviewer: req.user.id
    });

    const isClosed = conversation.status === 'closed';
    const canReview = isClosed && !myReview && !purchaseRequest.pendingSellerDecision;

    res.json({
      conversationId: conversation._id,
      isClosed,
      canReview,
      hasReviewed: !!myReview,
      myReview,
      interactionType: myReview?.interactionType || interactionType,
      isBuyer,
      isSeller,
      revieweeRole,
      reviewee: {
        _id: revieweeUser._id,
        name: revieweeUser.name,
        hostel: revieweeUser.hostel,
        email: revieweeUser.email
      },
      applicableCriteria: getApplicableCriteria(myReview?.interactionType || interactionType, revieweeRole),
      negotiationCriteria: getApplicableCriteria('negotiation', revieweeRole),
      transactionCriteria: getApplicableCriteria('completed_transaction', revieweeRole)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. Get user reputation summary (collective ratings only — privacy protected)
// GET /api/reviews/user/:userId
router.get('/user/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    let user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Refresh/sync reputation aggregates
    user = await updateUserReputation(userId);

    // Return only collective reputation metrics — no individual review cards or reviewer identities exposed
    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        hostel: user.hostel
      },
      sellerReputation: {
        rating: user.sellerRating || 0,
        reviewCount: user.sellerReviewCount || 0,
        completedTransactions: user.sellerCompletedTransactions || 0
      },
      buyerReputation: {
        rating: user.buyerRating || 0,
        reviewCount: user.buyerReviewCount || 0,
        completedTransactions: user.buyerCompletedTransactions || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

