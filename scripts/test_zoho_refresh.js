async function test() {
  try {
    console.log("Sending test refresh request to Render proxy...");
    const res = await fetch("https://zoho-proxy-server-xaf9.onrender.com/zoho/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: "dummy_refresh_token_12345" })
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response Body:", text);
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
