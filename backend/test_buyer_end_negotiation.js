const axios = require('axios');
const { io } = require('../frontend/node_modules/socket.io-client');
const FormData = require('form-data');

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

async function runBuyerEndNegotiationTest() {
  console.log('================================================================');
  console.log('🧪 CAMPUSKART MODULE 3 — BUYER END NEGOTIATION TEST');
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
  console.log('1. Setting up 1 Seller and 3 Buyers...');
  const seller = await getAuthUser('Prof Seller', `seller_${ts}@thapar.edu`, 'H');
  const buyerA = await getAuthUser('Buyer Alice', `alice_${ts}@thapar.edu`, 'A');
  const buyerB = await getAuthUser('Buyer Bob', `bob_${ts}@thapar.edu`, 'B');
  const buyerC = await getAuthUser('Buyer Charlie', `charlie_${ts}@thapar.edu`, 'C');
  assert(seller.token && buyerA.token && buyerB.token && buyerC.token, 'All 4 test users authenticated');

  // Step 1: Seller creates listing
  console.log('\n2. Seller creates a Scientific Calculator listing for ₹1,200...');
  const form = new FormData();
  form.append('title', 'Casio FX-991EX ClassWiz');
  form.append('description', 'Authentic scientific calculator for engineering students');
  form.append('price', 1200);
  form.append('category', 'Electronics');
  form.append('condition', 'Like New');
  form.append('image', Buffer.from('fake-calc-image'), { filename: 'calculator.png', contentType: 'image/png' });

  const listingRes = await axios.post(`${API}/listings`, form, {
    headers: { Authorization: `Bearer ${seller.token}`, ...form.getHeaders() }
  });
  const listing = listingRes.data;
  assert(listing._id && listing.status === 'available', 'Listing created with status: available');

  // Step 2: All 3 buyers submit purchase requests
  console.log('\n3. Buyers Alice (A), Bob (B), and Charlie (C) submit purchase requests...');
  const [resA, resB, resC] = await Promise.all([
    axios.post(`${API}/purchases/${listing._id}`, {}, { headers: { Authorization: `Bearer ${buyerA.token}` } }),
    axios.post(`${API}/purchases/${listing._id}`, {}, { headers: { Authorization: `Bearer ${buyerB.token}` } }),
    axios.post(`${API}/purchases/${listing._id}`, {}, { headers: { Authorization: `Bearer ${buyerC.token}` } })
  ]);
  const reqA = resA.data;
  const reqB = resB.data;
  const reqC = resC.data;
  assert(reqA.status === 'pending' && reqB.status === 'pending' && reqC.status === 'pending', 'All 3 requests are pending');

  // Step 3: Seller accepts all 3 with Accept & Chat
  console.log('\n4. Seller accepts all 3 buyers for negotiation (Accept & Chat)...');
  const [acceptA, acceptB, acceptC] = await Promise.all([
    axios.put(`${API}/purchases/${reqA._id}/accept`, {}, { headers: { Authorization: `Bearer ${seller.token}` } }),
    axios.put(`${API}/purchases/${reqB._id}/accept`, {}, { headers: { Authorization: `Bearer ${seller.token}` } }),
    axios.put(`${API}/purchases/${reqC._id}/accept`, {}, { headers: { Authorization: `Bearer ${seller.token}` } })
  ]);

  const convA_id = acceptA.data.conversation._id;
  const convB_id = acceptB.data.conversation._id;
  const convC_id = acceptC.data.conversation._id;

  assert(acceptA.data.request.status === 'negotiating' && convA_id, 'Buyer A accepted for negotiation with conversation created');
  assert(acceptB.data.request.status === 'negotiating' && convB_id, 'Buyer B accepted for negotiation with conversation created');
  assert(acceptC.data.request.status === 'negotiating' && convC_id, 'Buyer C accepted for negotiation with conversation created');

  // Step 4: Verify listing remains available during multi-buyer negotiations
  const checkListing1 = await axios.get(`${API}/listings/${listing._id}`, { headers: { Authorization: `Bearer ${seller.token}` } });
  assert(checkListing1.data.status === 'available', 'Listing remains available while 3 buyers negotiate');

  // Step 5: Setup Socket.IO connections and exchange initial messages
  console.log('\n5. Setting up real-time sockets and exchanging negotiation messages...');
  const socketAlice = io(SOCKET_URL, { auth: { token: buyerA.token } });
  const socketBob = io(SOCKET_URL, { auth: { token: buyerB.token } });
  const socketCharlie = io(SOCKET_URL, { auth: { token: buyerC.token } });
  const socketSeller = io(SOCKET_URL, { auth: { token: seller.token } });

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 4) resolve();
    };
    socketAlice.on('connect', check);
    socketBob.on('connect', check);
    socketCharlie.on('connect', check);
    socketSeller.on('connect', check);
  });
  console.log('  ✓ All 4 sockets connected');

  [socketAlice, socketBob, socketCharlie, socketSeller].forEach((s, idx) => {
    s.on('error', (err) => console.error(`  Socket[${idx}] error:`, err));
  });

  const aliceJoinPromise = new Promise((resolve) => socketAlice.once('joined-conversation', resolve));
  const bobJoinPromise = new Promise((resolve) => socketBob.once('joined-conversation', resolve));
  const charlieJoinPromise = new Promise((resolve) => socketCharlie.once('joined-conversation', resolve));

  // Join rooms
  socketAlice.emit('join-conversation', convA_id.toString());
  socketBob.emit('join-conversation', convB_id.toString());
  socketCharlie.emit('join-conversation', convC_id.toString());
  socketSeller.emit('join-conversation', convA_id.toString());
  socketSeller.emit('join-conversation', convB_id.toString());
  socketSeller.emit('join-conversation', convC_id.toString());

  await Promise.all([aliceJoinPromise, bobJoinPromise, charlieJoinPromise]);
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.log('  ✓ Sockets successfully joined room channels');

  // Send negotiation messages
  await axios.post(`${API}/chats/${convA_id}/messages`, { message: 'Alice: Can you do ₹950?' }, { headers: { Authorization: `Bearer ${buyerA.token}` } });
  await axios.post(`${API}/chats/${convB_id}/messages`, { message: 'Bob: I can pay ₹1,050 cash today!' }, { headers: { Authorization: `Bearer ${buyerB.token}` } });
  await axios.post(`${API}/chats/${convC_id}/messages`, { message: 'Charlie: Will you take ₹1,100?' }, { headers: { Authorization: `Bearer ${buyerC.token}` } });
  console.log('  ✓ Initial messages exchanged in all 3 conversations');

  // Step 6: Security Verification for Buyer End Negotiation endpoint
  console.log('\n6. Testing Security Constraints on Buyer End Negotiation...');

  // 6a: Seller attempts to call buyer-end-negotiation (must be 403)
  try {
    await axios.put(`${API}/purchases/${reqA._id}/buyer-end-negotiation`, {}, {
      headers: { Authorization: `Bearer ${seller.token}` }
    });
    assert(false, 'Seller should NOT be able to call buyer-end-negotiation');
  } catch (err) {
    assert(err.response?.status === 403, 'Seller calling buyer-end-negotiation correctly returned 403 Forbidden');
  }

  // 6b: Buyer B attempts to end Buyer A's negotiation (must be 403)
  try {
    await axios.put(`${API}/purchases/${reqA._id}/buyer-end-negotiation`, {}, {
      headers: { Authorization: `Bearer ${buyerB.token}` }
    });
    assert(false, 'Buyer B should NOT be able to end Buyer A negotiation');
  } catch (err) {
    assert(err.response?.status === 403, 'Buyer B calling buyer-end-negotiation for Buyer A correctly returned 403 Forbidden');
  }

  // Step 7: Buyer A ends their own negotiation
  console.log('\n7. Buyer A ends their own negotiation...');
  let aliceClosedEvent = null;
  let sellerClosedEventForA = null;

  socketAlice.on('conversation-closed', (data) => {
    aliceClosedEvent = data;
  });
  socketSeller.on('conversation-closed', (data) => {
    if (data.conversationId === convA_id) {
      sellerClosedEventForA = data;
    }
  });

  const buyerEndRes = await axios.put(`${API}/purchases/${reqA._id}/buyer-end-negotiation`, {}, {
    headers: { Authorization: `Bearer ${buyerA.token}` }
  });
  assert(buyerEndRes.data.pendingSellerDecision === true, 'Buyer A request status updated to pendingSellerDecision: true');

  // Give socket event a fraction of a second to arrive
  await new Promise((r) => setTimeout(r, 600));

  assert(aliceClosedEvent && aliceClosedEvent.reason.includes('Buyer ended negotiation'), 'Alice received conversation-closed socket event with buyer ended reason');
  assert(sellerClosedEventForA && sellerClosedEventForA.reason.includes('Buyer ended negotiation'), 'Seller received conversation-closed socket event for Conv A');

  // Verify conversation A is closed in database
  const convA_check = await axios.get(`${API}/chats/${convA_id}`, { headers: { Authorization: `Bearer ${buyerA.token}` } });
  assert(convA_check.data.status === 'closed', 'Conversation A status is closed');
  assert(convA_check.data.closedReason.includes('Buyer ended negotiation'), 'Conversation A closedReason contains "Buyer ended negotiation"');

  // Verify conversation A is read-only (messages cannot be sent)
  try {
    await axios.post(`${API}/chats/${convA_id}/messages`, { message: 'Alice: Wait, one more offer!' }, { headers: { Authorization: `Bearer ${buyerA.token}` } });
    assert(false, 'Closed conversation should NOT accept new messages');
  } catch (err) {
    assert(err.response?.status === 400, 'Sending message to closed Conversation A correctly rejected with 400');
  }

  // Step 8: Verify Buyer B and Buyer C negotiations are completely unaffected
  console.log('\n8. Verifying Buyer B and Buyer C negotiations are protected and unaffected...');
  const reqB_check = await axios.get(`${API}/purchases/check/${listing._id}`, { headers: { Authorization: `Bearer ${buyerB.token}` } });
  assert(reqB_check.data.status === 'negotiating', 'Buyer B request remains negotiating');

  const reqC_check = await axios.get(`${API}/purchases/check/${listing._id}`, { headers: { Authorization: `Bearer ${buyerC.token}` } });
  assert(reqC_check.data.status === 'negotiating', 'Buyer C request remains negotiating');

  const convB_check = await axios.get(`${API}/chats/${convB_id}`, { headers: { Authorization: `Bearer ${buyerB.token}` } });
  assert(convB_check.data.status === 'open', 'Conversation B remains open');

  const convC_check = await axios.get(`${API}/chats/${convC_id}`, { headers: { Authorization: `Bearer ${buyerC.token}` } });
  assert(convC_check.data.status === 'open', 'Conversation C remains open');

  // Verify listing remains available
  const checkListing2 = await axios.get(`${API}/listings/${listing._id}`, { headers: { Authorization: `Bearer ${seller.token}` } });
  assert(checkListing2.data.status === 'available', 'Listing is still available');

  // Verify Buyer B and C can still chat with seller
  const msgB = await axios.post(`${API}/chats/${convB_id}/messages`, { message: 'Bob: I can meet you at the library.' }, { headers: { Authorization: `Bearer ${buyerB.token}` } });
  assert(msgB.data.message === 'Bob: I can meet you at the library.', 'Buyer B can still send messages to seller');

  const msgC = await axios.post(`${API}/chats/${convC_id}/messages`, { message: 'Charlie: Counter-offer: ₹1,150!' }, { headers: { Authorization: `Bearer ${buyerC.token}` } });
  assert(msgC.data.message === 'Charlie: Counter-offer: ₹1,150!', 'Buyer C can still send messages to seller');

  // Step 9: Verify repeated call handling on buyer-end-negotiation
  console.log('\n9. Testing repeated call / state safety...');
  try {
    await axios.put(`${API}/purchases/${reqA._id}/buyer-end-negotiation`, {}, {
      headers: { Authorization: `Bearer ${buyerA.token}` }
    });
    assert(false, 'Repeated call on already cancelled request should be rejected');
  } catch (err) {
    assert(err.response?.status === 400, 'Repeated call correctly rejected with 400 (not negotiating)');
  }

  // Step 10: Seller confirms sale with Buyer C
  console.log('\n10. Seller confirms sale with Buyer C (winning buyer)...');
  const confirmRes = await axios.put(`${API}/purchases/${reqC._id}/confirm-sale`, {
    sellerMessage: 'Thank you for your interest! Calculator sold to Charlie.'
  }, {
    headers: { Authorization: `Bearer ${seller.token}` }
  });
  assert(confirmRes.data.status === 'accepted', 'Buyer C request status is accepted');

  // Verify listing status is now sold
  const checkListing3 = await axios.get(`${API}/listings/${listing._id}`, { headers: { Authorization: `Bearer ${seller.token}` } });
  assert(checkListing3.data.status === 'sold', 'Listing status is now sold');

  // Verify Buyer B request was automatically cancelled
  const reqB_final = await axios.get(`${API}/purchases/check/${listing._id}`, { headers: { Authorization: `Bearer ${buyerB.token}` } });
  assert(reqB_final.data.status === 'cancelled', 'Buyer B request automatically cancelled upon sale to Buyer C');

  // Step 11: All conversation histories remain accessible and intact
  console.log('\n11. Verifying all conversation histories remain accessible...');
  const [histA, histB, histC] = await Promise.all([
    axios.get(`${API}/chats/${convA_id}/messages`, { headers: { Authorization: `Bearer ${buyerA.token}` } }),
    axios.get(`${API}/chats/${convB_id}/messages`, { headers: { Authorization: `Bearer ${buyerB.token}` } }),
    axios.get(`${API}/chats/${convC_id}/messages`, { headers: { Authorization: `Bearer ${buyerC.token}` } })
  ]);
  assert(histA.data.messages.length >= 1, 'Buyer A message history fully preserved and readable');
  assert(histB.data.messages.length >= 2, 'Buyer B message history fully preserved and readable');
  assert(histC.data.messages.length >= 2, 'Buyer C message history fully preserved and readable');

  // Cleanup sockets
  socketAlice.disconnect();
  socketBob.disconnect();
  socketCharlie.disconnect();
  socketSeller.disconnect();

  console.log('\n================================================================');
  console.log('🎉 ALL BUYER END NEGOTIATION TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runBuyerEndNegotiationTest().catch((err) => {
  console.error('\n❌ Test failed with error:', err.response?.data || err.message);
  process.exit(1);
});
