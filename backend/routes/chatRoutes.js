const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const PurchaseRequest = require('../models/PurchaseRequest');
const { protect } = require('../middleware/authMiddleware');

// GET /api/chats/my — Get all conversations for the authenticated user
router.get('/my', protect, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      $or: [{ buyer: req.user.id }, { seller: req.user.id }]
    })
      .populate('listing', 'title price images status')
      .populate('buyer', 'name email hostel')
      .populate('seller', 'name email hostel')
      .populate('purchaseRequest', 'status pendingSellerDecision buyerEndedNegotiation buyerEndedAt')
      .sort({ updatedAt: -1 });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/chats/by-request/:requestId — Get conversation by purchase request ID
router.get('/by-request/:requestId', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }

    const conversation = await Conversation.findOne({
      purchaseRequest: req.params.requestId
    })
      .populate('listing', 'title price images status')
      .populate('buyer', 'name email hostel')
      .populate('seller', 'name email hostel')
      .populate('purchaseRequest', 'status pendingSellerDecision buyerEndedNegotiation buyerEndedAt');

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Authorization check
    if (
      conversation.buyer._id.toString() !== req.user.id &&
      conversation.seller._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: 'Not authorized to access this conversation' });
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/chats/:conversationId — Get conversation details
router.get('/:conversationId', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.conversationId)) {
      return res.status(400).json({ message: 'Invalid conversation ID' });
    }

    const conversation = await Conversation.findById(req.params.conversationId)
      .populate('listing', 'title price images status')
      .populate('buyer', 'name email hostel')
      .populate('seller', 'name email hostel')
      .populate('purchaseRequest', 'status pendingSellerDecision buyerEndedNegotiation buyerEndedAt');

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Authorization check
    if (
      conversation.buyer._id.toString() !== req.user.id &&
      conversation.seller._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: 'Not authorized to access this conversation' });
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/chats/:conversationId/messages — Get messages for a conversation
router.get('/:conversationId/messages', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.conversationId)) {
      return res.status(400).json({ message: 'Invalid conversation ID' });
    }

    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Authorization check
    if (
      conversation.buyer.toString() !== req.user.id &&
      conversation.seller.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: 'Not authorized to access this conversation' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const messages = await Message.find({ conversation: req.params.conversationId })
      .populate('sender', 'name')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments({ conversation: req.params.conversationId });

    res.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/chats/:conversationId/messages — Send a message via REST (fallback)
router.post('/:conversationId/messages', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.conversationId)) {
      return res.status(400).json({ message: 'Invalid conversation ID' });
    }

    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Authorization check
    if (
      conversation.buyer.toString() !== req.user.id &&
      conversation.seller.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: 'Not authorized to send messages in this conversation' });
    }

    if (conversation.status !== 'open') {
      return res.status(400).json({ message: 'This conversation is closed. No new messages can be sent.' });
    }

    const pr = await PurchaseRequest.findById(conversation.purchaseRequest);
    if (pr && pr.pendingSellerDecision) {
      return res.status(400).json({ message: 'The buyer has ended negotiation. This conversation is read-only awaiting seller decision.' });
    }

    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ message: 'Message is too long (max 2000 characters)' });
    }

    const newMessage = await Message.create({
      conversation: req.params.conversationId,
      sender: req.user.id,
      message: message.trim()
    });

    // Update conversation updatedAt timestamp for sorting recent activity
    conversation.updatedAt = new Date();
    await conversation.save();

    const populatedMessage = await Message.findById(newMessage._id)
      .populate('sender', 'name');

    // Emit via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${req.params.conversationId}`).emit('new-message', populatedMessage);
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

