const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PurchaseRequest = require('../models/PurchaseRequest');
const Listing = require('../models/Listing');
const Conversation = require('../models/Conversation');
const Review = require('../models/Review');
const User = require('../models/User');
const { updateUserReputation } = require('../utils/reputationHelper');
const { protect } = require('../middleware/authMiddleware');

// 1. Check if user has an active request for this listing
// GET /api/purchases/check/:listingId
router.get('/check/:listingId', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.listingId)) {
      return res.status(400).json({ message: 'Invalid listing ID' });
    }

    // Check for active requests first (pending or negotiating)
    const activeRequest = await PurchaseRequest.findOne({
      listing: req.params.listingId,
      buyer: req.user.id,
      status: { $in: ['pending', 'negotiating'] }
    }).sort({ createdAt: -1 });

    if (activeRequest) {
      let conversationId = null;
      if (activeRequest.status === 'negotiating') {
        const conv = await Conversation.findOne({ purchaseRequest: activeRequest._id });
        if (conv) conversationId = conv._id;
      }
      return res.json({
        exists: true,
        status: activeRequest.status,
        requestId: activeRequest._id,
        conversationId
      });
    }

    // Check for any historical request
    const anyRequest = await PurchaseRequest.findOne({
      listing: req.params.listingId,
      buyer: req.user.id
    }).sort({ createdAt: -1 });

    if (anyRequest) {
      let conversationId = null;
      const conv = await Conversation.findOne({ purchaseRequest: anyRequest._id });
      if (conv) conversationId = conv._id;

      return res.json({
        exists: true,
        status: anyRequest.status,
        requestId: anyRequest._id,
        conversationId
      });
    }

    res.json({ exists: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Create purchase request
// POST /api/purchases/:listingId
router.post('/:listingId', protect, async (req, res) => {
  try {
    const listingId = req.params.listingId;
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ message: 'Invalid listing ID' });
    }
    const buyerId = req.user.id;

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    if (listing.isDeleted || listing.status !== 'available') {
      return res.status(400).json({ message: 'Listing is no longer available' });
    }

    if (listing.seller.toString() === buyerId) {
      return res.status(400).json({ message: 'You cannot request your own listing' });
    }

    const existingRequest = await PurchaseRequest.findOne({
      listing: listingId,
      buyer: buyerId,
      status: { $in: ['pending', 'negotiating'] }
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'You already have an active request for this listing' });
    }

    // Block new purchase requests while a seller decision is pending for this listing
    const pendingDecision = await PurchaseRequest.findOne({
      listing: listingId,
      pendingSellerDecision: true
    });
    if (pendingDecision) {
      return res.status(400).json({ message: 'This listing is temporarily unavailable pending seller decision.' });
    }

    const newRequest = await PurchaseRequest.create({
      listing: listingId,
      buyer: buyerId,
      seller: listing.seller
    });

    res.status(201).json(newRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. Get buyer's purchase requests
// GET /api/purchases/my
router.get('/my', protect, async (req, res) => {
  try {
    const requests = await PurchaseRequest.find({ buyer: req.user.id })
      .populate('listing', 'title price images status')
      .populate('seller', 'name hostel sellerRating sellerReviewCount sellerCompletedTransactions')
      .sort({ createdAt: -1 });

    const requestIds = requests.map(r => r._id);
    const conversations = await Conversation.find({ purchaseRequest: { $in: requestIds } });
    const convMap = {};
    const closedConvIds = [];

    conversations.forEach(c => {
      convMap[c.purchaseRequest.toString()] = c._id;
      if (c.status === 'closed') {
        closedConvIds.push(c._id);
      }
    });

    // Find reviews submitted by this buyer for these closed conversations
    const userReviews = await Review.find({
      conversation: { $in: closedConvIds },
      reviewer: req.user.id
    });
    const reviewedConvMap = {};
    userReviews.forEach(rev => {
      reviewedConvMap[rev.conversation.toString()] = rev;
    });

    const requestsWithConv = requests.map(r => {
      const obj = r.toObject();
      const convId = convMap[r._id.toString()] || null;
      obj.conversationId = convId;

      if (convId && closedConvIds.some(id => id.toString() === convId.toString())) {
        if (reviewedConvMap[convId.toString()]) {
          obj.reviewStatus = 'submitted';
          obj.myReview = reviewedConvMap[convId.toString()];
        } else if (r.pendingSellerDecision) {
          obj.reviewStatus = null;
        } else {
          obj.reviewStatus = 'pending';
        }
      } else {
        obj.reviewStatus = null;
      }
      return obj;
    });

    res.json(requestsWithConv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 4. Get seller's incoming requests
// GET /api/purchases/seller
router.get('/seller', protect, async (req, res) => {
  try {
    const requests = await PurchaseRequest.find({ seller: req.user.id })
      .populate('listing', 'title price images status')
      .populate('buyer', 'name email hostel buyerRating buyerReviewCount buyerCompletedTransactions')
      .sort({ createdAt: -1 });

    const requestIds = requests.map(r => r._id);
    const conversations = await Conversation.find({ purchaseRequest: { $in: requestIds } });
    const convMap = {};
    const closedConvIds = [];

    conversations.forEach(c => {
      convMap[c.purchaseRequest.toString()] = c._id;
      if (c.status === 'closed') {
        closedConvIds.push(c._id);
      }
    });

    // Find reviews submitted by this seller for these closed conversations
    const userReviews = await Review.find({
      conversation: { $in: closedConvIds },
      reviewer: req.user.id
    });
    const reviewedConvMap = {};
    userReviews.forEach(rev => {
      reviewedConvMap[rev.conversation.toString()] = rev;
    });

    const requestsWithConv = requests.map(r => {
      const obj = r.toObject();
      const convId = convMap[r._id.toString()] || null;
      obj.conversationId = convId;

      if (convId && closedConvIds.some(id => id.toString() === convId.toString())) {
        if (reviewedConvMap[convId.toString()]) {
          obj.reviewStatus = 'submitted';
          obj.myReview = reviewedConvMap[convId.toString()];
        } else if (r.pendingSellerDecision) {
          obj.reviewStatus = null;
        } else {
          obj.reviewStatus = 'pending';
        }
      } else {
        obj.reviewStatus = null;
      }
      return obj;
    });

    // Sorting:
    // Default: highest buyer rating first, tie-breaker newest request first
    // Option: newest requests first (?sortBy=newest)
    const { sortBy } = req.query;
    const sortMode = sortBy === 'newest' ? 'newest' : 'rating';

    requestsWithConv.sort((a, b) => {
      if (sortMode === 'newest') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      // Highest buyer rating first
      // Unrated buyers placed below rated buyers
      const aRated = (a.buyer?.buyerReviewCount || 0) > 0;
      const bRated = (b.buyer?.buyerReviewCount || 0) > 0;
      if (aRated && !bRated) return -1;
      if (!aRated && bRated) return 1;
      if (aRated && bRated) {
        const diff = (b.buyer?.buyerRating || 0) - (a.buyer?.buyerRating || 0);
        if (Math.abs(diff) > 0.0001) return diff;
      }
      // Tie-breaker: newest request first
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(requestsWithConv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 5. Accept & Chat — changes status to 'negotiating' and creates/returns conversation
// PUT /api/purchases/:id/accept
router.put('/:id/accept', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }
    const request = await PurchaseRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to accept this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending requests can be accepted for negotiation' });
    }

    const listing = await Listing.findById(request.listing);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    if (listing.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized: You do not own this listing' });
    }

    if (listing.isDeleted || listing.status !== 'available') {
      return res.status(400).json({ message: 'Listing is no longer available' });
    }

    // Change to negotiating — NOT accepted
    request.status = 'negotiating';
    await request.save();

    // Create or retrieve conversation (prevent duplicate)
    let conversation = await Conversation.findOne({ purchaseRequest: request._id });
    if (!conversation) {
      conversation = await Conversation.create({
        purchaseRequest: request._id,
        listing: request.listing,
        buyer: request.buyer,
        seller: request.seller
      });
    }

    // Listing remains available — do NOT mark as sold
    // Other requests remain unchanged

    const populatedRequest = await PurchaseRequest.findById(request._id)
      .populate('listing', 'title price images status')
      .populate('buyer', 'name email hostel');

    const responseData = populatedRequest.toObject();
    responseData.conversationId = conversation._id;

    res.json({ request: responseData, conversation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 6. Reject purchase request
// PUT /api/purchases/:id/reject
router.put('/:id/reject', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }
    const request = await PurchaseRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to reject this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending requests can be rejected' });
    }

    request.status = 'rejected';
    await request.save();

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 7. End Negotiation — seller ends an active negotiation
// PUT /api/purchases/:id/end-negotiation
router.put('/:id/end-negotiation', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }
    const request = await PurchaseRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to end this negotiation' });
    }

    if (request.status !== 'negotiating') {
      return res.status(400).json({ message: 'Only negotiating requests can have their negotiation ended' });
    }

    request.status = 'rejected';
    request.pendingSellerDecision = false;
    await request.save();

    // Close the conversation
    const conversation = await Conversation.findOneAndUpdate(
      { purchaseRequest: request._id },
      { status: 'closed', closedReason: 'Seller ended negotiation' },
      { new: true }
    );

    // Emit socket event
    const io = req.app.get('io');
    if (io && conversation) {
      io.to(`conversation:${conversation._id}`).emit('conversation-closed', {
        conversationId: conversation._id,
        reason: 'Seller ended negotiation'
      });
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 7b. Buyer End Negotiation — buyer ends their own active negotiation
// PUT /api/purchases/:id/buyer-end-negotiation
router.put('/:id/buyer-end-negotiation', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }
    const request = await PurchaseRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Only the buyer associated with that request can end it (sellers and other users blocked)
    if (request.buyer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized: Only the buyer can end this negotiation' });
    }

    // Only requests currently in negotiating status can use this action
    if (request.status !== 'negotiating') {
      return res.status(400).json({ message: 'Only negotiating requests can be ended by the buyer' });
    }

    if (request.pendingSellerDecision) {
      return res.status(400).json({ message: 'Seller decision is already pending for this negotiation' });
    }

    // Record buyer ended negotiation & set pending seller decision
    request.buyerEndedNegotiation = true;
    request.pendingSellerDecision = true;
    request.buyerEndedAt = new Date();
    await request.save();

    // Make conversation read-only for new messages
    const conversation = await Conversation.findOneAndUpdate(
      { purchaseRequest: request._id },
      { status: 'closed', closedReason: 'Buyer ended negotiation - awaiting seller decision' },
      { new: true }
    );

    const buyerUser = await User.findById(request.buyer).select('name');
    const listing = await Listing.findById(request.listing).select('title');

    // Notify seller immediately via Socket.IO
    const io = req.app.get('io');
    if (io && conversation) {
      // Emit to conversation room (so if seller is in chat, popup appears immediately)
      io.to(`conversation:${conversation._id}`).emit('buyer-ended-negotiation', {
        conversationId: conversation._id,
        requestId: request._id,
        buyerName: buyerUser?.name || 'Buyer',
        listingTitle: listing?.title || 'Listing'
      });
      io.to(`conversation:${conversation._id}`).emit('conversation-closed', {
        conversationId: conversation._id,
        reason: 'Buyer ended negotiation - awaiting seller decision'
      });

      // Emit to seller's direct user room
      io.to(`user:${request.seller.toString()}`).emit('seller-decision-needed', {
        conversationId: conversation._id,
        requestId: request._id,
        buyerName: buyerUser?.name || 'Buyer',
        listingTitle: listing?.title || 'Listing'
      });
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 7c. Seller Decision — seller decides whether transaction took place after buyer ends negotiation
// PUT /api/purchases/:id/seller-decision
router.put('/:id/seller-decision', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }
    const request = await PurchaseRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized: You are not the seller of this listing' });
    }

    if (!request.pendingSellerDecision) {
      return res.status(400).json({ message: 'No seller decision is pending for this request' });
    }

    const { decision, sellerMessage } = req.body;
    if (!['confirm_sale', 'no_sale'].includes(decision)) {
      return res.status(400).json({ message: 'Valid decision ("confirm_sale" or "no_sale") is required' });
    }

    const io = req.app.get('io');

    if (decision === 'confirm_sale') {
      // Case 4: Seller confirms sale
      // Atomic guard: only mark listing sold if it's still available
      const listing = await Listing.findOneAndUpdate(
        { _id: request.listing, status: 'available', isDeleted: { $ne: true } },
        { status: 'sold' },
        { new: true }
      );

      if (!listing) {
        return res.status(409).json({ message: 'Listing is no longer available. Another sale may have been confirmed.' });
      }

      request.status = 'accepted';
      request.pendingSellerDecision = false;
      await request.save();

      // Cancel all other pending and negotiating requests for this listing
      const otherRequests = await PurchaseRequest.find({
        listing: request.listing,
        _id: { $ne: request._id },
        status: { $in: ['pending', 'negotiating'] }
      });

      for (const otherReq of otherRequests) {
        otherReq.status = 'cancelled';
        otherReq.pendingSellerDecision = false;
        if (sellerMessage && sellerMessage.trim()) {
          otherReq.sellerMessage = sellerMessage.trim();
        }
        await otherReq.save();

        const conv = await Conversation.findOneAndUpdate(
          { purchaseRequest: otherReq._id },
          { status: 'closed', closedReason: 'Listing sold to another buyer' },
          { new: true }
        );

        if (io && conv) {
          io.to(`conversation:${conv._id}`).emit('conversation-closed', {
            conversationId: conv._id,
            reason: 'Listing sold to another buyer',
            sellerMessage: sellerMessage?.trim() || undefined
          });
        }
      }

      // Finalize winning conversation
      const winningConv = await Conversation.findOneAndUpdate(
        { purchaseRequest: request._id },
        { status: 'closed', closedReason: 'Sale finalized' },
        { new: true }
      );

      if (io && winningConv) {
        io.to(`conversation:${winningConv._id}`).emit('sale-confirmed', {
          conversationId: winningConv._id,
          message: 'Sale has been finalized!'
        });
      }

      // Update reputation
      await updateUserReputation(request.seller);
      await updateUserReputation(request.buyer);

      return res.json({ message: 'Sale confirmed successfully', request, decision: 'confirm_sale' });
    } else {
      // Case 3: Seller chooses No Sale ("No, Transaction Not Completed")
      request.status = 'rejected';
      request.pendingSellerDecision = false;
      await request.save();

      const conversation = await Conversation.findOneAndUpdate(
        { purchaseRequest: request._id },
        { status: 'closed', closedReason: 'Negotiation ended - No transaction' },
        { new: true }
      );

      if (io && conversation) {
        io.to(`conversation:${conversation._id}`).emit('conversation-closed', {
          conversationId: conversation._id,
          reason: 'Negotiation ended - No transaction',
          decision: 'no_sale'
        });
        io.to(`conversation:${conversation._id}`).emit('seller-decision-resolved', {
          conversationId: conversation._id,
          decision: 'no_sale'
        });
      }

      return res.json({ message: 'Transaction recorded as not completed', request, decision: 'no_sale' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 8. Cancel purchase request (buyer cancels their own pending or negotiating request)
// PUT /api/purchases/:id/cancel
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }
    const request = await PurchaseRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.buyer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to cancel this request' });
    }

    if (!['pending', 'negotiating'].includes(request.status)) {
      return res.status(400).json({ message: 'Only pending or negotiating requests can be cancelled' });
    }

    const wasNegotiating = request.status === 'negotiating';
    request.status = 'cancelled';
    await request.save();

    if (wasNegotiating) {
      const conversation = await Conversation.findOneAndUpdate(
        { purchaseRequest: request._id },
        { status: 'closed', closedReason: 'Buyer ended negotiation' },
        { new: true }
      );

      const io = req.app.get('io');
      if (io && conversation) {
        io.to(`conversation:${conversation._id}`).emit('conversation-closed', {
          conversationId: conversation._id,
          reason: 'Buyer ended negotiation'
        });
      }
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 9. Confirm Sale — finalize the sale with a specific buyer
// PUT /api/purchases/:id/confirm-sale
router.put('/:id/confirm-sale', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }
    const request = await PurchaseRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to confirm this sale' });
    }

    if (request.status !== 'negotiating') {
      return res.status(400).json({ message: 'Only negotiating requests can be confirmed as a sale' });
    }

    // Atomic guard: only mark listing sold if it's still available
    const listing = await Listing.findOneAndUpdate(
      { _id: request.listing, status: 'available', isDeleted: { $ne: true } },
      { status: 'sold' },
      { new: true }
    );

    if (!listing) {
      return res.status(409).json({ message: 'Listing is no longer available. Another sale may have been confirmed.' });
    }

    // Mark this request as accepted
    request.status = 'accepted';
    request.pendingSellerDecision = false;
    await request.save();

    // Prepare seller message for cancelled buyers
    const sellerMessage = req.body.sellerMessage?.trim() || null;

    // Cancel all other pending and negotiating requests for this listing
    const otherRequests = await PurchaseRequest.find({
      listing: request.listing,
      _id: { $ne: request._id },
      status: { $in: ['pending', 'negotiating'] }
    });

    const io = req.app.get('io');

    for (const otherReq of otherRequests) {
      otherReq.status = 'cancelled';
      otherReq.pendingSellerDecision = false;
      if (sellerMessage) {
        otherReq.sellerMessage = sellerMessage;
      }
      await otherReq.save();

      // Close associated conversations
      const conv = await Conversation.findOneAndUpdate(
        { purchaseRequest: otherReq._id },
        { status: 'closed', closedReason: 'Listing sold to another buyer' },
        { new: true }
      );

      // Emit socket event to notify cancelled buyers
      if (io && conv) {
        io.to(`conversation:${conv._id}`).emit('conversation-closed', {
          conversationId: conv._id,
          reason: 'Listing sold to another buyer',
          sellerMessage: sellerMessage || undefined
        });
      }
    }

    // Close the winning conversation too (read-only after sale)
    const winningConv = await Conversation.findOneAndUpdate(
      { purchaseRequest: request._id },
      { status: 'closed', closedReason: 'Sale finalized' },
      { new: true }
    );

    // Notify the winning conversation
    if (io && winningConv) {
      io.to(`conversation:${winningConv._id}`).emit('sale-confirmed', {
        conversationId: winningConv._id,
        message: 'Sale has been finalized!'
      });
    }

    // Update completed transactions for both seller and buyer
    await updateUserReputation(request.seller);
    await updateUserReputation(request.buyer);

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
