async function testAuth(email, password) {
  const apiKey = "AIzaSyBcuSIz3NvPh2kU-BziQfjYsGKCMSjeWR4";
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email,
      password: password,
      returnSecureToken: true
    })
  });
  
  const body = await res.json();
  return { status: res.status, body };
}

async function run() {
  console.log("Testing wrong password for hapa1929@gmail.com:");
  const res1 = await testAuth("hapa1929@gmail.com", "wrongpass123");
  console.log("Status:", res1.status, res1.body);

  console.log("\nTesting wrong password for shivambhatt11@gmail.com:");
  const res2 = await testAuth("shivambhatt11@gmail.com", "wrongpass123");
  console.log("Status:", res2.status, res2.body);
}

run();
