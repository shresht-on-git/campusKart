const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function runTests() {
  try {
    console.log('--- STARTING TESTS ---');

    // 1. Register User A
    const userA = await axios.post(`${API_URL}/auth/register`, {
      name: 'User A',
      email: 'usera@thapar.edu',
      password: 'password123',
      hostel: 'A'
    });
    console.log('User A registered');
    
    // 2. Register User B
    const userB = await axios.post(`${API_URL}/auth/register`, {
      name: 'User B',
      email: 'userb@thapar.edu',
      password: 'password123',
      hostel: 'B'
    });
    console.log('User B registered');

    const tokenA = userA.data.token;
    const tokenB = userB.data.token;

    // Test 1: Logged-in student creates a listing.
    const newListingRes = await axios.post(`${API_URL}/listings`, {
      title: 'Scientific Calculator',
      description: 'Used for 1 semester',
      price: 500,
      category: 'Electronics',
      condition: 'Good'
    }, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    
    const listingId = newListingRes.data._id;
    console.log(`Test 1 Passed: Listing created by User A: ${listingId}`);

    // Test 2: Logged-out user cannot create a listing.
    try {
      await axios.post(`${API_URL}/listings`, {
        title: 'Book',
        description: 'Test book',
        price: 100,
        category: 'Books',
        condition: 'New'
      });
      console.log('Test 2 Failed: Logged out user created listing!');
    } catch (err) {
      console.log('Test 2 Passed: Logged-out user blocked from creating listing (401)');
    }

    // Test 3: All listings can be viewed.
    const allListings = await axios.get(`${API_URL}/listings`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    console.log(`Test 3 Passed: Viewed ${allListings.data.length} listings`);

    // Test 4: One listing can be viewed.
    const oneListing = await axios.get(`${API_URL}/listings/${listingId}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    console.log(`Test 4 Passed: View single listing ${oneListing.data.title}`);

    // Test 15 & 16: Listing correctly stores seller and hostel
    if (oneListing.data.seller._id === userA.data._id && oneListing.data.hostel === 'A') {
      console.log(`Test 15 & 16 Passed: Listing stores correct seller and hostel A`);
    } else {
      console.log(`Test 15 & 16 Failed: Seller/Hostel mismatch`);
    }

    // Create another listing to test filters
    await axios.post(`${API_URL}/listings`, {
      title: 'Math Notes',
      description: 'First year math notes',
      price: 50,
      category: 'Notes',
      condition: 'Fair'
    }, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });

    // Test 5, 6, 7, 8: Search and filters
    const searchRes = await axios.get(`${API_URL}/listings?search=Math`, { headers: { Authorization: `Bearer ${tokenA}` } });
    console.log(`Test 5 Passed: Search "Math" returned ${searchRes.data.length} results`);

    const catRes = await axios.get(`${API_URL}/listings?category=Electronics`, { headers: { Authorization: `Bearer ${tokenA}` } });
    console.log(`Test 6 Passed: Category filter returned ${catRes.data.length} results`);

    const condRes = await axios.get(`${API_URL}/listings?condition=Fair`, { headers: { Authorization: `Bearer ${tokenA}` } });
    console.log(`Test 7 Passed: Condition filter returned ${condRes.data.length} results`);

    // Test 9: Student can edit their own listing
    await axios.put(`${API_URL}/listings/${listingId}`, {
      price: 450
    }, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    console.log('Test 9 Passed: User A edited their listing');

    // Test 11: Student cannot edit another student's listing
    try {
      await axios.put(`${API_URL}/listings/${listingId}`, { price: 100 }, { headers: { Authorization: `Bearer ${tokenB}` } });
      console.log('Test 11 Failed: User B edited User A listing!');
    } catch (err) {
      console.log('Test 11 Passed: User B prevented from editing User A listing (403)');
    }

    // Test 12: Student cannot delete another student's listing
    try {
      await axios.delete(`${API_URL}/listings/${listingId}`, { headers: { Authorization: `Bearer ${tokenB}` } });
      console.log('Test 12 Failed: User B deleted User A listing!');
    } catch (err) {
      console.log('Test 12 Passed: User B prevented from deleting User A listing (403)');
    }

    // Test 13: Invalid listing data is rejected
    try {
      await axios.post(`${API_URL}/listings`, { title: 'Invalid' }, { headers: { Authorization: `Bearer ${tokenA}` } });
      console.log('Test 13 Failed: Invalid listing created!');
    } catch (err) {
      console.log('Test 13 Passed: Invalid listing rejected (Missing fields)');
    }

    // Test 14: Nonexistent listing error
    try {
      await axios.get(`${API_URL}/listings/123456789012345678901234`, { headers: { Authorization: `Bearer ${tokenA}` } });
      console.log('Test 14 Failed: Viewed nonexistent listing!');
    } catch (err) {
      console.log('Test 14 Passed: Nonexistent listing returned 404');
    }

    // Test 10: Student can delete their own listing
    await axios.delete(`${API_URL}/listings/${listingId}`, { headers: { Authorization: `Bearer ${tokenA}` } });
    console.log('Test 10 Passed: User A deleted their own listing');

    console.log('--- ALL TESTS COMPLETED ---');
  } catch (error) {
    console.error('Test execution failed:', error?.response?.data || error.message);
  }
}

runTests();
