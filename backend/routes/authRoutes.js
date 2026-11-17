const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Listing = require('../models/Listing');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, hostel } = req.body;

    if (!email.endsWith('@thapar.edu')) {
      return res.status(400).json({ message: 'Only @thapar.edu emails are allowed' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const validHostels = ['A', 'B', 'C', 'D', 'H', 'J'];
    if (!validHostels.includes(hostel)) {
      return res.status(400).json({ message: 'Invalid hostel selected' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      hostel,
      role: 'student' // Force role to student
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        hostel: user.hostel,
        role: user.role,
        token: generateToken(user._id)
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        hostel: user.hostel,
        role: user.role,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Profile / Me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Profile
// PUT /api/auth/profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, hostel } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      return res.status(400).json({ message: 'Name must be between 2 and 50 characters' });
    }

    const validHostels = ['A', 'B', 'C', 'D', 'H', 'J'];
    if (!hostel || !validHostels.includes(hostel)) {
      return res.status(400).json({ message: 'Invalid hostel selected. Must be one of A, B, C, D, H, J' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.name = trimmedName;

    const hostelChanged = user.hostel !== hostel;
    user.hostel = hostel;

    await user.save();

    // Hostel synchronisation:
    // Update all their AVAILABLE listings automatically.
    // SOLD listings must retain their original hostel permanently as historical transaction records.
    if (hostelChanged) {
      await Listing.updateMany(
        { seller: user._id, status: 'available', isDeleted: { $ne: true } },
        { hostel: hostel }
      );
    }

    const updatedUser = await User.findById(user._id).select('-password');
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

module.exports = router;
