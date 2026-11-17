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

async function runTwoBuyerTest() {
  console.log('===========================================================');
  console.log('🧪 1-SELLER, 2-BUYER SPECIFIC WORKFLOW TEST');
  console.log('===========================================================\n');

  const getAuthUser = async (name, email) => {
    try {
      const res = await axios.post(`${API}/auth/register`, {
        name,
        email,
        password: 'password123',
        hostel: 'A'
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
  const seller = await getAuthUser('Seller 1', `seller1_${ts}@thapar.edu`);
  const buyer1 = await getAuthUser('Buyer 1', `buyer1_${ts}@thapar.edu`);
  const buyer2 = await getAuthUser('Buyer 2', `buyer2_${ts}@thapar.edu`);

  // Step 0: Create listing
  console.log('Creating listing for Guitar...');
  const form = new FormData();
  form.append('title', 'Acoustic Guitar');
  form.append('description', 'Yamaha F310 in mint condition');
  form.append('price', 6500);
  form.append('category', 'Accessories');
  form.append('condition', 'Like New');
  form.append('image', Buffer.from('guitar-image'), { filename: 'guitar.png', contentType: 'image/png' });

  const listingRes = await axios.post(`${API}/listings`, form, {
    headers: { Authorization: `Bearer ${seller.token}`, ...form.getHeaders() }
  });
  const listingId = listingRes.data._id;
  assert(listingRes.data.status === 'available', 'Listing created and available');

  // Step 1: Both buyers submit requests
  console.log('\nStep 1: Both buyers submit requests');
  const req1 = await axios.post(`${API}/purchases/${listingId}`, {}, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });
  const req2 = await axios.post(`${API}/purchases/${listingId}`, {}, {
    headers: { Authorization: `Bearer ${buyer2.token}` }
  });
  assert(req1.data.status === 'pending' && req2.data.status === 'pending', '1. Both requests submitted with status pending');

  // Step 2: Seller accepts both using Accept & Chat
  console.log('\nStep 2: Seller accepts both using Accept & Chat');
  const accept1 = await axios.put(`${API}/purchases/${req1.data._id}/accept`, {}, {
    headers: { Authorization: `Bearer ${seller.token}` }
  });
  const accept2 = await axios.put(`${API}/purchases/${req2.data._id}/accept`, {}, {
    headers: { Authorization: `Bearer ${seller.token}` }
  });
  assert(accept1.data.request.status === 'negotiating', 'Buyer 1 request transitioned to negotiating');
  assert(accept2.data.request.status === 'negotiating', 'Buyer 2 request transitioned to negotiating');

  // Step 3: Two separate conversations are created
  console.log('\nStep 3: Two separate conversations are created');
  const conv1Id = accept1.data.conversation._id;
  const conv2Id = accept2.data.conversation._id;
  assert(conv1Id && conv2Id && conv1Id.toString() !== conv2Id.toString(), '3. Two distinct conversations created');

  // Step 4: Both negotiations work independently
  console.log('\nStep 4: Both negotiations work independently');
  const s1 = io(SOCKET_URL, { auth: { token: buyer1.token } });
  const s2 = io(SOCKET_URL, { auth: { token: buyer2.token } });
  const sSeller = io(SOCKET_URL, { auth: { token: seller.token } });

  await new Promise(r => setTimeout(r, 400));
  s1.emit('join-conversation', conv1Id);
  s2.emit('join-conversation', conv2Id);
  sSeller.emit('join-conversation', conv1Id);
  sSeller.emit('join-conversation', conv2Id);

  // Send messages in Conv 1
  s1.emit('send-message', { conversationId: conv1Id, message: 'Can you give it for ₹6,000?' });
  await new Promise(r => setTimeout(r, 300));
  sSeller.emit('send-message', { conversationId: conv1Id, message: 'Lowest is ₹6,200.' });
  await new Promise(r => setTimeout(r, 300));

  // Send message in Conv 2
  s2.emit('send-message', { conversationId: conv2Id, message: 'I can take it for full price ₹6,500 today!' });
  await new Promise(r => setTimeout(r, 400));

  const msgs1 = await axios.get(`${API}/chats/${conv1Id}/messages`, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });
  const msgs2 = await axios.get(`${API}/chats/${conv2Id}/messages`, {
    headers: { Authorization: `Bearer ${buyer2.token}` }
  });
  assert(msgs1.data.messages.length === 2, 'Conv 1 has 2 messages');
  assert(msgs2.data.messages.length === 1, 'Conv 2 has 1 message');
  assert(!msgs1.data.messages.some(m => m.message.includes('6,500')), 'Conv 1 does not leak Conv 2 messages');
  assert(!msgs2.data.messages.some(m => m.message.includes('6,000') || m.message.includes('6,200')), 'Conv 2 does not leak Conv 1 messages');

  // Step 5: Seller ends one negotiation; the other remains active
  console.log('\nStep 5: Seller ends one negotiation; the other remains active');
  const end1 = await axios.put(`${API}/purchases/${req1.data._id}/end-negotiation`, {}, {
    headers: { Authorization: `Bearer ${seller.token}` }
  });
  assert(end1.data.status === 'rejected', 'Buyer 1 request transitioned to rejected');

  const checkConv1 = await axios.get(`${API}/chats/${conv1Id}`, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });
  assert(checkConv1.data.status === 'closed', 'Conversation 1 is now closed');

  const checkConv2 = await axios.get(`${API}/chats/${conv2Id}`, {
    headers: { Authorization: `Bearer ${buyer2.token}` }
  });
  assert(checkConv2.data.status === 'open', 'Conversation 2 remains open and active');

  const checkListing = await axios.get(`${API}/listings/${listingId}`, {
    headers: { Authorization: `Bearer ${seller.token}` }
  });
  assert(checkListing.data.status === 'available', 'Listing remains available after ending one negotiation');

  // Step 6: Seller confirms the sale with the remaining buyer
  console.log('\nStep 6: Seller confirms the sale with the remaining buyer');
  const confirmRes = await axios.put(`${API}/purchases/${req2.data._id}/confirm-sale`, {
    sellerMessage: 'Item sold to Buyer 2.'
  }, {
    headers: { Authorization: `Bearer ${seller.token}` }
  });
  assert(confirmRes.data.status === 'accepted', '6. Buyer 2 purchase request confirmed as accepted');

  // Step 7: Listing becomes sold
  console.log('\nStep 7: Listing becomes sold');
  const listingSold = await axios.get(`${API}/listings/${listingId}`, {
    headers: { Authorization: `Bearer ${seller.token}` }
  });
  assert(listingSold.data.status === 'sold', '7. Listing status is sold');

  // Step 8: Other active requests become cancelled
  console.log('\nStep 8: Other active requests become cancelled');
  // (Buyer 1 was already rejected, so it stays rejected without being overwritten or corrupted)
  const req1Final = (await axios.get(`${API}/purchases/my`, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  })).data.find(r => r._id === req1.data._id);
  assert(req1Final.status === 'rejected', '8. Buyer 1 historical rejected record preserved');

  // Step 9: All conversation histories remain accessible but read-only
  console.log('\nStep 9: All conversation histories remain accessible but read-only');
  const history1 = await axios.get(`${API}/chats/${conv1Id}/messages`, {
    headers: { Authorization: `Bearer ${buyer1.token}` }
  });
  const history2 = await axios.get(`${API}/chats/${conv2Id}/messages`, {
    headers: { Authorization: `Bearer ${buyer2.token}` }
  });
  assert(history1.data.messages.length === 2, 'Conv 1 message history accessible');
  assert(history2.data.messages.length === 1, 'Conv 2 message history accessible');

  // Test read-only
  try {
    await axios.post(`${API}/chats/${conv2Id}/messages`, { message: 'Can I still message?' }, {
      headers: { Authorization: `Bearer ${buyer2.token}` }
    });
    assert(false, 'Should block messaging on closed finalized conversation');
  } catch (err) {
    assert(err.response?.status === 400, '9. Blocked new messages on finalized conversation (read-only verified)');
  }

  // Step 10: No new purchase requests are accepted for the sold listing
  console.log('\nStep 10: No new purchase requests are accepted for the sold listing');
  const buyer3 = await getAuthUser('Buyer 3', `buyer3_${ts}@thapar.edu`);
  try {
    await axios.post(`${API}/purchases/${listingId}`, {}, {
      headers: { Authorization: `Bearer ${buyer3.token}` }
    });
    assert(false, 'Should block new purchase requests for sold listing');
  } catch (err) {
    assert(err.response?.status === 400, '10. New purchase requests blocked for sold listing');
  }

  s1.disconnect();
  s2.disconnect();
  sSeller.disconnect();

  console.log('\n===========================================================');
  console.log('🎉 10-STEP TWO-BUYER WORKFLOW VERIFIED SUCCESSFULLY');
  console.log('===========================================================');
}

runTwoBuyerTest().catch(err => {
  console.error('❌ Test failed:', err.response?.data || err.message);
  process.exit(1);
});

