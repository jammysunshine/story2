const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testDirectConnection() {
  // Extract credentials from current URI
  const currentUri = process.env.MONGODB_URI;
  const match = currentUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^\/]+)\/(.+)/);
  if (match) {
    const [, username, password, , database] = match;
    
    // Construct direct connection string using SRV records
    const hosts = [
      'ac-01qlexd-shard-00-00.qqweu91.mongodb.net:27017',
      'ac-01qlexd-shard-00-01.qqweu91.mongodb.net:27017', 
      'ac-01qlexd-shard-00-02.qqweu91.mongodb.net:27017'
    ];
    
    const directUri = `mongodb://${username}:${password}@${hosts.join(',')}/story-db?retryWrites=true&w=majority&ssl=true`;
    
    console.log('🔗 Trying direct connection string...');
    console.log('🔌 Connecting to MongoDB...');
    
    const client = new MongoClient(directUri, {
      family: 4,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 60000
    });
    
    try {
      await client.connect();
      console.log('✅ Connected to MongoDB');
      
      const db = client.db('story-db');
      const books = db.collection('books');
      
      const unclaimed = await books.countDocuments({
        userId: null,
        status: 'teaser'
      });
      
      console.log(`📊 Found ${unclaimed} unclaimed books`);
      
      // Get details of unclaimed books
      const unclaimedBooks = await books.find({
        userId: null,
        status: 'teaser'
      }).sort({ createdAt: -1 }).limit(10).toArray();
      
      console.log('\n📚 Latest unclaimed books:');
      unclaimedBooks.forEach((book, i) => {
        console.log(`${i+1}. "${book.title}" - ${book.childName} (${book.age}yo)`);
        console.log(`   Created: ${book.createdAt.toISOString()}`);
        console.log(`   Pages: ${book.pages?.length || 0}`);
        console.log('');
      });
      
      return { success: true, unclaimedBooks };
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      return { success: false, error: error.message };
    } finally {
      await client.close();
      console.log('🔒 Connection closed');
    }
  } else {
    console.log('❌ Could not parse current URI');
    return { success: false, error: 'Could not parse URI' };
  }
}

testDirectConnection().catch(console.error);