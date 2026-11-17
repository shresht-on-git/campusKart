const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const PurchaseRequest = require('../models/PurchaseRequest');

const setupSocket = (io) => {
  // Authentication middleware for Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Automatically join the user's personal room for direct notifications
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Join a conversation room
    socket.on('join-conversation', async (conversationId) => {
      try {
        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
          socket.emit('error', { message: 'Invalid conversation ID' });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        // Authorization: only buyer or seller can join
        if (
          conversation.buyer.toString() !== socket.userId &&
          conversation.seller.toString() !== socket.userId
        ) {
          socket.emit('error', { message: 'Not authorized to join this conversation' });
          return;
        }

        socket.join(`conversation:${conversationId}`);
        socket.emit('joined-conversation', { conversationId });
      } catch (err) {
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    // Leave a conversation room
    socket.on('leave-conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Send a message
    socket.on('send-message', async (data) => {
      try {
        const { conversationId, message } = data;

        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
          socket.emit('error', { message: 'Invalid conversation ID' });
          return;
        }

        if (!message || !message.trim()) {
          socket.emit('error', { message: 'Message cannot be empty' });
          return;
        }

        if (message.length > 2000) {
          socket.emit('error', { message: 'Message is too long (max 2000 characters)' });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        // Authorization: only buyer or seller
        if (
          conversation.buyer.toString() !== socket.userId &&
          conversation.seller.toString() !== socket.userId
        ) {
          socket.emit('error', { message: 'Not authorized to send messages in this conversation' });
          return;
        }

        // Check if conversation is open
        if (conversation.status !== 'open') {
          socket.emit('error', { message: 'This conversation is closed. No new messages can be sent.' });
          return;
        }

        const pr = await PurchaseRequest.findById(conversation.purchaseRequest);
        if (pr && pr.pendingSellerDecision) {
          socket.emit('error', { message: 'The buyer has ended negotiation. This conversation is read-only awaiting seller decision.' });
          return;
        }

        // Save message to MongoDB
        const newMessage = await Message.create({
          conversation: conversationId,
          sender: socket.userId,
          message: message.trim()
        });

        // Update conversation activity timestamp
        conversation.updatedAt = new Date();
        await conversation.save();

        const populatedMessage = await Message.findById(newMessage._id)
          .populate('sender', 'name');

        // Broadcast to the conversation room
        io.to(`conversation:${conversationId}`).emit('new-message', populatedMessage);
      } catch (err) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      // Disconnected
    });
  });
};

module.exports = setupSocket;

