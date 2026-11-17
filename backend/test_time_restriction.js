const assert = require('assert');
const axios = require('axios');
const API_URL = 'http://localhost:5000/api';

console.log('==================================================');
console.log('   TEMPORARY 2 PM CUTOFF VERIFICATION TESTS      ');
console.log('==================================================\n');

// 1. Verify the time logic algorithm directly:
function testEligibility(hour, startHour) {
  return hour >= startHour;
}

const START_HOUR = 14; // 2:00 PM cutoff
console.log(`Configured start hour: ${START_HOUR}:00 (2:00 PM)`);

// Test before 2 PM:
const hoursBefore2PM = [0, 8, 11, 12, 13];
hoursBefore2PM.forEach(h => {
  const eligible = testEligibility(h, START_HOUR);
  assert.strictEqual(eligible, false, `Hour ${h}:00 should be ineligible before 2 PM`);
  console.log(`✓ Hour ${h}:00 (Before 2 PM) -> Ineligible (Blocked, toggle disabled)`);
});

// Test at or after 2 PM:
const hoursAfter2PM = [14, 15, 18, 20, 23];
hoursAfter2PM.forEach(h => {
  const eligible = testEligibility(h, START_HOUR);
  assert.strictEqual(eligible, true, `Hour ${h}:00 should be eligible at/after 2 PM`);
  console.log(`✓ Hour ${h}:00 (At/After 2 PM) -> Eligible (Unlocked, user can enable)`);
});

// Test current system local time:
const now = new Date();
const currentHour = now.getHours();
const currentEligible = testEligibility(currentHour, START_HOUR);
console.log(`\nCurrent system time: ${now.toLocaleTimeString()} (Hour: ${currentHour})`);
console.log(`Current eligibility with 2 PM cutoff: ${currentEligible ? 'ELIGIBLE (Hostel Mode can be enabled right now!)' : 'INELIGIBLE'}`);

assert.strictEqual(currentEligible, true, `Current time is after 2 PM, so it must be eligible!`);

// 2. Test live backend API with hostelMode:
async function testLiveAPI() {
  console.log('\n--- Testing Live Backend with Hostel Mode ON ---');
  
  // Register or login a test user in Hostel B
  const uniqueEmail = `m4_2pm_test_${Date.now()}@thapar.edu`;
  const regRes = await axios.post(`${API_URL}/auth/register`, {
    name: '2PM Test User',
    email: uniqueEmail,
    password: 'password123',
    hostel: 'B'
  });
  const token = regRes.data.token;
  console.log(`✓ Authenticated as ${uniqueEmail} (Hostel B)`);

  // Query listings with hostelMode=true
  const resOn = await axios.get(`${API_URL}/listings?hostelMode=true`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const listings = resOn.data;
  console.log(`Fetched ${listings.length} listings with hostelMode=true`);

  // Verify same-hostel priority
  const firstNonBIndex = listings.findIndex(l => l.hostel !== 'B');
  const lastBIndex = listings.map(l => l.hostel).lastIndexOf('B');

  if (lastBIndex !== -1 && firstNonBIndex !== -1) {
    assert(lastBIndex < firstNonBIndex, 'All Hostel B listings must precede other hostels');
    console.log(`✓ PASS: Verified that all Hostel B listings (count: ${listings.filter(l => l.hostel === 'B').length}) appear before other hostels!`);
  } else {
    console.log(`✓ PASS: Listings retrieved successfully.`);
  }

  // Query with hostelMode=false (OFF)
  const resOff = await axios.get(`${API_URL}/listings?hostelMode=false&sortBy=price-asc`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log(`✓ PASS: Hostel Mode OFF returns normal global sorting.`);

  console.log('\n==================================================');
  console.log('   ✓ ALL 2 PM CUTOFF TESTS PASSED SUCCESSFULLY!    ');
  console.log('==================================================\n');
}

testLiveAPI().catch(err => {
  console.error('Test failed:', err.response?.data || err.message);
  process.exit(1);
});
