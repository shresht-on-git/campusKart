const axios = require('axios');
const FormData = require('form-data');

const API = 'http://localhost:5000/api';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

async function runReputationTests() {
  console.log('================================================================');
  console.log('⭐ CAMPUSKART RATINGS & REPUTATION SYSTEM — FULL VERIFICATION');
  console.log('================================================================\n');

  const getAuthUser = async (name, email, hostel = 'A') => {
    try {
      const res = await axios.post(`${API}/auth/register`, {
        name,
        email,
        password: 'password123',
        hostel
      });
      return res.data;
    } catch {
      const res = await axios.post(`${API}/auth/login`, {
        email,
        password: 'password123'
      });
      return res.data;
    }
  };

  const ts = Date.now();

  // 1. Setup test accounts
  console.log('1. Setting up test users...');
  const seller1 = await getAuthUser('Seller Alpha', `seller_alpha_${ts}@thapar.edu`, 'A');
  const seller2 = await getAuthUser('Seller Beta', `seller_beta_${ts}@thapar.edu`, 'B');
  const buyer1 = await getAuthUser('Buyer Dave', `buyer_dave_${ts}@thapar.edu`, 'A');
  const buyer2 = await getAuthUser('Buyer Emma', `buyer_emma_${ts}@thapar.edu`, 'C');
  const outsider = await getAuthUser('Outsider Zara', `outsider_${ts}@thapar.edu`, 'D');
  assert(seller1.token && seller2.token && buyer1.token && buyer2.token && outsider.token, 'All 5 test users authenticated');

  // Verify initially unrated state (displays 0 reviews, rated 0)
  console.log('\n2. Verifying initial unrated reputation...');
  const initialSellerProfile = await axios.get(`${API}/reviews/user/${seller1._id}`, {
    headers: { Authorization: `Bearer ${seller1.token}` }
  });
  assert(initialSellerProfile.data.sellerReputation.reviewCount === 0, 'Seller Alpha has 0 reviews initially');
  assert(initialSellerProfile.data.sellerReputation.completedTransactions === 0, 'Seller Alpha has 0 completed transactions initially');
  assert(initialSellerProfile.data.buyerReputation.reviewCount === 0, 'Seller Alpha has 0 buyer reviews initially');

  // 3. Scenario A: Negotiation ends WITHOUT a deal
  console.log('\n3. Scenario A: Negotiation ends without a deal...');
  const form1 = new FormData();
  form1.append('title', 'Engineering Physics Textbook');
  form1.append('description', 'Standard textbook for 1st year');
  form1.append('price', 450);
  form1.append('category', 'Books');
  form1.append('condition', 'Good');
  form1.append('image', Buffer.from('fake-book-image'), { filename: 'book.png', contentType: 'image/png' });

  const listing1Res = await axios.post(`${API}/listings`, form1, {
    headers: { Authorization: `Bearer ${seller1.token}`, ...form1.getHeaders() }
  });
  const listing1 = listing1Res.data;

  // Buyer 1 requests
  const req1Res = await axios.post(`${API}/purchases/${listing1._id}`, {}, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });
  const req1 = req1Res.data;

  // Seller accepts for negotiation
  const accept1Res = await axios.put(`${API}/purchases/${req1._id}/accept`, {}, {
    headers: { Authorization: `Bearer ${seller1.token}` }
  });
  const conv1 = accept1Res.data.conversation;
  assert(conv1._id && accept1Res.data.request.status === 'negotiating', 'Conversation 1 opened for negotiation');

  // Verify cannot review while conversation is open
  try {
    await axios.post(`${API}/reviews`, {
      conversationId: conv1._id,
      criteria: { respectfulness: 5, communication: 4, responsiveness: 4 }
    }, {
      headers: { Authorization: `Bearer ${buyer1.token}` }
    });
    assert(false, 'Should NOT allow review on open conversation');
  } catch (err) {
    assert(err.response?.status === 400, 'Blocked review on active conversation with 400');
  }

  // Buyer ends negotiation without a deal
  const end1Res = await axios.put(`${API}/purchases/${req1._id}/buyer-end-negotiation`, {}, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });
  assert(end1Res.data.pendingSellerDecision === true, 'Negotiation ended by Buyer 1 pending seller decision');

  // Seller selects "No, Transaction Not Completed" (Case 3)
  const noSaleRes = await axios.put(`${API}/purchases/${req1._id}/seller-decision`, {
    decision: 'no_sale'
  }, {
    headers: { Authorization: `Bearer ${seller1.token}` }
  });
  assert(noSaleRes.data.request.status === 'rejected', 'Negotiation ended by Buyer 1 and confirmed as No Sale by seller');

  // Check review status for Buyer 1 on Conv 1
  const status1Buyer = await axios.get(`${API}/reviews/status/${conv1._id}`, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });
  assert(status1Buyer.data.canReview === true, 'Buyer 1 is eligible to review');
  assert(status1Buyer.data.interactionType === 'negotiation', 'Interaction type correctly determined as "negotiation" by backend');
  assert(status1Buyer.data.applicableCriteria.length === 3, 'Negotiation review has exactly 3 criteria (Respectfulness, Communication, Responsiveness)');

  // Check review status for Seller 1 on Conv 1
  const status1Seller = await axios.get(`${API}/reviews/status/${conv1._id}`, {
    headers: { Authorization: `Bearer ${seller1.token}` }
  });
  assert(status1Seller.data.canReview === true, 'Seller 1 is also independently eligible to review');
  assert(status1Seller.data.interactionType === 'negotiation', 'Seller sees negotiation review criteria');

  // Test Validation: missing mandatory criteria
  console.log('\n4. Testing validation: missing mandatory criteria...');
  try {
    await axios.post(`${API}/reviews`, {
      conversationId: conv1._id,
      criteria: { respectfulness: 4, communication: 5 } // missing responsiveness
    }, {
      headers: { Authorization: `Bearer ${buyer1.token}` }
    });
    assert(false, 'Should reject review submission missing mandatory criteria');
  } catch (err) {
    assert(err.response?.status === 400, 'Rejected incomplete review with 400 Bad Request');
  }

  // Buyer 1 submits review for Seller 1 (optional comment left empty)
  console.log('\n5. Buyer 1 submits review for Seller 1 (empty comment test)...');
  const reviewBuyerToSeller1 = await axios.post(`${API}/reviews`, {
    conversationId: conv1._id,
    criteria: {
      respectfulness: 5,
      communication: 4,
      responsiveness: 3
    },
    comment: ''
  }, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });
  assert(reviewBuyerToSeller1.status === 201, 'Buyer 1 review submitted successfully');
  // average of (5 + 4 + 3) / 3 = 4.0
  assert(reviewBuyerToSeller1.data.rating === 4.0, 'Review overall rating is calculated as direct average: 4.0 ★');
  assert(reviewBuyerToSeller1.data.revieweeRole === 'seller', 'Reviewee role is seller');

  // Test duplicate review prevention
  console.log('\n6. Testing duplicate review prevention...');
  try {
    await axios.post(`${API}/reviews`, {
      conversationId: conv1._id,
      criteria: { respectfulness: 5, communication: 5, responsiveness: 5 }
    }, {
      headers: { Authorization: `Bearer ${buyer1.token}` }
    });
    assert(false, 'Should block duplicate review submission');
  } catch (err) {
    assert(err.response?.status === 400, 'Duplicate review blocked with 400');
  }

  // Verify Seller 1 review status remains pending (Buyer 1 submission does not affect Seller 1)
  console.log('\n7. Verifying independence of buyer and seller reviews...');
  const status1SellerAfterBuyer = await axios.get(`${API}/reviews/status/${conv1._id}`, {
    headers: { Authorization: `Bearer ${seller1.token}` }
  });
  assert(status1SellerAfterBuyer.data.canReview === true, 'Seller 1 review is STILL pending after Buyer 1 submitted');
  assert(status1SellerAfterBuyer.data.hasReviewed === false, 'Seller 1 hasReviewed is false');

  // Seller 1 submits review for Buyer 1 (with comment)
  console.log('\n8. Seller 1 submits review for Buyer 1 (with comment)...');
  const reviewSellerToBuyer1 = await axios.post(`${API}/reviews`, {
    conversationId: conv1._id,
    criteria: {
      respectfulness: 5,
      communication: 5,
      responsiveness: 5
    },
    comment: 'Polite student, offered fair counter-offer even though we could not close.'
  }, {
    headers: { Authorization: `Bearer ${seller1.token}` }
  });
  assert(reviewSellerToBuyer1.data.rating === 5.0, 'Seller review calculated as 5.0 ★');
  assert(reviewSellerToBuyer1.data.revieweeRole === 'buyer', 'Reviewee role is buyer');

  // Test unauthorized user review attempt
  console.log('\n9. Testing unauthorized third-party review attempt...');
  try {
    await axios.post(`${API}/reviews`, {
      conversationId: conv1._id,
      criteria: { respectfulness: 5, communication: 5, responsiveness: 5 }
    }, {
      headers: { Authorization: `Bearer ${outsider.token}` }
    });
    assert(false, 'Third party should NOT be able to review');
  } catch (err) {
    assert(err.response?.status === 403, 'Unauthorized outsider review blocked with 403 Forbidden');
  }

  // 10. Scenario B: Negotiation ends WITH a deal (completed_transaction)
  console.log('\n10. Scenario B: Negotiation ends WITH a deal (completed transaction)...');
  const form2 = new FormData();
  form2.append('title', 'Scientific Calculator FX-991');
  form2.append('description', 'Like new calculator');
  form2.append('price', 900);
  form2.append('category', 'Electronics');
  form2.append('condition', 'Like New');
  form2.append('image', Buffer.from('fake-calc-image'), { filename: 'calc.png', contentType: 'image/png' });

  const listing2Res = await axios.post(`${API}/listings`, form2, {
    headers: { Authorization: `Bearer ${seller1.token}`, ...form2.getHeaders() }
  });
  const listing2 = listing2Res.data;

  // Buyer 2 requests
  const req2Res = await axios.post(`${API}/purchases/${listing2._id}`, {}, {
    headers: { Authorization: `Bearer ${buyer2.token}` }
  });
  const req2 = req2Res.data;

  // Seller accepts for negotiation
  const accept2Res = await axios.put(`${API}/purchases/${req2._id}/accept`, {}, {
    headers: { Authorization: `Bearer ${seller1.token}` }
  });
  const conv2 = accept2Res.data.conversation;

  // Seller confirms sale with Buyer 2
  const confirmSaleRes = await axios.put(`${API}/purchases/${req2._id}/confirm-sale`, {}, {
    headers: { Authorization: `Bearer ${seller1.token}` }
  });
  assert(confirmSaleRes.data.status === 'accepted', 'Sale confirmed with Buyer 2');

  // Check Buyer 2 review status on completed deal
  const status2Buyer = await axios.get(`${API}/reviews/status/${conv2._id}`, {
    headers: { Authorization: `Bearer ${buyer2.token}` }
  });
  assert(status2Buyer.data.interactionType === 'completed_transaction', 'Backend identified completed_transaction');
  assert(status2Buyer.data.applicableCriteria.length === 6, 'Buyer rating seller for completed deal has 6 criteria');
  const buyerCriteriaKeys = status2Buyer.data.applicableCriteria.map(c => c.key);
  assert(
    buyerCriteriaKeys.includes('respectfulness') &&
    buyerCriteriaKeys.includes('communication') &&
    buyerCriteriaKeys.includes('responsiveness') &&
    buyerCriteriaKeys.includes('punctuality') &&
    buyerCriteriaKeys.includes('itemAccuracy') &&
    buyerCriteriaKeys.includes('smoothHandover'),
    'All 6 expected buyer-rates-seller criteria are present'
  );

  // Check Seller 1 review status on completed deal
  const status2Seller = await axios.get(`${API}/reviews/status/${conv2._id}`, {
    headers: { Authorization: `Bearer ${seller1.token}` }
  });
  assert(status2Seller.data.applicableCriteria.length === 6, 'Seller rating buyer for completed deal has 6 criteria');
  const sellerCriteriaKeys = status2Seller.data.applicableCriteria.map(c => c.key);
  assert(
    sellerCriteriaKeys.includes('paymentReliability') &&
    sellerCriteriaKeys.includes('smoothHandover'),
    'Seller-rates-buyer criteria includes payment reliability and smooth handover'
  );

  // Buyer 2 submits completed transaction review for Seller 1
  // ratings: 5, 5, 5, 5, 5, 5 => 5.0
  const reviewBuyerToSeller2 = await axios.post(`${API}/reviews`, {
    conversationId: conv2._id,
    criteria: {
      respectfulness: 5,
      communication: 5,
      responsiveness: 5,
      punctuality: 5,
      itemAccuracy: 5,
      smoothHandover: 5
    },
    comment: 'Great seller, item was in perfect condition as described!'
  }, {
    headers: { Authorization: `Bearer ${buyer2.token}` }
  });
  assert(reviewBuyerToSeller2.data.rating === 5.0, 'Buyer 2 review calculated as 5.0 ★');

  // 11. Verify Independent Seller and Buyer Reputation Updates
  console.log('\n11. Verifying independent seller and buyer reputation scores...');
  const seller1Profile = await axios.get(`${API}/reviews/user/${seller1._id}`, {
    headers: { Authorization: `Bearer ${seller1.token}` }
  });

  // Seller 1 received two reviews as seller: Conv 1 (4.0) and Conv 2 (5.0).
  // Average = (4.0 + 5.0) / 2 = 4.5
  assert(seller1Profile.data.sellerReputation.reviewCount === 2, 'Seller 1 has exactly 2 seller reviews');
  assert(seller1Profile.data.sellerReputation.rating === 4.5, 'Seller 1 seller rating is exactly 4.5 ★');
  assert(seller1Profile.data.sellerReputation.completedTransactions === 1, 'Seller 1 has 1 completed transaction');

  // Buyer 1 reputation:
  const buyer1Profile = await axios.get(`${API}/reviews/user/${buyer1._id}`, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });
  assert(buyer1Profile.data.buyerReputation.reviewCount === 1, 'Buyer 1 has 1 buyer review');
  assert(buyer1Profile.data.buyerReputation.rating === 5.0, 'Buyer 1 buyer rating is 5.0 ★');
  assert(buyer1Profile.data.sellerReputation.reviewCount === 0, 'Buyer 1 seller review count remains 0 (independent)');

  // 12. Verify automatically cancelled pending request cannot receive review
  console.log('\n12. Verifying un-negotiated cancelled requests cannot receive reviews...');
  // Create listing and a pending request that gets cancelled immediately without negotiation
  const form3 = new FormData();
  form3.append('title', 'Lab Coat');
  form3.append('description', 'Chemistry lab coat');
  form3.append('price', 250);
  form3.append('category', 'Hostel Essentials');
  form3.append('condition', 'Good');
  form3.append('image', Buffer.from('fake-coat-image'), { filename: 'coat.png', contentType: 'image/png' });

  const listing3Res = await axios.post(`${API}/listings`, form3, {
    headers: { Authorization: `Bearer ${seller1.token}`, ...form3.getHeaders() }
  });
  const req3Res = await axios.post(`${API}/purchases/${listing3Res.data._id}`, {}, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });
  await axios.put(`${API}/purchases/${req3Res.data._id}/cancel`, {}, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });
  // Verify no conversation exists
  const checkChatRes = await axios.get(`${API}/chats/by-request/${req3Res.data._id}`, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  }).catch(e => e.response);
  assert(checkChatRes.status === 404, 'No conversation exists for non-negotiated cancelled request');

  // 13. Marketplace Listings reputation display and sorting
  console.log('\n13. Verifying Marketplace listings display and reputation sorting...');
  // Create a listing for Seller 2 (Beta) who has 0 reviews (unrated)
  const formBeta = new FormData();
  formBeta.append('title', 'Study Lamp');
  formBeta.append('description', 'Desk lamp for late night studying');
  formBeta.append('price', 300);
  formBeta.append('category', 'Hostel Essentials');
  formBeta.append('condition', 'Good');
  formBeta.append('image', Buffer.from('fake-lamp-image'), { filename: 'lamp.png', contentType: 'image/png' });

  const listingBetaRes = await axios.post(`${API}/listings`, formBeta, {
    headers: { Authorization: `Bearer ${seller2.token}`, ...formBeta.getHeaders() }
  });

  // Query Marketplace
  const marketplaceRes = await axios.get(`${API}/listings`, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });

  // Verify seller data includes reputation fields
  const seller1Listing = marketplaceRes.data.find(l => l.seller?._id === seller1._id);
  assert(seller1Listing && seller1Listing.seller.sellerRating === 4.5, 'Marketplace listing carries sellerRating (4.5)');
  assert(seller1Listing.seller.sellerReviewCount === 2, 'Marketplace listing carries sellerReviewCount (2)');
  assert(seller1Listing.seller.sellerCompletedTransactions === 1, 'Marketplace listing carries sellerCompletedTransactions (1)');

  const seller2Listing = marketplaceRes.data.find(l => l.seller?._id === seller2._id);
  assert(seller2Listing && seller2Listing.seller.sellerReviewCount === 0, 'Seller Beta has 0 reviews (unrated)');

  // Verify Sorting: Rated sellers appear before unrated sellers
  const availableListings = marketplaceRes.data.filter(l => l.status === 'available');
  const indexSeller1 = availableListings.findIndex(l => l.seller?._id === seller1._id);
  const indexSeller2 = availableListings.findIndex(l => l.seller?._id === seller2._id);
  assert(indexSeller1 < indexSeller2, 'Rated Seller Alpha (4.5★) appears BEFORE unrated Seller Beta (New)');

  // 14. Hostel Mode sorting: Same-hostel first, then sorted by rating
  console.log('\n14. Verifying Hostel Mode sorting with reputation...');
  // Buyer 1 is in Hostel A.
  // Seller 1 is in Hostel A (same hostel).
  // Seller 2 is in Hostel B (different hostel).
  const hostelModeListings = await axios.get(`${API}/listings?hostelMode=true`, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });
  const sameHostelItems = hostelModeListings.data.filter(l => (l.hostel || l.seller?.hostel) === 'A');
  const otherHostelItems = hostelModeListings.data.filter(l => (l.hostel || l.seller?.hostel) !== 'A');
  assert(sameHostelItems.length > 0 && otherHostelItems.length > 0, 'Both same-hostel and other-hostel listings present');
  // First item in hostelModeListings must be from Hostel A
  assert((hostelModeListings.data[0].hostel || hostelModeListings.data[0].seller?.hostel) === 'A', 'Hostel Mode displays same-hostel listings first');

  // 15. Seller Requests reputation display and sorting
  console.log('\n15. Verifying Seller Requests display and buyer rating sorting...');
  const sellerRequestsRes = await axios.get(`${API}/purchases/seller`, {
    headers: { Authorization: `Bearer ${seller1.token}` }
  });
  assert(sellerRequestsRes.data.length >= 2, 'Seller 1 sees incoming requests');
  const reqFromBuyer1 = sellerRequestsRes.data.find(r => r.buyer?._id === buyer1._id);
  assert(reqFromBuyer1 && reqFromBuyer1.buyer.buyerRating === 5.0, 'Seller Requests shows buyer rating (5.0 ★)');
  assert(reqFromBuyer1.buyer.buyerReviewCount === 1, 'Seller Requests shows buyer review count (1)');

  console.log('\n================================================================');
  console.log('🎉 ALL 18 RATINGS & REPUTATION TEST CRITERIA PASSED!');
  console.log('================================================================\n');
}

runReputationTests().catch((err) => {
  console.error('\n❌ Test failed with error:', err.response?.data || err.message);
  process.exit(1);
});

