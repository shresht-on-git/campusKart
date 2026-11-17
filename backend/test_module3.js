const axios = require('axios');
const API_URL = 'http://localhost:5000/api';
const FormData = require('form-data');

async function runTests() {
  try {
    console.log('--- STARTING ENHANCED MODULE 3 TESTS ---');

    const auth = async (name, email) => {
      try {
        const res = await axios.post(`${API_URL}/auth/register`, { name, email, password: 'password', hostel: 'A' });
        return res.data;
      } catch(err) {
        const res = await axios.post(`${API_URL}/auth/login`, { email, password: 'password' });
        return res.data;
      }
    };

    const sellerA = await auth('Seller A', 'sellera@thapar.edu');
    const buyerB = await auth('Buyer B', 'buyerb@thapar.edu');
    const buyerC = await auth('Buyer C', 'buyerc@thapar.edu');
    const buyerD = await auth('Buyer D', 'buyerd@thapar.edu');

    // Seller creates listing
    const form = new FormData();
    form.append('title', 'Bicycle');
    form.append('description', 'Test Bicycle');
    form.append('price', 3000);
    form.append('category', 'Cycles');
    form.append('condition', 'Good');
    form.append('image', Buffer.from('test'), { filename: 'test.png', contentType: 'image/png' });

    const listingRes = await axios.post(`${API_URL}/listings`, form, { headers: { Authorization: `Bearer ${sellerA.token}`, ...form.getHeaders() } });
    const listingId = listingRes.data._id;
    console.log('Listing created.');

    // Buyers create requests
    const reqB = await axios.post(`${API_URL}/purchases/${listingId}`, {}, { headers: { Authorization: `Bearer ${buyerB.token}` } });
    const reqC = await axios.post(`${API_URL}/purchases/${listingId}`, {}, { headers: { Authorization: `Bearer ${buyerC.token}` } });
    const reqD = await axios.post(`${API_URL}/purchases/${listingId}`, {}, { headers: { Authorization: `Bearer ${buyerD.token}` } });
    console.log('Buyer B, C, D created requests.');

    // Seller accepts Buyer B with message
    await axios.put(`${API_URL}/purchases/${reqB.data._id}/accept`, {
      sellerMessage: 'Sorry, I sold the item to another buyer.'
    }, { headers: { Authorization: `Bearer ${sellerA.token}` } });
    console.log('Seller accepted Buyer B.');

    // Verify Buyer B
    const bCheck = await axios.get(`${API_URL}/purchases/my`, { headers: { Authorization: `Bearer ${buyerB.token}` } });
    const bReq = bCheck.data.find(r => r._id === reqB.data._id);
    if (bReq && bReq.status === 'accepted' && !bReq.sellerMessage) console.log('PASS: Buyer B is accepted without message.');
    else console.log('FAIL: Buyer B state incorrect.', bReq);

    // Verify Buyer C
    const cCheck = await axios.get(`${API_URL}/purchases/my`, { headers: { Authorization: `Bearer ${buyerC.token}` } });
    const cReq = cCheck.data.find(r => r._id === reqC.data._id);
    if (cReq && cReq.status === 'cancelled' && cReq.sellerMessage === 'Sorry, I sold the item to another buyer.') {
      console.log('PASS: Buyer C is cancelled with message.');
    } else console.log('FAIL: Buyer C state incorrect.', cReq);

    // Verify Buyer D
    const dCheck = await axios.get(`${API_URL}/purchases/my`, { headers: { Authorization: `Bearer ${buyerD.token}` } });
    const dReq = dCheck.data.find(r => r._id === reqD.data._id);
    if (dReq && dReq.status === 'cancelled') console.log('PASS: Buyer D is cancelled.');
    else console.log('FAIL: Buyer D state incorrect.', dReq);

    // Verify Listing
    const listingCheck = await axios.get(`${API_URL}/listings/${listingId}`, { headers: { Authorization: `Bearer ${sellerA.token}` } });
    if (listingCheck.data.status === 'sold') console.log('PASS: Listing is sold.');
    else console.log('FAIL: Listing not sold.');

    console.log('--- ALL TESTS COMPLETED ---');
  } catch(e) {
    console.error('ERROR:', e.response?.data || e.message);
  }
}
runTests();
