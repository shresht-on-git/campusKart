async function testApi() {
  console.log("Starting API Tests...");
  try {
    console.log("1. Test non-thapar email registration");
    let res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', email: 'test@gmail.com', password: 'pass', hostel: 'A' })
    });
    let data = await res.json();
    console.log("Result: ", data.message);
    
    console.log("\n2. Test thapar email registration");
    let token = '';
    res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', email: 'test@thapar.edu', password: 'pass', hostel: 'A' })
    });
    data = await res.json();
    if(res.ok) {
      console.log("Result: User created", data.email);
      token = data.token;
    } else {
      console.log("Result: ", data.message);
    }
    
    console.log("\n3. Test Login with wrong password");
    res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@thapar.edu', password: 'wrong' })
    });
    data = await res.json();
    console.log("Result: ", data.message);

    console.log("\n4. Test Login with correct credentials");
    res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@thapar.edu', password: 'pass' })
    });
    data = await res.json();
    if(res.ok) {
      console.log("Result: Logged in", data.email);
      token = data.token;
    } else {
      console.log("Result: ", data.message);
    }
    
    console.log("\n5. Test Protected Route with token");
    res = await fetch('http://localhost:5000/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    data = await res.json();
    if(res.ok) {
      console.log("Result: Profile data fetched", data.name);
    } else {
      console.log("Result: ", data.message);
    }
    
    console.log("\n6. Test Protected Route without token");
    res = await fetch('http://localhost:5000/api/auth/me');
    data = await res.json();
    console.log("Result: ", data.message);

  } catch (e) {
    console.log(e);
  }
}

testApi();
