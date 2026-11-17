const axios = require('axios');
const { io } = require('../frontend/node_modules/socket.io-client');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

async function runAllTests() {
  console.log('====================================================');
  console.log('🚀 CAMPUSKART MODULE 3 ENHANCEMENT — FULL VERIFICATION');
  console.log('====================================================\n');

  // Helper for registering or logging in test accounts
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

  const timestamp = Date.now();
  console.log('1. Setting up 4 test accounts...');
  const sellerA = await getAuthUser('Seller A', `sellera_${timestamp}@thapar.edu`, 'A');
  const buyerB = await getAuthUser('Buyer B', `buyerb_${timestamp}@thapar.edu`, 'B');
  const buyerC = await getAuthUser('Buyer C', `buyerc_${timestamp}@thapar.edu`, 'C');
  const buyerD = await getAuthUser('Buyer D', `buyerd_${timestamp}@thapar.edu`, 'D');
  assert(sellerA.token && buyerB.token && buyerC.token && buyerD.token, 'All 4 users authenticated successfully');

  // STEP 1: Seller A creates a bicycle listing
  console.log('\n2. Seller A creates a Bicycle listing for ₹5,000...');
  const form = new FormData();
  form.append('title', 'Campus Bicycle');
  form.append('description', 'Hero Sprint bicycle in great condition for daily campus commute');
  form.append('price', 5000);
  form.append('category', 'Cycles');
  form.append('condition', 'Good');
  
  // Create dummy image buffer
  const dummyImg = Buffer.from('fake-image-bytes-for-test');
  form.append('image', dummyImg, { filename: 'bicycle.png', contentType: 'image/png' });

  const listingRes = await axios.post(`${API}/listings`, form, {
    headers: { Authorization: `Bearer ${sellerA.token}`, ...form.getHeaders() }
  });
  const listing = listingRes.data;
  assert(listing._id && listing.status === 'available' && listing.price === 5000, 'Listing created with status: available, price: ₹5,000');

  // STEP 2: Buyer B, Buyer C, Buyer D submit purchase requests
  console.log('\n3. Buyers B, C, and D submit independent purchase requests...');
  const reqB_res = await axios.post(`${API}/purchases/${listing._id}`, {}, {
    headers: { Authorization: `Bearer ${buyerB.token}` }
  });
  assert(reqB_res.data.status === 'pending', 'Buyer B request submitted (status: pending)');

  const reqC_res = await axios.post(`${API}/purchases/${listing._id}`, {}, {
    headers: { Authorization: `Bearer ${buyerC.token}` }
  });
  assert(reqC_res.data.status === 'pending', 'Buyer C request submitted (status: pending)');

  const reqD_res = await axios.post(`${API}/purchases/${listing._id}`, {}, {
    headers: { Authorization: `Bearer ${buyerD.token}` }
  });
  assert(reqD_res.data.status === 'pending', 'Buyer D request submitted (status: pending)');

  // Verify duplicate active request prevention
  try {
    await axios.post(`${API}/purchases/${listing._id}`, {}, {
      headers: { Authorization: `Bearer ${buyerB.token}` }
    });
    assert(false, 'Should have blocked duplicate request from Buyer B');
  } catch (err) {
    assert(err.response?.status === 400, 'Blocked duplicate active request from Buyer B with 400 Bad Request');
  }

  // STEP 3: Seller A checks incoming requests
  console.log('\n4. Seller A views incoming requests on Seller Requests...');
  const sellerReqs_res = await axios.get(`${API}/purchases/seller`, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });
  const requestsForListing = sellerReqs_res.data.filter(r => r.listing?._id === listing._id);
  assert(requestsForListing.length === 3, `Seller A sees all 3 purchase requests (count: ${requestsForListing.length})`);
  assert(requestsForListing.every(r => r.status === 'pending'), 'All 3 requests have pending status');

  // STEP 4: Seller A accepts Buyer B for negotiation (Accept & Chat)
  console.log('\n5. Seller A accepts Buyer B for negotiation (Accept & Chat)...');
  const acceptB_res = await axios.put(`${API}/purchases/${reqB_res.data._id}/accept`, {}, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });
  assert(acceptB_res.data.request.status === 'negotiating', 'Buyer B request status changed to negotiating');
  const convB_id = acceptB_res.data.conversation?._id || acceptB_res.data.request.conversationId;
  assert(convB_id, 'Conversation 1 created for Seller A ↔ Buyer B');

  // Verify listing remains available and others remain pending
  const listingCheck1 = await axios.get(`${API}/listings/${listing._id}`, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });
  assert(listingCheck1.data.status === 'available', 'Listing status remains AVAILABLE during negotiation');

  const sellerReqsAfterB = await axios.get(`${API}/purchases/seller`, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });
  const reqC_check = sellerReqsAfterB.data.find(r => r._id === reqC_res.data._id);
  const reqD_check = sellerReqsAfterB.data.find(r => r._id === reqD_res.data._id);
  assert(reqC_check.status === 'pending' && reqD_check.status === 'pending', 'Buyer C and Buyer D requests remain PENDING');

  // STEP 5: Seller A accepts Buyer C for negotiation (Accept & Chat)
  console.log('\n6. Seller A accepts Buyer C for negotiation (Accept & Chat)...');
  const acceptC_res = await axios.put(`${API}/purchases/${reqC_res.data._id}/accept`, {}, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });
  assert(acceptC_res.data.request.status === 'negotiating', 'Buyer C request status changed to negotiating');
  const convC_id = acceptC_res.data.conversation?._id || acceptC_res.data.request.conversationId;
  assert(convC_id, 'Conversation 2 created for Seller A ↔ Buyer C');
  assert(convB_id.toString() !== convC_id.toString(), 'Conversation 1 and Conversation 2 have distinct IDs');

  // Verify Buyer B is still negotiating and Buyer D is still pending
  const sellerReqsAfterC = await axios.get(`${API}/purchases/seller`, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });
  const reqB_afterC = sellerReqsAfterC.data.find(r => r._id === reqB_res.data._id);
  const reqD_afterC = sellerReqsAfterC.data.find(r => r._id === reqD_res.data._id);
  assert(reqB_afterC.status === 'negotiating', 'Buyer B request is STILL negotiating (unaffected)');
  assert(reqD_afterC.status === 'pending', 'Buyer D request is STILL pending (unaffected)');

  // STEP 6: Multi-buyer messaging and message isolation test via Socket.IO
  console.log('\n7. Real-Time Socket.IO messaging & room isolation test...');
  
  // Connect Buyer B socket
  const socketB = io(SOCKET_URL, { auth: { token: buyerB.token } });
  // Connect Buyer C socket
  const socketC = io(SOCKET_URL, { auth: { token: buyerC.token } });
  // Connect Seller A socket
  const socketA = io(SOCKET_URL, { auth: { token: sellerA.token } });

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Join rooms
  socketB.emit('join-conversation', convB_id);
  socketC.emit('join-conversation', convC_id);
  socketA.emit('join-conversation', convB_id);
  socketA.emit('join-conversation', convC_id);

  let buyerBReceivedMessages = [];
  let buyerCReceivedMessages = [];

  socketB.on('new-message', (msg) => {
    buyerBReceivedMessages.push(msg);
  });

  socketC.on('new-message', (msg) => {
    buyerCReceivedMessages.push(msg);
  });

  await new Promise((resolve) => setTimeout(resolve, 300));

  // Buyer B sends message in Conv 1
  socketB.emit('send-message', {
    conversationId: convB_id,
    message: 'Can you sell it for ₹4,000?'
  });
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Seller A replies to Buyer B in Conv 1
  socketA.emit('send-message', {
    conversationId: convB_id,
    message: 'I can do ₹4,500.'
  });
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Buyer C sends message in Conv 2
  socketC.emit('send-message', {
    conversationId: convC_id,
    message: 'I can pay ₹4,700.'
  });
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Message persistence check via REST
  const msgHistoryB = await axios.get(`${API}/chats/${convB_id}/messages`, {
    headers: { Authorization: `Bearer ${buyerB.token}` }
  });
  assert(msgHistoryB.data.messages.length === 2, `Conversation 1 has exactly 2 messages in MongoDB`);
  assert(msgHistoryB.data.messages[0].message === 'Can you sell it for ₹4,000?', 'Conv 1 Msg 1: "Can you sell it for ₹4,000?"');
  assert(msgHistoryB.data.messages[1].message === 'I can do ₹4,500.', 'Conv 1 Msg 2: "I can do ₹4,500."');

  const msgHistoryC = await axios.get(`${API}/chats/${convC_id}/messages`, {
    headers: { Authorization: `Bearer ${buyerC.token}` }
  });
  assert(msgHistoryC.data.messages.length === 1, `Conversation 2 has exactly 1 message in MongoDB`);
  assert(msgHistoryC.data.messages[0].message === 'I can pay ₹4,700.', 'Conv 2 Msg 1: "I can pay ₹4,700."');

  // Verify message isolation:
  const leakedInC = msgHistoryC.data.messages.some(m => m.message.includes('4,000') || m.message.includes('4,500'));
  const leakedInB = msgHistoryB.data.messages.some(m => m.message.includes('4,700'));
  assert(!leakedInC && !leakedInB, 'ZERO message leakage between Buyer B and Buyer C conversations');

  // STEP 7: Security check - Buyer B cannot read Buyer C conversation
  console.log('\n8. Access control & authorization tests...');
  try {
    await axios.get(`${API}/chats/${convC_id}/messages`, {
      headers: { Authorization: `Bearer ${buyerB.token}` }
    });
    assert(false, 'Should have blocked Buyer B from accessing Buyer C chat');
  } catch (err) {
    assert(err.response?.status === 403, 'Blocked cross-buyer chat access with 403 Forbidden');
  }

  // Buyer cannot call confirm sale
  try {
    await axios.put(`${API}/purchases/${reqC_res.data._id}/confirm-sale`, {}, {
      headers: { Authorization: `Bearer ${buyerC.token}` }
    });
    assert(false, 'Buyer should not be allowed to call confirm-sale');
  } catch (err) {
    assert(err.response?.status === 403, 'Blocked buyer confirm-sale attempt with 403 Forbidden');
  }

  // STEP 8: Seller A confirms sale with Buyer C
  console.log('\n9. Seller A confirms sale with Buyer C (Final Confirm Sale)...');
  const cancellationNote = 'Sorry, I have finalized the deal with another buyer. Thank you for your interest.';
  
  let bWasClosed = false;
  socketB.on('conversation-closed', (data) => {
    bWasClosed = true;
  });

  const confirmRes = await axios.put(`${API}/purchases/${reqC_res.data._id}/confirm-sale`, {
    sellerMessage: cancellationNote
  }, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });
  assert(confirmRes.data.status === 'accepted', 'Buyer C purchase request marked as ACCEPTED');

  // STEP 9: Verify state of listing, winning buyer, and other buyers
  console.log('\n10. Verifying post-sale state across all buyers and listing...');
  
  // Listing sold
  const listingFinal = await axios.get(`${API}/listings/${listing._id}`, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });
  assert(listingFinal.data.status === 'sold', 'Listing status changed to SOLD');

  // Buyer C sees accepted in My Purchases
  const purchasesC = await axios.get(`${API}/purchases/my`, {
    headers: { Authorization: `Bearer ${buyerC.token}` }
  });
  const cPurchase = purchasesC.data.find(r => r._id === reqC_res.data._id);
  assert(cPurchase.status === 'accepted', 'Buyer C sees status: accepted');
  assert(!cPurchase.sellerMessage, 'Accepted buyer C did NOT receive cancellation sellerMessage');

  // Buyer B sees cancelled with seller message in My Purchases
  const purchasesB = await axios.get(`${API}/purchases/my`, {
    headers: { Authorization: `Bearer ${buyerB.token}` }
  });
  const bPurchase = purchasesB.data.find(r => r._id === reqB_res.data._id);
  assert(bPurchase.status === 'cancelled', 'Buyer B negotiating request was auto-CANCELLED');
  assert(bPurchase.sellerMessage === cancellationNote, 'Buyer B received the seller cancellation message');

  // Buyer D sees cancelled with seller message in My Purchases
  const purchasesD = await axios.get(`${API}/purchases/my`, {
    headers: { Authorization: `Bearer ${buyerD.token}` }
  });
  const dPurchase = purchasesD.data.find(r => r._id === reqD_res.data._id);
  assert(dPurchase.status === 'cancelled', 'Buyer D pending request was auto-CANCELLED');
  assert(dPurchase.sellerMessage === cancellationNote, 'Buyer D received the seller cancellation message');

  // STEP 10: Verify closed conversations become read-only
  console.log('\n11. Verifying closed conversations are read-only and reject new messages...');
  const convB_closed = await axios.get(`${API}/chats/${convB_id}`, {
    headers: { Authorization: `Bearer ${buyerB.token}` }
  });
  assert(convB_closed.data.status === 'closed', 'Buyer B conversation status is CLOSED');

  // Attempt to send message in closed conversation via REST
  try {
    await axios.post(`${API}/chats/${convB_id}/messages`, {
      message: 'Hello, are you still there?'
    }, {
      headers: { Authorization: `Bearer ${buyerB.token}` }
    });
    assert(false, 'Should have blocked message in closed conversation');
  } catch (err) {
    assert(err.response?.status === 400, 'Blocked message in closed conversation with 400 Bad Request');
  }

  // All historical messages still accessible
  const msgHistoryB_final = await axios.get(`${API}/chats/${convB_id}/messages`, {
    headers: { Authorization: `Bearer ${buyerB.token}` }
  });
  assert(msgHistoryB_final.data.messages.length === 2, 'Buyer B message history preserved in MongoDB');

  const msgHistoryC_final = await axios.get(`${API}/chats/${convC_id}/messages`, {
    headers: { Authorization: `Bearer ${buyerC.token}` }
  });
  assert(msgHistoryC_final.data.messages.length === 1, 'Buyer C message history preserved in MongoDB');

  // Disconnect sockets
  socketA.disconnect();
  socketB.disconnect();
  socketC.disconnect();

  // STEP 11: Edge cases & Additional tests
  console.log('\n12. Running additional test cases (A-L)...');

  // Test Case A: Seller rejects a pending buyer before chat
  const listingA2 = await (async () => {
    const f = new FormData();
    f.append('title', 'Study Desk');
    f.append('description', 'Wooden study desk');
    f.append('price', 1500);
    f.append('category', 'Hostel Essentials');
    f.append('condition', 'Good');
    f.append('image', dummyImg, { filename: 'desk.png', contentType: 'image/png' });
    const res = await axios.post(`${API}/listings`, f, {
      headers: { Authorization: `Bearer ${sellerA.token}`, ...f.getHeaders() }
    });
    return res.data;
  })();

  const reqB2 = await axios.post(`${API}/purchases/${listingA2._id}`, {}, {
    headers: { Authorization: `Bearer ${buyerB.token}` }
  });
  const reqC2 = await axios.post(`${API}/purchases/${listingA2._id}`, {}, {
    headers: { Authorization: `Bearer ${buyerC.token}` }
  });

  // Reject Buyer B
  const rejectB2 = await axios.put(`${API}/purchases/${reqB2.data._id}/reject`, {}, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });
  assert(rejectB2.data.status === 'rejected', 'Case A: Pending request directly rejected');
  
  // Listing remains available, Buyer C remains pending
  const listingA2_check = await axios.get(`${API}/listings/${listingA2._id}`, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });
  assert(listingA2_check.data.status === 'available', 'Case A: Listing remains available after rejection');

  const reqC2_check = (await axios.get(`${API}/purchases/seller`, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  })).data.find(r => r._id === reqC2.data._id);
  assert(reqC2_check.status === 'pending', 'Case A: Other pending request unaffected');

  // Test Case B: Seller ends an active negotiation (End Negotiation)
  await axios.put(`${API}/purchases/${reqC2.data._id}/accept`, {}, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });
  const endNegRes = await axios.put(`${API}/purchases/${reqC2.data._id}/end-negotiation`, {}, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });
  assert(endNegRes.data.status === 'rejected', 'Case B: End Negotiation changes request to rejected');
  const convC2 = await axios.get(`${API}/chats/by-request/${reqC2.data._id}`, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });
  assert(convC2.data.status === 'closed', 'Case B: End Negotiation closes the conversation');

  // Test Case G: Cannot create purchase request on sold listing
  try {
    await axios.post(`${API}/purchases/${listing._id}`, {}, {
      headers: { Authorization: `Bearer ${buyerD.token}` }
    });
    assert(false, 'Should block request on sold listing');
  } catch (err) {
    assert(err.response?.status === 400, 'Case G: Blocked purchase request on sold listing (400 Bad Request)');
  }

  // Test Case K: Concurrent / simultaneous Confirm Sale protection (Atomic single-winner guard)
  console.log('\n13. Testing concurrency guard on Confirm Sale...');
  const listingConc = await (async () => {
    const f = new FormData();
    f.append('title', 'Calculator');
    f.append('description', 'Scientific Calculator FX-991EX');
    f.append('price', 800);
    f.append('category', 'Electronics');
    f.append('condition', 'Like New');
    f.append('image', dummyImg, { filename: 'calc.png', contentType: 'image/png' });
    const res = await axios.post(`${API}/listings`, f, {
      headers: { Authorization: `Bearer ${sellerA.token}`, ...f.getHeaders() }
    });
    return res.data;
  })();

  const reqConc1 = await axios.post(`${API}/purchases/${listingConc._id}`, {}, {
    headers: { Authorization: `Bearer ${buyerB.token}` }
  });
  const reqConc2 = await axios.post(`${API}/purchases/${listingConc._id}`, {}, {
    headers: { Authorization: `Bearer ${buyerC.token}` }
  });

  await axios.put(`${API}/purchases/${reqConc1.data._id}/accept`, {}, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });
  await axios.put(`${API}/purchases/${reqConc2.data._id}/accept`, {}, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });

  // Fire two confirm-sale calls simultaneously
  const [res1, res2] = await Promise.allSettled([
    axios.put(`${API}/purchases/${reqConc1.data._id}/confirm-sale`, {}, {
      headers: { Authorization: `Bearer ${sellerA.token}` }
    }),
    axios.put(`${API}/purchases/${reqConc2.data._id}/confirm-sale`, {}, {
      headers: { Authorization: `Bearer ${sellerA.token}` }
    })
  ]);

  const oneSucceeded = (res1.status === 'fulfilled' && res2.status === 'rejected') ||
                       (res2.status === 'fulfilled' && res1.status === 'rejected');
  assert(oneSucceeded, 'Case K: Exactly one confirm-sale succeeded and the other was rejected');
  const rejectedError = res1.status === 'rejected' ? res1.reason : res2.reason;
  assert(rejectedError.response?.status === 409, 'Case K: Second confirm-sale received 409 Conflict error');

  // Test Case: Ordinary listing editing cannot bypass Confirm Sale
  console.log('\n14. Testing listing edit & delete safeguards...');
  try {
    await axios.put(`${API}/listings/${listingConc._id}`, { status: 'sold' }, {
      headers: { Authorization: `Bearer ${sellerA.token}` }
    });
    assert(false, 'Should prevent editing a sold listing');
  } catch (err) {
    assert(err.response?.status === 400, 'Blocked direct edit on sold listing (Cannot bypass Confirm Sale)');
  }

  // Test Case: Listing deletion blocked when purchase requests exist
  try {
    await axios.delete(`${API}/listings/${listingConc._id}`, {
      headers: { Authorization: `Bearer ${sellerA.token}` }
    });
    assert(false, 'Should block deleting listing with purchase history');
  } catch (err) {
    assert(err.response?.status === 400, 'Prevented listing deletion from destroying purchase/chat history');
  }

  // STEP 12: Verify Modules 1, 2, and 4
  console.log('\n15. Verifying Modules 1, 2, and 4 integrity...');
  // Module 1: Email domain check
  try {
    await axios.post(`${API}/auth/register`, {
      name: 'External User',
      email: 'external@gmail.com',
      password: 'pass',
      hostel: 'A'
    });
    assert(false, 'Should reject non-thapar email');
  } catch (err) {
    assert(err.response?.status === 400, 'Module 1: Only @thapar.edu allowed for registration');
  }

  // Module 2: Filtering listings
  const filteredListings = await axios.get(`${API}/listings?category=Electronics`, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });
  assert(Array.isArray(filteredListings.data), 'Module 2: Listing query with category filter works');

  // Module 4: Hostel mode parameter supported in backend
  const hostelQuery = await axios.get(`${API}/listings?hostelMode=true`, {
    headers: { Authorization: `Bearer ${sellerA.token}` }
  });
  assert(Array.isArray(hostelQuery.data), 'Module 4: Hostel mode priority query functional');

  console.log('\n====================================================');
  console.log('🎉 ALL TESTS PASSED! MODULE 3 ENHANCEMENT VERIFIED');
  console.log('====================================================');
}

runAllTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err.response?.data || err.message);
  process.exit(1);
});
