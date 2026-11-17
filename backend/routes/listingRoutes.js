const express = require('express');
const router = express.Router();
const {
  createListing,
  getListings,
  getMyListings,
  getListingById,
  updateListing,
  deleteListing
} = require('../controllers/listingController');
const { protect } = require('../middleware/authMiddleware');

const upload = require('../middleware/uploadMiddleware');

// Get all listings and Create a listing
router.route('/')
  .get(protect, getListings)
  .post(protect, upload.single('image'), createListing);

// Current user's listings
router.get('/my', protect, getMyListings);

// Get single, Update, and Delete a listing
router.route('/:id')
  .get(protect, getListingById)
  .put(protect, upload.single('image'), updateListing)
  .delete(protect, deleteListing);

module.exports = router;
