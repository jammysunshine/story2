const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const USER_EMAIL = 'nidhi.cambridge@gmail.com';

async function transferBooks() {
  console.log('🚀 Starting transfer script...');
  console.log('📧 Target User Email:', USER_EMAIL);

  const MONGODB_URI = process.env.MONGODB_URI || 'REPLACE_WITH_YOUR_MONGODB_URI';
  const client = new MongoClient(MONGODB_URI, { 
    family: 4,
    serverSelectionTimeoutMS: 60000, 
    connectTimeoutMS: 60000,
    maxIdleTimeMS: 120000,
    maxPoolSize: 10
  });
  
  try {
    console.log('📡 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');

    // Access both DBs
    const dbV2 = client.db('story-db-v2');
    const dbMain = client.db('story-db');
    console.log('📚 Got DB references: v2=', dbV2.databaseName, 'main=', dbMain.databaseName);

    // Get existing book titles for the target user to avoid duplicates
    console.log('🔍 Fetching existing book titles for target user...');
    const existingBooks = await dbMain.collection('books').find({ userId: USER_EMAIL }).toArray();
    const existingTitles = new Set(existingBooks.map(b => b.title));
    console.log(`📋 Found ${existingTitles.size} existing book titles for user ${USER_EMAIL}`);

    // Use aggregation pipeline to get all books efficiently
    console.log('🔄 Starting transfer using aggregation pipeline...');
    const bookStream = dbV2.collection('books').aggregate([], { cursor: { batchSize: 1 } });
    
    let processed = 0;
    let skipped = 0;
    let totalInV2 = 0;
    
    // First, count total books in V2
    totalInV2 = await dbV2.collection('books').countDocuments();
    console.log(`📊 Total books in story-db-v2: ${totalInV2}`);

    // Process each book
    for await (const book of bookStream) {
      console.log(`\n📦 Processing book ${++processed}/${totalInV2}: ${book.title}`);
      
      // Check if this book already exists for the user
      if (existingTitles.has(book.title)) {
        console.log(`   ⚠️  Book already exists for user (skipping): ${book.title}`);
        skipped++;
        continue;
      }
      
      console.log(`   ✅ Book is new, proceeding with transfer...`);      
      
      // Create new book object with userId
      const newBook = {
        ...book,
        _id: new ObjectId(), // New ID to avoid conflicts
        userId: USER_EMAIL,
        status: 'preview',
        isDigitalUnlocked: true,
        updatedAt: new Date()
      };

      console.log(`   💾 Inserting book into main database...`);
      await dbMain.collection('books').insertOne(newBook);
      console.log(`   ✅ Book inserted successfully`);

      // Create recent book entry
      const recentBookEntry = {
        id: newBook._id.toString(),
        title: book.title,
        thumbnailUrl: book.pages[0]?.imageUrl || '',
        status: 'preview',
        isDigitalUnlocked: true,
        createdAt: book.createdAt
      };

      console.log(`   👤 Updating user's recent books...`);
      await dbMain.collection('users').updateOne(
        { email: USER_EMAIL },
        {
          $set: { updatedAt: new Date() },
          $push: {
            recentBooks: {
              $each: [recentBookEntry],
              $position: 0,
              $slice: 2
            }
          }
        },
        { upsert: true }
      );
      console.log(`   ✅ User updated successfully`);

      console.log(`   🎉 Completed transfer for: ${book.title}`);
    }

    console.log(`\n🎉 Transfer completed!`);
    console.log(`   Processed (new): ${processed - skipped} books`);
    console.log(`   Skipped (duplicates): ${skipped} books`);
    console.log(`   Total attempted: ${processed} books`);

  } catch (error) {
    console.error('💥 Error:', error);
    console.error('Error details:', error.stack);
  } finally {
    console.log('🔌 Closing MongoDB connection...');
    await client.close();
    console.log('🔒 Database connection closed.');
  }
}

transferBooks().catch(console.error);