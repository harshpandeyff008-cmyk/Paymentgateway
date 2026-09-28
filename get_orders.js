async function getOrdersList() {
  const base = 'https://payment-gateway-ydl1.onrender.com';
  const headers = { 'x-admin-key': 'shivambhatt@admin' };
  const res = await fetch(`${base}/api/admin/orders?limit=10`, { headers });
  const data = await res.json();
  console.log('Orders in DB:');
  (data.orders || []).forEach(o => {
    console.log(`ID: ${o.id} | Code: ${o.order_code} | ₹${o.amount} | Status: ${o.status} | Created: ${new Date(o.created_at).toLocaleTimeString()} | Expires: ${new Date(o.expires_at).toLocaleTimeString()}`);
  });
}
getOrdersList();
