import { initDatabase, closeDatabase, query } from '../personal gateway/db/database.js';

async function check() {
  await initDatabase();
  const orders = await query.all('SELECT * FROM orders');
  console.log('Total orders in local SQLite:', orders.length);
  orders.forEach(o => {
    console.log(`[${o.id}] Code: ${o.order_code}, Amount: ₹${o.amount}, Status: ${o.status}, CreatedAt: ${o.created_at} (${new Date(o.created_at).toISOString()})`);
  });
  await closeDatabase();
}
check();
