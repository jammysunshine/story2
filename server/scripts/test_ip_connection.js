const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testIPConnection() {
  // Try connecting directly to the resolved IP
  const directUri = 'mongodb://jammysunshine:11wMGp1fnrwhZGIQ@159.41.78.29:27017/story-db?retryWrites=true&w=majority&ssl=true';

  console.log('🔗 Trying direct IP connection...');
  console.log('🔌 Connecting to MongoDB...');

  const client = new MongoClient(directUri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 30000
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
}

testIPConnection().catch(console.error);