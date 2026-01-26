const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

async function checkOrders() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('story-db');
    
    console.log('🔍 Checking for orders...');
    const allOrders = await db.collection('orders').find({}).limit(5).sort({createdAt: -1}).toArray();
    
    if (allOrders.length === 0) {
      console.log('❌ No orders found in the database.');
    } else {
      console.log(`✅ Found ${allOrders.length} recent orders.`);
      allOrders.forEach(o => {
        console.log(`- Order: ${o._id}, UserID: ${o.userId}, Email: ${o.shippingAddress?.email}, Status: ${o.status}`);
      });
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await client.close();
  }
}

checkOrders();
