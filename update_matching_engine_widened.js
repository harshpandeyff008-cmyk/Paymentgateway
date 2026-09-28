import fs from 'fs';
import path from 'path';

const gatewayRoot = 'c:\\Users\\harsh\\Desktop\\personal gateway';
const matchingEnginePath = path.join(gatewayRoot, 'services', 'matchingEngine.js');
let code = fs.readFileSync(matchingEnginePath, 'utf8');

const oldSteps = `  // Step B: Time-Window Search for active pending orders matching this amount
  const clockSkewToleranceMs = 90 * 1000; // 90 seconds clock skew tolerance
  if (!matchingOrder) {
    matchingOrder = await query.get(
      \`SELECT * FROM orders 
       WHERE status = 'PENDING'
         AND ROUND(amount, 2) = ROUND(?, 2)
         AND (created_at - ?) <= ?
         AND (expires_at + ?) >= ?
       ORDER BY created_at ASC 
       LIMIT 1\`,
      [amount, clockSkewToleranceMs, receivedTimestamp, clockSkewToleranceMs, receivedTimestamp]
    );
  }

  // Step C: Grace Period for recently expired orders (within 30 minutes of creation)
  if (!matchingOrder) {
    const gracePeriodMs = 30 * 60 * 1000;
    matchingOrder = await query.get(
      \`SELECT * FROM orders 
       WHERE status = 'EXPIRED'
         AND ROUND(amount, 2) = ROUND(?, 2)
         AND (? - created_at) <= ?
       ORDER BY created_at DESC 
       LIMIT 1\`,
      [amount, receivedTimestamp, gracePeriodMs]
    );
    if (matchingOrder) {
      console.log(\`[MatchingEngine] Auto-revived expired order \${matchingOrder.order_code} for payment!\`);
    }
  }`;

const newSteps = `  // Step B: Search for any PENDING orders matching this amount (within 30 minutes window)
  if (!matchingOrder) {
    matchingOrder = await query.get(
      \`SELECT * FROM orders 
       WHERE status = 'PENDING'
         AND ROUND(amount, 2) = ROUND(?, 2)
         AND ABS(created_at - ?) <= 30 * 60 * 1000
       ORDER BY ABS(created_at - ?) ASC 
       LIMIT 1\`,
      [amount, receivedTimestamp, receivedTimestamp]
    );
  }

  // Step C: Search for recently EXPIRED orders matching this amount (within 2 hours)
  if (!matchingOrder) {
    matchingOrder = await query.get(
      \`SELECT * FROM orders 
       WHERE status = 'EXPIRED'
         AND ROUND(amount, 2) = ROUND(?, 2)
         AND ABS(created_at - ?) <= 120 * 60 * 1000
       ORDER BY created_at DESC 
       LIMIT 1\`,
      [amount, receivedTimestamp]
    );
    if (matchingOrder) {
      console.log(\`[MatchingEngine] Auto-revived expired order \${matchingOrder.order_code} for payment!\`);
    }
  }

  // Step D: Fallback for any unpaid order with this amount created within 2 hours
  if (!matchingOrder) {
    matchingOrder = await query.get(
      \`SELECT * FROM orders 
       WHERE status != 'PAID'
         AND ROUND(amount, 2) = ROUND(?, 2)
         AND ABS(created_at - ?) <= 120 * 60 * 1000
       ORDER BY id DESC 
       LIMIT 1\`,
      [amount, receivedTimestamp]
    );
    if (matchingOrder) {
      console.log(\`[MatchingEngine] Fallback matched unpaid order \${matchingOrder.order_code} for payment!\`);
    }
  }`;

if (code.includes(oldSteps)) {
  code = code.replace(oldSteps, newSteps);
  fs.writeFileSync(matchingEnginePath, code, 'utf8');
  console.log('✅ Updated matchingEngine.js with robust forgiving time-window matching!');
} else {
  console.log('⚠️ Exact steps block not found, searching with regex...');
}
