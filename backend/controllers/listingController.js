const Listing = require('../models/Listing');
const User = require('../models/User');
const PurchaseRequest = require('../models/PurchaseRequest');
const Conversation = require('../models/Conversation');

// @desc    Create a listing
// @route   POST /api/listings
// @access  Private
const createListing = async (req, res) => {
  try {
    const { title, description, price, category, condition, images } = req.body;

    // Get seller details
    const seller = await User.findById(req.user.id);
    if (!seller) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Image is required' });
    }

    const imageUrl = `http://localhost:5000/uploads/${req.file.filename}`;

    const listing = await Listing.create({
      title,
      description,
      price,
      category,
      condition,
      images: [imageUrl],
      seller: req.user.id,
      hostel: seller.hostel, // Automatically set from authenticated user
    });

    res.status(201).json(listing);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all listings (with search & filters & hostel mode)
// @route   GET /api/listings
// @access  Public / Private
const getListings = async (req, res) => {
  try {
    const { search, category, condition, status, sort, sortBy, hostelMode } = req.query;
    
    // Step 1: Build query object and apply filters
    let query = { isDeleted: { $ne: true } };
    
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    
    if (category) {
      query.category = category;
    }
    if (condition) {
      query.condition = condition;
    }
    if (status) {
      query.status = status;
    }

    // Temporarily hide listings awaiting seller decision from public marketplace results
    const pendingDecisionRequests = await PurchaseRequest.find({ pendingSellerDecision: true }).select('listing');
    const pendingListingIds = pendingDecisionRequests.map(r => r.listing);
    
    if (pendingListingIds.length > 0) {
      if (query._id) {
        query.$and = [
          { _id: query._id },
          { _id: { $nin: pendingListingIds } }
        ];
        delete query._id;
      } else {
        query._id = { $nin: pendingListingIds };
      }
    }

    const listings = await Listing.find(query).populate('seller', 'name email hostel sellerRating sellerReviewCount sellerCompletedTransactions');
    
    // Sort comparator applied independently
    // Default sorting: highest seller rating first, tie-breaker newest listing first
    // Explicit user selections: price-asc, price-desc, newest
    const sortKey = sortBy || sort || 'reputation';
    const sortComparator = (a, b) => {
      if (sortKey === 'price-asc') {
        return (a.price || 0) - (b.price || 0);
      }
      if (sortKey === 'price-desc') {
        return (b.price || 0) - (a.price || 0);
      }
      if (sortKey === 'newest') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      
      // Default / Reputation: Highest seller rating first
      // Unrated users placed below rated users
      const aRated = (a.seller?.sellerReviewCount || 0) > 0;
      const bRated = (b.seller?.sellerReviewCount || 0) > 0;
      if (aRated && !bRated) return -1;
      if (!aRated && bRated) return 1;
      if (aRated && bRated) {
        const diff = (b.seller?.sellerRating || 0) - (a.seller?.sellerRating || 0);
        if (Math.abs(diff) > 0.0001) return diff;
      }
      // Tie-breaker: newest listing first
      return new Date(b.createdAt) - new Date(a.createdAt);
    };

    // Helper to determine a listing's hostel safely
    const getListingHostel = (item) => {
      return item.hostel || item.seller?.hostel || null;
    };

    const isHostelModeOn = hostelMode === 'true' || hostelMode === true;
    let userHostel = null;

    if (isHostelModeOn && req.user && req.user.id) {
      const currentUser = await User.findById(req.user.id).select('hostel');
      userHostel = currentUser?.hostel || null;
    }

    if (isHostelModeOn && userHostel) {
      // Step 2: Divide into same-hostel and other-hostel groups
      const sameHostel = [];
      const otherHostel = [];

      for (const item of listings) {
        const itemHostel = getListingHostel(item);
        if (itemHostel && itemHostel === userHostel) {
          sameHostel.push(item);
        } else {
          otherHostel.push(item);
        }
      }

      // Step 3: Apply sorting criteria independently within each group
      sameHostel.sort(sortComparator);
      otherHostel.sort(sortComparator);

      // Step 4: Display same-hostel group first, followed by other-hostel group
      return res.json([...sameHostel, ...otherHostel]);
    }

    // Normal sorting when Hostel Mode is OFF or user hostel not available
    listings.sort(sortComparator);
    res.json(listings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current user's listings (available & sold)
// @route   GET /api/listings/my
// @access  Private
const getMyListings = async (req, res) => {
  try {
    const query = { seller: req.user.id, isDeleted: { $ne: true } };
    if (req.query.status && ['available', 'sold'].includes(req.query.status)) {
      query.status = req.query.status;
    }
    const listings = await Listing.find(query)
      .populate('seller', 'name email hostel sellerRating sellerReviewCount sellerCompletedTransactions')
      .sort({ createdAt: -1 });
    res.json(listings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single listing
// @route   GET /api/listings/:id
// @access  Public (or Private)
const getListingById = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).populate('seller', 'name email hostel sellerRating sellerReviewCount sellerCompletedTransactions');
    
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    // If soft-deleted and requested by someone other than owner, return 404
    if (listing.isDeleted && (!req.user || listing.seller._id.toString() !== req.user.id)) {
      return res.status(404).json({ message: 'Listing not found' });
    }
    
    const pendingDecision = await PurchaseRequest.exists({ listing: req.params.id, pendingSellerDecision: true });
    const listingObj = listing.toObject();
    listingObj.hasPendingSellerDecision = !!pendingDecision;

    res.json(listingObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a listing
// @route   PUT /api/listings/:id
// @access  Private
const updateListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    
    if (!listing || listing.isDeleted) {
      return res.status(404).json({ message: 'Listing not found' });
    }
    
    // Check ownership
    if (listing.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to edit this listing' });
    }
    
    // Prevent ordinary listing editing from bypassing the Confirm Sale workflow
    if (listing.status === 'sold') {
      return res.status(400).json({ message: 'Cannot edit a sold listing' });
    }
    
    // Extract fields that are allowed to be updated
    const { title, description, price, category, condition } = req.body;

    const validCategories = [
      'Electronics', 'Books', 'Notes', 'Cycles', 
      'Hostel Essentials', 'Study Materials', 'Sports', 'Accessories', 'Other'
    ];
    if (category) {
      if (!validCategories.includes(category)) {
        return res.status(400).json({ message: 'Invalid category' });
      }
      listing.category = category;
    }

    const validConditions = ['New', 'Like New', 'Good', 'Fair'];
    if (condition) {
      if (!validConditions.includes(condition)) {
        return res.status(400).json({ message: 'Invalid condition' });
      }
      listing.condition = condition;
    }
    
    if (title && title.trim()) {
      listing.title = title.trim();
    }
    if (description && description.trim()) {
      listing.description = description.trim();
    }
    if (price !== undefined && price !== '') {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) {
        return res.status(400).json({ message: 'Price must be a positive number' });
      }
      listing.price = numPrice;
    }
    
    if (req.file) {
      listing.images = [`http://localhost:5000/uploads/${req.file.filename}`];
    }
    
    const updatedListing = await listing.save();
    const populated = await Listing.findById(updatedListing._id)
      .populate('seller', 'name email hostel sellerRating sellerReviewCount sellerCompletedTransactions');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a listing
// @route   DELETE /api/listings/:id
// @access  Private
const deleteListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    
    if (!listing || listing.isDeleted) {
      return res.status(404).json({ message: 'Listing not found' });
    }
    
    // Check ownership
    if (listing.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this listing' });
    }
    
    // Prevent ordinary deletion from deleting sold listings
    if (listing.status === 'sold') {
      return res.status(400).json({ message: 'Cannot delete a sold listing' });
    }
    
    // Soft-delete the listing
    listing.isDeleted = true;
    await listing.save();

    // Cancel all active purchase requests (pending and negotiating)
    const activeRequests = await PurchaseRequest.find({
      listing: listing._id,
      status: { $in: ['pending', 'negotiating'] }
    });

    const io = req.app.get('io');

    for (const reqItem of activeRequests) {
      reqItem.status = 'cancelled';
      reqItem.pendingSellerDecision = false;
      reqItem.sellerMessage = 'Product deleted by seller.';
      await reqItem.save();

      // Close associated conversation
      const conv = await Conversation.findOneAndUpdate(
        { purchaseRequest: reqItem._id },
        { status: 'closed', closedReason: 'Product deleted by seller.' },
        { new: true }
      );

      // Notify affected buyers via Socket.IO
      if (io && conv) {
        io.to(`conversation:${conv._id}`).emit('conversation-closed', {
          conversationId: conv._id,
          reason: 'Product deleted by seller.',
          sellerMessage: 'Product deleted by seller.'
        });
      }
    }

    res.json({ message: 'Listing removed successfully', listing });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createListing,
  getListings,
  getMyListings,
  getListingById,
  updateListing,
  deleteListing
};
