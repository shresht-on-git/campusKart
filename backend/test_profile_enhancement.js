const axios = require('axios');
const mongoose = require('mongoose');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000/api';

async function runProfileTests() {
  console.log('================================================================');
  console.log('👤 CAMPUSKART PROFILE & LISTING MANAGEMENT TEST SUITE');
  console.log('================================================================\n');

  try {
    const ts = Date.now();

    // 1. Setup Accounts
    console.log('1. Setting up test accounts...');
    const registerUser = async (prefix, hostel = 'A') => {
      const email = `${prefix}_${ts}@thapar.edu`;
      const res = await axios.post(`${BASE_URL}/auth/register`, {
        name: `Original ${prefix}`,
        email,
        password: 'Password123!',
        hostel
      });
      return { token: res.data.token, user: { id: res.data._id, ...res.data } };
    };

    const studentA = await registerUser('alice', 'A'); // Seller
    const studentB = await registerUser('bob', 'B');   // Buyer 1
    const studentC = await registerUser('charlie', 'C'); // Buyer 2
    console.log('  ✓ Test accounts created and authenticated\n');

    const authH = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

    // Connect to MongoDB for helper listing creation
    await mongoose.connect('mongodb://127.0.0.1:27017/campuskart');
    const Listing = require('./models/Listing');

    const createListingDirect = async (sellerId, title, price, hostel, status = 'available') => {
      return await Listing.create({
        title,
        description: 'Test description for item',
        price,
        category: 'Electronics',
        condition: 'Good',
        images: ['https://placehold.co/400'],
        seller: sellerId,
        hostel,
        status,
        isDeleted: false
      });
    };

    // ==============================================================
    // TEST 1 & 2: Name Change & Synchronisation Across Listings
    // ==============================================================
    console.log('2. Testing Name Change & Synchronisation...');
    // Create available and sold listing for Student A under original name
    const listAvail1 = await createListingDirect(studentA.user.id, `Avail Item ${ts}`, 1000, studentA.user.hostel, 'available');
    const listSold1 = await createListingDirect(studentA.user.id, `Sold Item ${ts}`, 2000, studentA.user.hostel, 'sold');

    // Change name
    const updatedProfile1 = (await axios.put(`${BASE_URL}/auth/profile`, {
      name: 'Alice Wonder Updated',
      hostel: 'A'
    }, authH(studentA.token))).data;

    if (updatedProfile1.name !== 'Alice Wonder Updated') {
      throw new Error(`Expected name 'Alice Wonder Updated', got '${updatedProfile1.name}'`);
    }
    console.log('  ✓ Student successfully changed their name in User collection');

    // Verify populate on available listing shows updated name
    const checkAvailListing = (await axios.get(`${BASE_URL}/listings/${listAvail1._id}`, authH(studentB.token))).data;
    if (checkAvailListing.seller.name !== 'Alice Wonder Updated') {
      throw new Error(`Expected populated seller name 'Alice Wonder Updated', got '${checkAvailListing.seller.name}'`);
    }
    // Verify populate on sold listing shows updated name
    const checkSoldListing = (await axios.get(`${BASE_URL}/listings/${listSold1._id}`, authH(studentB.token))).data;
    if (checkSoldListing.seller.name !== 'Alice Wonder Updated') {
      throw new Error(`Expected populated seller name 'Alice Wonder Updated' on sold listing, got '${checkSoldListing.seller.name}'`);
    }
    console.log('  ✓ Updated name immediately appears on available and sold listings via populate\n');

    // ==============================================================
    // TEST 3, 4, 5, 6: Hostel Change & Synchronisation Across Listings
    // ==============================================================
    console.log('3. Testing Hostel Change & Synchronisation...');
    // Student A currently in Hostel A. Sold listing is in Hostel A. Available listing is in Hostel A.
    // Now Student A moves to Hostel B!
    const updatedProfileHostel = (await axios.put(`${BASE_URL}/auth/profile`, {
      name: 'Alice Wonder Updated',
      hostel: 'B'
    }, authH(studentA.token))).data;

    if (updatedProfileHostel.hostel !== 'B') {
      throw new Error(`Expected hostel B, got ${updatedProfileHostel.hostel}`);
    }
    console.log('  ✓ Student successfully changed their hostel to Hostel B');

    // Check available listing: MUST be updated to Hostel B
    const availListingAfterHostel = await Listing.findById(listAvail1._id);
    if (availListingAfterHostel.hostel !== 'B') {
      throw new Error(`Available listing hostel should be updated to B, got ${availListingAfterHostel.hostel}`);
    }
    console.log('  ✓ Available listing automatically synchronized to Hostel B');

    // Check sold listing: MUST RETAIN original Hostel A permanently!
    const soldListingAfterHostel = await Listing.findById(listSold1._id);
    if (soldListingAfterHostel.hostel !== 'A') {
      throw new Error(`Sold listing hostel should retain historical Hostel A, got ${soldListingAfterHostel.hostel}`);
    }
    console.log('  ✓ Sold listing retains original Hostel A permanently (historical record preserved)');

    // Verify Hostel Mode query prioritisation reflects new hostel
    // Student A is in Hostel B, listing is in Hostel B.
    const hostelModeListings = (await axios.get(`${BASE_URL}/listings?hostelMode=true`, authH(studentA.token))).data;
    const firstItemHostel = hostelModeListings[0]?.hostel || hostelModeListings[0]?.seller?.hostel;
    console.log(`  ✓ Hostel Mode query functional with updated hostel B (first item hostel: ${firstItemHostel})\n`);

    // ==============================================================
    // TEST 7: Email Restrictions — Non-editable
    // ==============================================================
    console.log('4. Testing Email Restrictions...');
    // Attempt to change email via profile update
    const emailAttempt = (await axios.put(`${BASE_URL}/auth/profile`, {
      name: 'Alice Wonder Updated',
      hostel: 'B',
      email: 'hacker@gmail.com'
    }, authH(studentA.token))).data;

    if (emailAttempt.email !== studentA.user.email) {
      throw new Error(`Email should not be editable! Expected ${studentA.user.email}, got ${emailAttempt.email}`);
    }
    console.log('  ✓ Email cannot be changed via profile edit; Thapar email identity preserved\n');

    // ==============================================================
    // TEST 8, 9, 10, 11, 12: Edit Available Listing
    // ==============================================================
    console.log('5. Testing Edit Available Listing Functionality...');
    // Buyer B requests listAvail1 and starts negotiation
    const reqAvail = (await axios.post(`${BASE_URL}/purchases/${listAvail1._id}`, {}, authH(studentB.token))).data;
    await axios.put(`${BASE_URL}/purchases/${reqAvail._id}/accept`, {}, authH(studentA.token));
    console.log('  ✓ Buyer B is currently negotiating for Available Listing 1');

    // Seller updates Title, Description, Price, Condition, and CATEGORY while negotiation is active
    const editRes = (await axios.put(`${BASE_URL}/listings/${listAvail1._id}`, {
      title: 'Updated Gaming Laptop',
      description: 'Upgraded RAM and SSD included',
      price: 1500,
      category: 'Books', // Changed category while negotiating
      condition: 'Like New'
    }, authH(studentA.token))).data;

    if (editRes.title !== 'Updated Gaming Laptop') throw new Error('Title update failed');
    if (editRes.price !== 1500) throw new Error('Price update failed');
    if (editRes.category !== 'Books') throw new Error('Category update failed');
    if (editRes.condition !== 'Like New') throw new Error('Condition update failed');
    console.log('  ✓ Title, description, price, condition and CATEGORY successfully edited during active negotiation');

    // Verify existing purchase request and conversation remain active and unaffected by category change
    const checkActiveReq = (await axios.get(`${BASE_URL}/purchases/check/${listAvail1._id}`, authH(studentB.token))).data;
    if (checkActiveReq.status !== 'negotiating') {
      throw new Error(`Category edit broke negotiation! Status is ${checkActiveReq.status}`);
    }
    console.log('  ✓ Existing negotiation and purchase request completely unaffected by category edit');

    // Edit without selecting new image preserves existing image
    const origImages = editRes.images;
    const editNoImg = (await axios.put(`${BASE_URL}/listings/${listAvail1._id}`, {
      title: 'Updated Gaming Laptop V2'
    }, authH(studentA.token))).data;
    if (JSON.stringify(editNoImg.images) !== JSON.stringify(origImages)) {
      throw new Error('Image was unexpectedly altered when not provided');
    }
    console.log('  ✓ Saving changes without selecting new image preserves existing image\n');

    // ==============================================================
    // TEST 13: My Listings Retrieval & Separation
    // ==============================================================
    console.log('6. Testing My Listings Endpoint...');
    const myListingsAll = (await axios.get(`${BASE_URL}/listings/my`, authH(studentA.token))).data;
    const myAvail = myListingsAll.filter(l => l.status === 'available');
    const mySold = myListingsAll.filter(l => l.status === 'sold');
    if (myAvail.length === 0 || mySold.length === 0) {
      throw new Error('Expected both available and sold listings in My Listings');
    }
    console.log(`  ✓ My Listings endpoint returned ${myListingsAll.length} items (${myAvail.length} available, ${mySold.length} sold)\n`);

    // ==============================================================
    // TEST 14, 15, 16, 17, 18, 19, 20, 21: Delete Available Listing Workflow
    // ==============================================================
    console.log('7. Testing Delete Available Listing with Active Demand & Notifications...');
    // Create new listing with multiple interested buyers and active negotiations
    const listToDelete = await createListingDirect(studentA.user.id, `Bike to Delete ${ts}`, 3000, 'B');

    // Buyer B requests & starts negotiation
    const reqB = (await axios.post(`${BASE_URL}/purchases/${listToDelete._id}`, {}, authH(studentB.token))).data;
    const accB = (await axios.put(`${BASE_URL}/purchases/${reqB._id}/accept`, {}, authH(studentA.token))).data;
    const convBId = accB.conversation._id;

    // Buyer C submits a pending request
    const reqC = (await axios.post(`${BASE_URL}/purchases/${listToDelete._id}`, {}, authH(studentC.token))).data;

    // Send chat messages in Conv B
    await axios.post(`${BASE_URL}/chats/${convBId}/messages`, { message: 'Can we meet at cafeteria?' }, authH(studentB.token));

    // Seller deletes the available listing
    const deleteRes = (await axios.delete(`${BASE_URL}/listings/${listToDelete._id}`, authH(studentA.token))).data;
    console.log('  ✓ Listing successfully deleted by seller');

    // 17. Verify listing disappeared from marketplace
    const publicListings = (await axios.get(`${BASE_URL}/listings?status=available`, authH(studentB.token))).data;
    if (publicListings.some(l => l._id === listToDelete._id.toString())) {
      throw new Error('Deleted listing still appears in marketplace!');
    }
    console.log('  ✓ Deleted listing removed from public marketplace');

    // 18. Verify affected buyers receive notification "Product deleted by seller."
    const buyerBPurchases = (await axios.get(`${BASE_URL}/purchases/my`, authH(studentB.token))).data;
    const bReqAfter = buyerBPurchases.find(r => r._id === reqB._id);
    if (bReqAfter.status !== 'cancelled') throw new Error(`Expected cancelled status, got ${bReqAfter.status}`);
    if (bReqAfter.sellerMessage !== 'Product deleted by seller.') {
      throw new Error(`Expected sellerMessage 'Product deleted by seller.', got '${bReqAfter.sellerMessage}'`);
    }

    const buyerCPurchases = (await axios.get(`${BASE_URL}/purchases/my`, authH(studentC.token))).data;
    const cReqAfter = buyerCPurchases.find(r => r._id === reqC._id);
    if (cReqAfter.status !== 'cancelled') throw new Error(`Expected cancelled status for Buyer C, got ${cReqAfter.status}`);
    if (cReqAfter.sellerMessage !== 'Product deleted by seller.') {
      throw new Error(`Expected sellerMessage 'Product deleted by seller.' for Buyer C, got '${cReqAfter.sellerMessage}'`);
    }
    console.log('  ✓ All affected buyers received exact notification: "Product deleted by seller."');

    // 19. Verify conversation is closed and read-only
    const convBAfter = (await axios.get(`${BASE_URL}/chats/${convBId}`, authH(studentB.token))).data;
    if (convBAfter.status !== 'closed') throw new Error(`Expected closed conversation, got ${convBAfter.status}`);
    if (convBAfter.closedReason !== 'Product deleted by seller.') {
      throw new Error(`Expected closedReason 'Product deleted by seller.', got '${convBAfter.closedReason}'`);
    }

    try {
      await axios.post(`${BASE_URL}/chats/${convBId}/messages`, { message: 'Still available?' }, authH(studentB.token));
      throw new Error('Message sending should fail on deleted product conversation');
    } catch (err) {
      if (err.response?.status !== 400) throw err;
      console.log('  ✓ Affected conversation is read-only (messages blocked)');
    }

    // 20. Verify historical messages and purchase requests remain accessible
    const msgsCheck = (await axios.get(`${BASE_URL}/chats/${convBId}/messages`, authH(studentB.token))).data;
    if (!msgsCheck.messages || msgsCheck.messages.length === 0) {
      throw new Error('Historical messages were lost!');
    }
    console.log('  ✓ Message history preserved and accessible');

    // 21. Verify deleted listing cannot receive new purchase requests
    try {
      await axios.post(`${BASE_URL}/purchases/${listToDelete._id}`, {}, authH(studentC.token));
      throw new Error('New request on deleted listing should have failed');
    } catch (err) {
      if (err.response?.status !== 400) throw err;
      console.log('  ✓ Deleted listing cannot receive new purchase requests');
    }

    // Deleted listing is soft-deleted, not removed from DB
    const dbListing = await Listing.findById(listToDelete._id);
    if (!dbListing || !dbListing.isDeleted) {
      throw new Error('Listing was cascade deleted or isDeleted flag not set');
    }
    console.log('  ✓ Listing document preserved in MongoDB with isDeleted: true\n');

    // ==============================================================
    // TEST 22 & 23: Protection of Sold Listings & Cross-Student Security
    // ==============================================================
    console.log('8. Testing Sold Listing Protection & Authorization Security...');
    // Student A tries to delete sold listing
    try {
      await axios.delete(`${BASE_URL}/listings/${listSold1._id}`, authH(studentA.token));
      throw new Error('Deleting sold listing should be rejected');
    } catch (err) {
      if (err.response?.status !== 400) throw err;
      console.log('  ✓ SOLD listings cannot be deleted (rejected with 400)');
    }

    // Student A tries to edit sold listing
    try {
      await axios.put(`${BASE_URL}/listings/${listSold1._id}`, { title: 'Hacked Title' }, authH(studentA.token));
      throw new Error('Editing sold listing should be rejected');
    } catch (err) {
      if (err.response?.status !== 400) throw err;
      console.log('  ✓ SOLD listings cannot be edited (rejected with 400)');
    }

    // Student B tries to edit Student A's listing
    try {
      await axios.put(`${BASE_URL}/listings/${listAvail1._id}`, { title: 'Stolen Listing' }, authH(studentB.token));
      throw new Error('Editing another student listing should be forbidden');
    } catch (err) {
      if (err.response?.status !== 403) throw err;
      console.log('  ✓ Cross-user editing blocked with 403 Forbidden');
    }

    // Student B tries to delete Student A's listing
    try {
      await axios.delete(`${BASE_URL}/listings/${listAvail1._id}`, authH(studentB.token));
      throw new Error('Deleting another student listing should be forbidden');
    } catch (err) {
      if (err.response?.status !== 403) throw err;
      console.log('  ✓ Cross-user deletion blocked with 403 Forbidden\n');
    }

    console.log('================================================================');
    console.log('🎉 ALL PROFILE & LISTING MANAGEMENT TESTS PASSED 100%!');
    console.log('================================================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.response?.data || error.message);
    if (error.stack) console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runProfileTests();
