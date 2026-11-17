const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'supersecretjwtkeyforcampuskart';
}

const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./routes/authRoutes');
const listingRoutes = require('./routes/listingRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const chatRoutes = require('./routes/chatRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const setupSocket = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Attach io to app so routes can broadcast if needed
app.set('io', io);

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/reviews', reviewRoutes);

// Setup Socket.IO
setupSocket(io);

// Connect to MongoDB
const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campuskart';
mongoose.connect(dbUri)
  .then(() => console.log('MongoDB Connected to', dbUri))
  .catch(err => {
    console.error('MongoDB connection failed:', err);
  });

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
