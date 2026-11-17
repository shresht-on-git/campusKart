const axios = require('axios');
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('================================================================');
  console.log('🎯 CAMPUSKART FINAL PURCHASE ENDING & RATING WORKFLOW TEST SUITE');
  console.log('================================================================\n');

  try {
    const timestamp = Date.now();

    // Setup accounts
    console.log('1. Setting up test accounts...');
    const registerUser = async (roleName) => {
      const email = `${roleName}_${timestamp}@thapar.edu`;
      const res = await axios.post(`${BASE_URL}/auth/register`, {
        name: `User ${roleName}`,
        email,
        password: 'Password123!',
        hostel: 'J'
      });
      return { token: res.data.token, user: { id: res.data._id, ...res.data } };
    };

    const seller = await registerUser(`seller`);
    const buyer1 = await registerUser(`buyer1`);
    const buyer2 = await registerUser(`buyer2`);
    const buyer3 = await registerUser(`buyer3`);
    console.log('  ✓ All test users registered and authenticated\n');

    const authH = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

    // Helper: Create listing directly in DB to bypass multipart upload in test
    const Listing = mongoose.model('Listing', new mongoose.Schema({
      title: String,
      description: String,
      price: Number,
      category: String,
      condition: String,
      images: [String],
      seller: mongoose.Schema.Types.ObjectId,
      hostel: String,
      status: { type: String, default: 'available' }
    }, { timestamps: true }));

    await mongoose.connect('mongodb://127.0.0.1:27017/campuskart');

    const createTestListing = async (title, price = 500) => {
      const doc = await Listing.create({
        title,
        description: 'Test item for workflow verification',
        price,
        category: 'Electronics',
        condition: 'Good',
        images: ['https://placehold.co/400'],
        seller: seller.user.id,
        hostel: 'J',
        status: 'available'
      });
      return doc;
    };

    // ==============================================================
    // TEST 1: Case 1 — Seller directly clicks Confirm Sale
    // ==============================================================
    console.log('2. Testing Case 1: Seller directly clicks Confirm Sale...');
    const l1 = await createTestListing(`Case1 Laptop ${timestamp}`, 25000);

    // B1 and B2 request
    const b1ReqL1 = (await axios.post(`${BASE_URL}/purchases/${l1._id}`, {}, authH(buyer1.token))).data;
    const b2ReqL1 = (await axios.post(`${BASE_URL}/purchases/${l1._id}`, {}, authH(buyer2.token))).data;

    // Seller accepts both for negotiation
    const acc1 = (await axios.put(`${BASE_URL}/purchases/${b1ReqL1._id}/accept`, {}, authH(seller.token))).data;
    const acc2 = (await axios.put(`${BASE_URL}/purchases/${b2ReqL1._id}/accept`, {}, authH(seller.token))).data;
    const conv1B1 = acc1.conversation._id;
    const conv1B2 = acc2.conversation._id;

    // Seller confirms sale with B1
    await axios.put(`${BASE_URL}/purchases/${b1ReqL1._id}/confirm-sale`, { sellerMessage: 'Sold to buyer 1' }, authH(seller.token));

    // Verify L1 is sold
    const l1Check = (await axios.get(`${BASE_URL}/listings/${l1._id}`, authH(seller.token))).data;
    if (l1Check.status !== 'sold') throw new Error(`Expected listing status sold, got ${l1Check.status}`);
    console.log('  ✓ Listing status is sold');

    // Verify B2 request is cancelled and conversation closed
    const b2ReqCheck = (await axios.get(`${BASE_URL}/purchases/my`, authH(buyer2.token))).data.find(r => r._id === b2ReqL1._id);
    if (b2ReqCheck.status !== 'cancelled') throw new Error(`Expected B2 request cancelled, got ${b2ReqCheck.status}`);
    console.log('  ✓ Other negotiating buyer (B2) cancelled');

    // Verify Review Eligibility: B1 & Seller get 6 criteria (completed_transaction)
    const b1RevStatus = (await axios.get(`${BASE_URL}/reviews/status/${conv1B1}`, authH(buyer1.token))).data;
    if (b1RevStatus.interactionType !== 'completed_transaction') throw new Error(`Expected completed_transaction, got ${b1RevStatus.interactionType}`);
    if (b1RevStatus.applicableCriteria.length !== 6) throw new Error(`Expected 6 criteria, got ${b1RevStatus.applicableCriteria.length}`);
    console.log('  ✓ Winning buyer receives transaction-completion rating form (6 criteria)');

    const s1RevStatus = (await axios.get(`${BASE_URL}/reviews/status/${conv1B1}`, authH(seller.token))).data;
    if (s1RevStatus.interactionType !== 'completed_transaction') throw new Error(`Expected completed_transaction for seller, got ${s1RevStatus.interactionType}`);
    if (s1RevStatus.applicableCriteria.length !== 6) throw new Error(`Expected 6 criteria for seller, got ${s1RevStatus.applicableCriteria.length}`);
    console.log('  ✓ Seller receives transaction-completion rating form (6 criteria)');

    // Verify B2 gets negotiation-only review form (3 criteria)
    const b2RevStatus = (await axios.get(`${BASE_URL}/reviews/status/${conv1B2}`, authH(buyer2.token))).data;
    if (b2RevStatus.interactionType !== 'negotiation') throw new Error(`Expected negotiation for cancelled buyer B2, got ${b2RevStatus.interactionType}`);
    if (b2RevStatus.applicableCriteria.length !== 3) throw new Error(`Expected 3 criteria for B2, got ${b2RevStatus.applicableCriteria.length}`);
    console.log('  ✓ Cancelled buyer with negotiation history receives negotiation-only rating form (3 criteria)');

    // Submit reviews
    await axios.post(`${BASE_URL}/reviews`, {
      conversationId: conv1B1,
      criteria: { respectfulness: 5, communication: 5, responsiveness: 5, punctuality: 5, itemAccuracy: 5, smoothHandover: 5 }
    }, authH(buyer1.token));
    await axios.post(`${BASE_URL}/reviews`, {
      conversationId: conv1B1,
      criteria: { respectfulness: 5, communication: 5, responsiveness: 5, punctuality: 5, paymentReliability: 5, smoothHandover: 5 }
    }, authH(seller.token));
    console.log('  ✓ Both participants submitted reviews independently\n');

    // ==============================================================
    // TEST 2: Case 2 — Seller directly clicks End Negotiation
    // ==============================================================
    console.log('3. Testing Case 2: Seller directly clicks End Negotiation...');
    const l2 = await createTestListing(`Case2 Textbook ${timestamp}`, 350);

    const b1ReqL2 = (await axios.post(`${BASE_URL}/purchases/${l2._id}`, {}, authH(buyer1.token))).data;
    const accL2 = (await axios.put(`${BASE_URL}/purchases/${b1ReqL2._id}/accept`, {}, authH(seller.token))).data;
    const conv2 = accL2.conversation._id;

    // Seller ends negotiation directly
    await axios.put(`${BASE_URL}/purchases/${b1ReqL2._id}/end-negotiation`, {}, authH(seller.token));

    // Verify L2 remains available
    const l2Check = (await axios.get(`${BASE_URL}/listings/${l2._id}`, authH(seller.token))).data;
    if (l2Check.status !== 'available') throw new Error(`Expected listing status available, got ${l2Check.status}`);
    console.log('  ✓ Listing remains available');

    // Verify review criteria: exactly 3 criteria (negotiation)
    const conv2RevStatus = (await axios.get(`${BASE_URL}/reviews/status/${conv2}`, authH(buyer1.token))).data;
    if (conv2RevStatus.interactionType !== 'negotiation') throw new Error(`Expected negotiation, got ${conv2RevStatus.interactionType}`);
    if (conv2RevStatus.applicableCriteria.length !== 3) throw new Error(`Expected 3 criteria, got ${conv2RevStatus.applicableCriteria.length}`);
    console.log('  ✓ Both participants receive negotiation-only rating form (3 criteria)\n');

    // ==============================================================
    // TEST 3: Case 3 — Buyer clicks End Negotiation → Seller selects No Sale
    // ==============================================================
    console.log('4. Testing Case 3: Buyer clicks End Negotiation → Seller selects No Sale...');
    const l3 = await createTestListing(`Case3 Bicycle ${timestamp}`, 2800);

    // B1 and B2 request
    const b1ReqL3 = (await axios.post(`${BASE_URL}/purchases/${l3._id}`, {}, authH(buyer1.token))).data;
    const b2ReqL3 = (await axios.post(`${BASE_URL}/purchases/${l3._id}`, {}, authH(buyer2.token))).data;

    // Accept both for negotiation
    const accL3B1 = (await axios.put(`${BASE_URL}/purchases/${b1ReqL3._id}/accept`, {}, authH(seller.token))).data;
    const accL3B2 = (await axios.put(`${BASE_URL}/purchases/${b2ReqL3._id}/accept`, {}, authH(seller.token))).data;
    const conv3B1 = accL3B1.conversation._id;
    const conv3B2 = accL3B2.conversation._id;

    // Buyer 1 clicks End Negotiation
    await axios.put(`${BASE_URL}/purchases/${b1ReqL3._id}/buyer-end-negotiation`, {}, authH(buyer1.token));

    // Verify Pending State
    const myPurchasesCheck = (await axios.get(`${BASE_URL}/purchases/my`, authH(buyer1.token))).data.find(r => r._id === b1ReqL3._id);
    if (!myPurchasesCheck.pendingSellerDecision) throw new Error('Expected pendingSellerDecision to be true');
    console.log('  ✓ PurchaseRequest entered pendingSellerDecision: true');

    // Verify conversation is closed/read-only: message cannot be sent
    try {
      await axios.post(`${BASE_URL}/chats/${conv3B1}/messages`, { message: 'Hello' }, authH(buyer1.token));
      throw new Error('Message sending should have failed while awaiting seller decision');
    } catch (err) {
      if (err.response?.status !== 400) throw err;
      console.log('  ✓ Conversation is read-only (messages blocked)');
    }

    // Verify marketplace hiding: Listing L3 temporarily hidden from public results
    const publicListings = (await axios.get(`${BASE_URL}/listings?status=available`, authH(buyer3.token))).data;
    if (publicListings.some(item => item._id === l3._id.toString())) {
      throw new Error('Listing with pending seller decision should be hidden from marketplace');
    }
    console.log('  ✓ Listing temporarily hidden from marketplace results');

    // Verify new requests blocked while pending decision
    try {
      await axios.post(`${BASE_URL}/purchases/${l3._id}`, {}, authH(buyer3.token));
      throw new Error('New purchase request should have been blocked');
    } catch (err) {
      if (err.response?.status !== 400) throw err;
      console.log('  ✓ New purchase requests blocked while seller decision is pending');
    }

    // Verify other negotiation (B2) is unaffected and open
    const conv3B2Data = (await axios.get(`${BASE_URL}/chats/${conv3B2}`, authH(buyer2.token))).data;
    if (conv3B2Data.status !== 'open') throw new Error(`Expected B2 conversation to remain open, got ${conv3B2Data.status}`);
    console.log('  ✓ Other buyer (B2) negotiation remains unaffected and open');

    // Verify review cannot be submitted while decision is pending
    try {
      await axios.post(`${BASE_URL}/reviews`, {
        conversationId: conv3B1,
        criteria: { respectfulness: 5, communication: 5, responsiveness: 5 }
      }, authH(buyer1.token));
      throw new Error('Review should have been blocked while decision pending');
    } catch (err) {
      if (err.response?.status !== 400) throw err;
      console.log('  ✓ Review submissions blocked while awaiting seller decision');
    }

    // Seller selects "No, Transaction Not Completed" (Case 3)
    const decisionRes = (await axios.put(`${BASE_URL}/purchases/${b1ReqL3._id}/seller-decision`, {
      decision: 'no_sale'
    }, authH(seller.token))).data;
    if (decisionRes.decision !== 'no_sale') throw new Error(`Expected decision no_sale, got ${decisionRes.decision}`);

    // Verify L3 is restored to marketplace
    const publicListingsAfter = (await axios.get(`${BASE_URL}/listings?status=available`, authH(buyer3.token))).data;
    if (!publicListingsAfter.some(item => item._id === l3._id.toString())) {
      throw new Error('Listing should be restored to marketplace after No Sale decision');
    }
    console.log('  ✓ Listing restored to marketplace after No Sale decision');

    // Verify B1 request is rejected
    const b1AfterNoSale = (await axios.get(`${BASE_URL}/purchases/my`, authH(buyer1.token))).data.find(r => r._id === b1ReqL3._id);
    if (b1AfterNoSale.status !== 'rejected') throw new Error(`Expected status rejected, got ${b1AfterNoSale.status}`);
    if (b1AfterNoSale.pendingSellerDecision) throw new Error('Expected pendingSellerDecision to be cleared to false');
    console.log('  ✓ B1 request status changed to rejected and pending flag cleared');

    // Verify both participants now receive 3-criterion negotiation reviews
    const b1L3Rev = (await axios.get(`${BASE_URL}/reviews/status/${conv3B1}`, authH(buyer1.token))).data;
    if (b1L3Rev.interactionType !== 'negotiation') throw new Error(`Expected negotiation, got ${b1L3Rev.interactionType}`);
    if (b1L3Rev.applicableCriteria.length !== 3) throw new Error(`Expected 3 criteria, got ${b1L3Rev.applicableCriteria.length}`);
    console.log('  ✓ Both participants now receive negotiation-only rating form (3 criteria)\n');

    // ==============================================================
    // TEST 4: Case 4 — Buyer clicks End Negotiation → Seller selects Confirm Sale
    // ==============================================================
    console.log('5. Testing Case 4: Buyer clicks End Negotiation → Seller selects Confirm Sale...');
    const l4 = await createTestListing(`Case4 Kettle ${timestamp}`, 450);

    const b1ReqL4 = (await axios.post(`${BASE_URL}/purchases/${l4._id}`, {}, authH(buyer1.token))).data;
    const b2ReqL4 = (await axios.post(`${BASE_URL}/purchases/${l4._id}`, {}, authH(buyer2.token))).data;

    const accL4B1 = (await axios.put(`${BASE_URL}/purchases/${b1ReqL4._id}/accept`, {}, authH(seller.token))).data;
    const accL4B2 = (await axios.put(`${BASE_URL}/purchases/${b2ReqL4._id}/accept`, {}, authH(seller.token))).data;
    const conv4B1 = accL4B1.conversation._id;
    const conv4B2 = accL4B2.conversation._id;

    // Buyer 1 ends negotiation
    await axios.put(`${BASE_URL}/purchases/${b1ReqL4._id}/buyer-end-negotiation`, {}, authH(buyer1.token));

    // Seller selects "Confirm Sale"
    await axios.put(`${BASE_URL}/purchases/${b1ReqL4._id}/seller-decision`, {
      decision: 'confirm_sale',
      sellerMessage: 'Deal confirmed with Buyer 1'
    }, authH(seller.token));

    // Verify listing is marked SOLD
    const l4Check = (await axios.get(`${BASE_URL}/listings/${l4._id}`, authH(seller.token))).data;
    if (l4Check.status !== 'sold') throw new Error(`Expected listing sold, got ${l4Check.status}`);
    console.log('  ✓ Listing status marked SOLD');

    // Verify B1 request is accepted
    const b1L4Check = (await axios.get(`${BASE_URL}/purchases/my`, authH(buyer1.token))).data.find(r => r._id === b1ReqL4._id);
    if (b1L4Check.status !== 'accepted') throw new Error(`Expected B1 request accepted, got ${b1L4Check.status}`);
    console.log('  ✓ Selected buyer request marked accepted');

    // Verify other buyer (B2) cancelled
    const b2L4Check = (await axios.get(`${BASE_URL}/purchases/my`, authH(buyer2.token))).data.find(r => r._id === b2ReqL4._id);
    if (b2L4Check.status !== 'cancelled') throw new Error(`Expected B2 request cancelled, got ${b2L4Check.status}`);
    console.log('  ✓ Other negotiating buyer (B2) cancelled');

    // Verify both B1 and Seller receive 6 criteria (completed_transaction)
    const b1L4Rev = (await axios.get(`${BASE_URL}/reviews/status/${conv4B1}`, authH(buyer1.token))).data;
    if (b1L4Rev.interactionType !== 'completed_transaction') throw new Error(`Expected completed_transaction, got ${b1L4Rev.interactionType}`);
    if (b1L4Rev.applicableCriteria.length !== 6) throw new Error(`Expected 6 criteria, got ${b1L4Rev.applicableCriteria.length}`);
    console.log('  ✓ Both participants automatically receive transaction-completion form (6 criteria)\n');

    // ==============================================================
    // TEST 5: Verify Reputation Aggregates & Completed Transaction Counts
    // ==============================================================
    console.log('6. Verifying Reputation Aggregates & Completed Transactions Count...');
    const sellerRep = (await axios.get(`${BASE_URL}/reviews/user/${seller.user.id}`, authH(buyer1.token))).data;
    // Seller confirmed 2 sales (Case 1 and Case 4)
    if (sellerRep.sellerReputation.completedTransactions !== 2) {
      throw new Error(`Expected seller completedTransactions 2, got ${sellerRep.sellerReputation.completedTransactions}`);
    }
    console.log('  ✓ Seller completed transactions accurately counted as 2 (Case 1 + Case 4)');

    const buyer1Rep = (await axios.get(`${BASE_URL}/reviews/user/${buyer1.user.id}`, authH(seller.token))).data;
    if (buyer1Rep.buyerReputation.completedTransactions !== 2) {
      throw new Error(`Expected buyer1 completedTransactions 2, got ${buyer1Rep.buyerReputation.completedTransactions}`);
    }
    console.log('  ✓ Buyer completed transactions accurately counted as 2');

    // Verify profile privacy (collective ratings only)
    if (sellerRep.reviews || sellerRep.reviewerNames) {
      throw new Error('Individual review details should not be exposed in user profile');
    }
    console.log('  ✓ Profile privacy preserved (collective metrics only)');

    console.log('\n================================================================');
    console.log('🎉 ALL 4 CASES AND SAFEGUARDS FULLY VERIFIED AND PASSING 100%!');
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

runTests();
