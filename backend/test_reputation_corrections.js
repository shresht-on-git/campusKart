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

async function runCorrectionsVerification() {
  console.log('================================================================');
  console.log('🔍 CAMPUSKART REPUTATION CORRECTIONS & BUYER WORKFLOW TEST');
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
  console.log('1. Setting up test accounts...');
  const seller = await getAuthUser('Seller Sam', `seller_sam_${ts}@thapar.edu`, 'A');
  const buyer1 = await getAuthUser('Buyer Ben', `buyer_ben_${ts}@thapar.edu`, 'B');
  const buyer2 = await getAuthUser('Buyer Chloe', `buyer_chloe_${ts}@thapar.edu`, 'C');
  assert(seller.token && buyer1.token && buyer2.token, 'All test users authenticated');

  // STEP 1: Verify Profile privacy (hide individual reviews & reviewer identities)
  console.log('\n2. Testing Profile Privacy (collective ratings only)...');
  const profileRes = await axios.get(`${API}/reviews/user/${seller._id}`, {
    headers: { Authorization: `Bearer ${seller.token}` }
  });
  assert(profileRes.data.sellerReputation !== undefined, 'Seller reputation summary returned');
  assert(profileRes.data.buyerReputation !== undefined, 'Buyer reputation summary returned');
  assert(profileRes.data.sellerReputation.reviews === undefined || profileRes.data.sellerReputation.reviews.length === 0, 'No individual seller review cards or identities exposed');
  assert(profileRes.data.buyerReputation.reviews === undefined || profileRes.data.buyerReputation.reviews.length === 0, 'No individual buyer review cards or identities exposed');

  // STEP 2: Create a listing
  console.log('\n3. Seller Sam creates a listing for a Mattress...');
  const form1 = new FormData();
  form1.append('title', 'Single Bed Hostel Mattress');
  form1.append('description', 'Clean cotton mattress');
  form1.append('price', 1500);
  form1.append('category', 'Hostel Essentials');
  form1.append('condition', 'Good');
  form1.append('image', Buffer.from('fake-mattress-img'), { filename: 'mattress.png', contentType: 'image/png' });

  const listingRes = await axios.post(`${API}/listings`, form1, {
    headers: { Authorization: `Bearer ${seller.token}`, ...form1.getHeaders() }
  });
  const listing = listingRes.data;
  assert(listing._id && listing.status === 'available', 'Listing created with status: available');

  // Buyer 1 sends request
  const req1Res = await axios.post(`${API}/purchases/${listing._id}`, {}, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });
  const req1 = req1Res.data;

  // Seller accepts Buyer 1 for negotiation
  const acceptRes = await axios.put(`${API}/purchases/${req1._id}/accept`, {}, {
    headers: { Authorization: `Bearer ${seller.token}` }
  });
  const conv1 = acceptRes.data.conversation;
  assert(conv1._id && acceptRes.data.request.status === 'negotiating', 'Conversation 1 created in negotiating status');

  // Buyer 1 ends their negotiation (deal conducted outside chat or negotiation ended)
  await axios.put(`${API}/purchases/${req1._id}/buyer-end-negotiation`, {}, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });

  // STEP 3: Buyer Review — Select "Transaction Completed" outcome
  console.log('\n4. Testing Buyer Review Option 1: "Transaction Completed"...');
  
  // Test validation: If buyer chooses Transaction Completed, all 6 criteria are required
  try {
    await axios.post(`${API}/reviews`, {
      conversationId: conv1._id,
      interactionType: 'completed_transaction',
      criteria: {
        respectfulness: 5,
        communication: 5,
        responsiveness: 5
        // missing punctuality, itemAccuracy, smoothHandover
      }
    }, {
      headers: { Authorization: `Bearer ${buyer1.token}` }
    });
    assert(false, 'Should reject Transaction Completed review with missing criteria');
  } catch (err) {
    assert(err.response?.status === 400, 'Correctly rejected incomplete 6-criterion transaction review with 400');
  }

  // Buyer submits valid 6-criterion review with interactionType: 'completed_transaction'
  const buyerReviewRes = await axios.post(`${API}/reviews`, {
    conversationId: conv1._id,
    interactionType: 'completed_transaction',
    criteria: {
      respectfulness: 5,
      communication: 4,
      responsiveness: 5,
      punctuality: 4,
      itemAccuracy: 5,
      smoothHandover: 5
    },
    comment: 'Met outside hostel, exchanged cash and item smoothly!'
  }, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });
  assert(buyerReviewRes.status === 201, 'Buyer review submitted successfully');
  assert(buyerReviewRes.data.interactionType === 'completed_transaction', 'Review record stores interactionType: "completed_transaction"');
  // average of (5 + 4 + 5 + 4 + 5 + 5) / 6 = 28 / 6 = 4.666... -> 4.7
  assert(buyerReviewRes.data.rating === 4.7, 'Overall rating calculated as direct average: 4.7 ★');

  // Verify listing safeguard: Buyer selecting "completed_transaction" does NOT mark listing sold!
  console.log('\n5. Verifying Backend Safeguard: Buyer selection does NOT mark listing sold...');
  const checkListing1 = await axios.get(`${API}/listings/${listing._id}`, {
    headers: { Authorization: `Bearer ${seller.token}` }
  });
  assert(checkListing1.data.status === 'available', 'Listing remains AVAILABLE (buyer review does not bypass seller confirm sale)');

  // Verify completed transaction count safeguard:
  // Since seller did NOT confirm sale on this request, completedTransactions for seller remains 0!
  const sellerRepCheck = await axios.get(`${API}/reviews/user/${seller._id}`, {
    headers: { Authorization: `Bearer ${seller.token}` }
  });
  assert(sellerRepCheck.data.sellerReputation.reviewCount === 1, 'Seller has 1 review');
  assert(sellerRepCheck.data.sellerReputation.rating === 4.7, 'Seller rating is 4.7 ★');
  assert(sellerRepCheck.data.sellerReputation.completedTransactions === 0, 'Seller completedTransactions remains 0 (based on confirmed sales, not buyer declaration)');

  // STEP 4: Independent Outcome Selection — Seller reviews with different outcome
  console.log('\n6. Testing Independent Outcome Selection: Seller reviews Buyer 1 as "negotiation"...');
  // Seller selects 'negotiation' with 3 criteria
  const sellerReviewRes = await axios.post(`${API}/reviews`, {
    conversationId: conv1._id,
    interactionType: 'negotiation',
    criteria: {
      respectfulness: 5,
      communication: 5,
      responsiveness: 4
    },
    comment: 'Good communication.'
  }, {
    headers: { Authorization: `Bearer ${seller.token}` }
  });
  assert(sellerReviewRes.status === 201, 'Seller review submitted independently with outcome "negotiation"');
  assert(sellerReviewRes.data.interactionType === 'negotiation', 'Seller review stored with interactionType: "negotiation"');
  // (5 + 5 + 4) / 3 = 14 / 3 = 4.666... -> 4.7
  assert(sellerReviewRes.data.rating === 4.7, 'Seller review calculated as 4.7 ★');

  // STEP 5: Buyer 2 tests Option 2: "Negotiation Only — No Transaction"
  console.log('\n7. Testing Buyer Review Option 2: "Negotiation Only — No Transaction"...');
  const req2Res = await axios.post(`${API}/purchases/${listing._id}`, {}, {
    headers: { Authorization: `Bearer ${buyer2.token}` }
  });
  const accept2Res = await axios.put(`${API}/purchases/${req2Res.data._id}/accept`, {}, {
    headers: { Authorization: `Bearer ${seller.token}` }
  });
  const conv2 = accept2Res.data.conversation;

  // Buyer 2 ends negotiation
  await axios.put(`${API}/purchases/${req2Res.data._id}/buyer-end-negotiation`, {}, {
    headers: { Authorization: `Bearer ${buyer2.token}` }
  });

  // Buyer 2 submits review with "negotiation" outcome (3 criteria)
  const buyer2ReviewRes = await axios.post(`${API}/reviews`, {
    conversationId: conv2._id,
    interactionType: 'negotiation',
    criteria: {
      respectfulness: 4,
      communication: 4,
      responsiveness: 4
    },
    comment: '' // optional comment left empty
  }, {
    headers: { Authorization: `Bearer ${buyer2.token}` }
  });
  assert(buyer2ReviewRes.status === 201, 'Buyer 2 negotiation-only review submitted');
  assert(buyer2ReviewRes.data.interactionType === 'negotiation', 'Buyer 2 review stored as "negotiation"');
  assert(buyer2ReviewRes.data.rating === 4.0, 'Buyer 2 rating is 4.0 ★');

  // STEP 6: Seller Official Confirm Sale workflow continues working
  console.log('\n8. Verifying Seller Confirm Sale Workflow & Completed Transactions Count...');
  // Create another listing for Guitar
  const form2 = new FormData();
  form2.append('title', 'Acoustic Guitar');
  form2.append('description', 'Yamaha F310');
  form2.append('price', 4000);
  form2.append('category', 'Sports');
  form2.append('condition', 'Like New');
  form2.append('image', Buffer.from('fake-guitar-img'), { filename: 'guitar.png', contentType: 'image/png' });

  const listing2Res = await axios.post(`${API}/listings`, form2, {
    headers: { Authorization: `Bearer ${seller.token}`, ...form2.getHeaders() }
  });
  const req3Res = await axios.post(`${API}/purchases/${listing2Res.data._id}`, {}, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });
  await axios.put(`${API}/purchases/${req3Res.data._id}/accept`, {}, {
    headers: { Authorization: `Bearer ${seller.token}` }
  });

  // Seller officially confirms sale
  const confirmRes = await axios.put(`${API}/purchases/${req3Res.data._id}/confirm-sale`, {}, {
    headers: { Authorization: `Bearer ${seller.token}` }
  });
  assert(confirmRes.data.status === 'accepted', 'Sale officially confirmed by seller');

  // Check seller's completed transaction count now increments to 1!
  const sellerFinalRep = await axios.get(`${API}/reviews/user/${seller._id}`, {
    headers: { Authorization: `Bearer ${seller.token}` }
  });
  assert(sellerFinalRep.data.sellerReputation.completedTransactions === 1, 'Seller completedTransactions is now 1 after official confirm sale');
  // Seller review count is 2 (from buyer1 and buyer2 reviews)
  assert(sellerFinalRep.data.sellerReputation.reviewCount === 2, 'Seller review count is 2');

  console.log('\n================================================================');
  console.log('🎉 ALL REPUTATION CORRECTIONS & SAFEGUARDS VERIFIED 100%!');
  console.log('================================================================\n');
}

runCorrectionsVerification().catch((err) => {
  console.error('\n❌ Test failed with error:', err.response?.data || err.message);
  process.exit(1);
});
