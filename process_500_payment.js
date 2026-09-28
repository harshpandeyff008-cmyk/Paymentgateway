async function processRealPayment() {
  const base = 'https://payment-gateway-ydl1.onrender.com';
  const headers = {
    'Content-Type': 'application/json',
    'x-admin-key': 'shivambhatt@admin'
  };

  const body = JSON.stringify({
    amount: 500,
    utr: '661504779893',
    sender: 'SHARNJIT KAUR'
  });

  const res = await fetch(`${base}/api/admin/simulate-payment`, {
    method: 'POST',
    headers,
    body
  });

  const data = await res.json();
  console.log('Result:', JSON.stringify(data, null, 2));
}

processRealPayment();
