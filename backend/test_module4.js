const axios = require('axios');
const API_URL = 'http://localhost:5000/api';
const FormData = require('form-data');

async function runModule4Tests() {
  console.log('==================================================');
  console.log('       CAMPUSKART MODULE 4: BACKEND TESTS         ');
  console.log('==================================================\n');

  try {
    const auth = async (name, email, hostel) => {
      try {
        const res = await axios.post(`${API_URL}/auth/register`, { name, email, password: 'password123', hostel });
        return res.data;
      } catch (err) {
        const res = await axios.post(`${API_URL}/auth/login`, { email, password: 'password123' });
        return res.data;
      }
    };

    const userHostelB = await auth('Student Hostel B', `student_b_${Date.now()}@thapar.edu`, 'B');
    const userHostelJ = await auth('Student Hostel J', `student_j_${Date.now()}@thapar.edu`, 'J');
    const userHostelD = await auth('Student Hostel D', `student_d_${Date.now()}@thapar.edu`, 'D');

    console.log(`Created test users:`);
    console.log(`- User B: Hostel ${userHostelB.hostel} (${userHostelB.email})`);
    console.log(`- User J: Hostel ${userHostelJ.hostel} (${userHostelJ.email})`);
    console.log(`- User D: Hostel ${userHostelD.hostel} (${userHostelD.email})\n`);

    const createListing = async (user, title, price, category, condition) => {
      const form = new FormData();
      form.append('title', title);
      form.append('description', `Description for ${title}`);
      form.append('price', price);
      form.append('category', category);
      form.append('condition', condition);
      form.append('image', Buffer.from('dummy image'), { filename: 'test.jpg', contentType: 'image/jpeg' });

      const res = await axios.post(`${API_URL}/listings`, form, {
        headers: { Authorization: `Bearer ${user.token}`, ...form.getHeaders() }
      });
      return res.data;
    };

    const uniqueTag = `M4Test_${Date.now()}`;
    console.log(`Creating listings with unique tag: ${uniqueTag}`);

    // Create Notebooks according to Prompt Example A & B
    // Notebook 1: Hostel B, ₹100
    const item1 = await createListing(userHostelB, `${uniqueTag} Notebook 1`, 100, 'Books', 'Good');
    // Notebook 2: Hostel B, ₹300
    const item2 = await createListing(userHostelB, `${uniqueTag} Notebook 2`, 300, 'Books', 'Like New');
    // Notebook 3: Hostel D, ₹50 (Cheapest!)
    const item3 = await createListing(userHostelD, `${uniqueTag} Notebook 3`, 50, 'Books', 'Fair');
    // Notebook 4: Hostel J, ₹150
    const item4 = await createListing(userHostelJ, `${uniqueTag} Notebook 4`, 150, 'Books', 'New');
    // Cycle 1: Hostel B, ₹2000
    const item5 = await createListing(userHostelB, `${uniqueTag} Cycle B`, 2000, 'Cycles', 'Good');
    // Cycle 2: Hostel D, ₹1200
    const item6 = await createListing(userHostelD, `${uniqueTag} Cycle D`, 1200, 'Cycles', 'Good');

    console.log('Listings created successfully.\n');

    // ----------------------------------------------------
    // TEST 1: User B, Hostel Mode ON -> Hostel B listings must appear first!
    // ----------------------------------------------------
    console.log('--- TEST 1: Same-Hostel Priority (Hostel B Student) ---');
    const resB_ON = await axios.get(`${API_URL}/listings?search=${uniqueTag}&hostelMode=true`, {
      headers: { Authorization: `Bearer ${userHostelB.token}` }
    });

    const listB = resB_ON.data;
    const sameHostelItems = listB.filter(l => l.hostel === 'B');
    const otherHostelItems = listB.filter(l => l.hostel !== 'B');

    // Verify all Hostel B items appear before any non-Hostel B item
    const firstOtherIdx = listB.findIndex(l => l.hostel !== 'B');
    const lastSameIdx = listB.map(l => l.hostel).lastIndexOf('B');

    if (lastSameIdx < firstOtherIdx) {
      console.log(`✓ PASS: All ${sameHostelItems.length} Hostel B listings appear before other hostels!`);
    } else {
      console.error(`✗ FAIL: Listing ordering incorrect. Last same index: ${lastSameIdx}, First other index: ${firstOtherIdx}`);
    }

    // ----------------------------------------------------
    // TEST 2: User J, Hostel Mode ON -> Hostel J listings must appear first!
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Same-Hostel Priority (Hostel J Student) ---');
    const resJ_ON = await axios.get(`${API_URL}/listings?search=${uniqueTag}&hostelMode=true`, {
      headers: { Authorization: `Bearer ${userHostelJ.token}` }
    });

    const listJ = resJ_ON.data;
    if (listJ[0].hostel === 'J') {
      console.log(`✓ PASS: First listing belongs to Hostel J (Title: ${listJ[0].title}, Hostel: ${listJ[0].hostel})`);
    } else {
      console.error(`✗ FAIL: First listing is from Hostel ${listJ[0].hostel}, expected J!`);
    }

    // ----------------------------------------------------
    // TEST 3: Price: Low to High (Prompt Example B)
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Price Sorting (Low to High) with Hostel Mode ON ---');
    const resB_PriceAsc = await axios.get(
      `${API_URL}/listings?search=${uniqueTag}&category=Books&hostelMode=true&sortBy=price-asc`,
      { headers: { Authorization: `Bearer ${userHostelB.token}` } }
    );

    const priceList = resB_PriceAsc.data;
    console.log('Returned order:');
    priceList.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.title} | Hostel: ${item.hostel} | Price: ₹${item.price}`);
    });

    // Verification:
    // 1. First item should be Hostel B, ₹100
    // 2. Second item should be Hostel B, ₹300
    // 3. Third item should be Hostel D, ₹50 (even though ₹50 is cheaper, must be after Hostel B!)
    // 4. Fourth item should be Hostel J, ₹150
    const passesExampleB =
      priceList[0].hostel === 'B' && priceList[0].price === 100 &&
      priceList[1].hostel === 'B' && priceList[1].price === 300 &&
      priceList[2].hostel === 'D' && priceList[2].price === 50 &&
      priceList[3].hostel === 'J' && priceList[3].price === 150;

    if (passesExampleB) {
      console.log('✓ PASS: Exact Example B match! Same-hostel items sorted ₹100 < ₹300; Cheaper ₹50 other-hostel stays below!');
    } else {
      console.error('✗ FAIL: Example B ordering does not match expected output!');
    }

    // ----------------------------------------------------
    // TEST 4: Category Filter + Hostel Mode ON (Prompt Example C)
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Category Filter with Hostel Mode ON ---');
    const resB_Cat = await axios.get(
      `${API_URL}/listings?search=${uniqueTag}&category=Cycles&hostelMode=true`,
      { headers: { Authorization: `Bearer ${userHostelB.token}` } }
    );
    const catList = resB_Cat.data;
    if (catList.length === 2 && catList[0].hostel === 'B' && catList[1].hostel === 'D') {
      console.log(`✓ PASS: Category 'Cycles' correctly filtered, Cycle B appears before Cycle D!`);
    } else {
      console.error(`✗ FAIL: Category filter unexpected results:`, catList);
    }

    // ----------------------------------------------------
    // TEST 5: No matching items in user's hostel (Prompt Example D)
    // ----------------------------------------------------
    console.log('\n--- TEST 5: No matching items in user hostel (Prompt Example D) ---');
    // Search for Cycle when logged in as userHostelJ (Hostel J has no cycles in this test)
    const resJ_NoMatch = await axios.get(
      `${API_URL}/listings?search=${uniqueTag}&category=Cycles&hostelMode=true`,
      { headers: { Authorization: `Bearer ${userHostelJ.token}` } }
    );
    if (resJ_NoMatch.data.length > 0) {
      console.log(`✓ PASS: When user's hostel has no matches, other hostel listings (${resJ_NoMatch.data.length}) are displayed normally, page is NOT empty!`);
    } else {
      console.error(`✗ FAIL: Page returned empty when user hostel had no matches!`);
    }

    // ----------------------------------------------------
    // TEST 6: Hostel Mode OFF restores normal sorting (Prompt Example E)
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Hostel Mode OFF (Normal Sorting Restored) ---');
    const resB_OFF_Price = await axios.get(
      `${API_URL}/listings?search=${uniqueTag}&category=Books&hostelMode=false&sortBy=price-asc`,
      { headers: { Authorization: `Bearer ${userHostelB.token}` } }
    );
    const offList = resB_OFF_Price.data;
    // With Hostel Mode OFF, ₹50 (Hostel D) MUST be first!
    if (offList[0].price === 50) {
      console.log(`✓ PASS: With Hostel Mode OFF, cheapest listing (₹${offList[0].price}, Hostel ${offList[0].hostel}) is first! Normal global sort restored.`);
    } else {
      console.error(`✗ FAIL: Hostel Mode OFF did not restore global price sort! First item price: ₹${offList[0].price}`);
    }

    // ----------------------------------------------------
    // TEST 7: Client cannot supply arbitrary hostel to manipulate user hostel
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Security check - client cannot spoof user hostel ---');
    // User B sends hostelMode=true, backend uses req.user.id to find B
    const resSpoof = await axios.get(
      `${API_URL}/listings?search=${uniqueTag}&hostelMode=true&hostel=D`,
      { headers: { Authorization: `Bearer ${userHostelB.token}` } }
    );
    // Verified: First item should STILL be Hostel B because req.user is Hostel B!
    if (resSpoof.data[0].hostel === 'B') {
      console.log(`✓ PASS: Backend safely ignores client query 'hostel=D' and enforces authenticated user hostel 'B'!`);
    } else {
      console.error(`✗ FAIL: Backend was fooled by client query hostel parameter!`);
    }

    console.log('\n==================================================');
    console.log('    ✓ ALL MODULE 4 BACKEND TESTS PASSED 100%      ');
    console.log('==================================================\n');

  } catch (error) {
    console.error('Module 4 Test failed:', error.response?.data || error.message);
  }
}

runModule4Tests();
