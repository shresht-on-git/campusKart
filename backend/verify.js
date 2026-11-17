const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_URL = 'http://localhost:5000/api';

async function runTests() {
  try {
    console.log('--- Starting API Verification ---');
    
    const uniqueUser = `testuser_${Date.now()}`;
    const uniqueEmail = `${uniqueUser}@thapar.edu`;
    const password = 'password123';

    // 1. Register
    const regRes = await axios.post(`${API_URL}/auth/register`, {
      name: 'Test User',
      email: uniqueEmail,
      password,
      hostel: 'C'
    });
    console.log('✓ Registration successful');

    // 2. Login
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: uniqueEmail,
      password
    });
    const token = loginRes.data.token;
    console.log('✓ Login successful');

    // Create a dummy image
    const imagePath = path.join(__dirname, 'dummy.jpg');
    fs.writeFileSync(imagePath, 'dummy image data');

    // 3. Create Listing with Image
    const formData = new FormData();
    formData.append('title', 'Test Listing');
    formData.append('description', 'Test Description');
    formData.append('price', 100);
    formData.append('category', 'Books');
    formData.append('condition', 'New');
    formData.append('image', fs.createReadStream(imagePath));

    const createRes = await axios.post(`${API_URL}/listings`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });
    const listingId = createRes.data._id;
    console.log('✓ Listing created with image:', createRes.data.images);

    // 4. Try creating listing without image (should fail)
    try {
      await axios.post(`${API_URL}/listings`, { title: 'No Image' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✗ Failed: Created listing without image');
    } catch (err) {
      console.log('✓ Listing creation rejected when no image is provided');
    }

    // 5. Fetch Listings (Check seller population)
    const getRes = await axios.get(`${API_URL}/listings`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listing = getRes.data.find(l => l._id === listingId);
    
    if (listing && listing.seller && listing.seller.name && listing.seller.hostel) {
      console.log('✓ Seller populated in listings:', listing.seller);
    } else {
      console.log('✗ Seller population failed:', listing ? listing.seller : 'not found');
    }

    // Cleanup
    fs.unlinkSync(imagePath);
    console.log('--- API Verification Complete ---');
  } catch (error) {
    console.error('Test failed:', error.response ? error.response.data : error.message);
  }
}

runTests();
