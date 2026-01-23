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
    connectTimeoutMS: 60000 
  });
  
  try {
    console.log('📡 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');

    // Access both DBs
    const dbV2 = client.db('story-db-v2');
    const dbMain = client.db('story-db');
    console.log('📚 Got DB references: v2=', dbV2.databaseName, 'main=', dbMain.databaseName);

    // Count books in story-db-v2
    console.log('🔍 Counting books in story-db-v2...');
    const totalCount = await dbV2.collection('books').countDocuments();
    console.log(`📊 Count completed: ${totalCount} books in story-db-v2.`);

    if (totalCount === 0) {
      console.log('📭 No books found in story-db-v2.');
      return;
    }

    // Use cursor to process books one by one
    console.log(`🔄 Starting transfer of books using cursor...`);
    const cursor = dbV2.collection('books').find({});
    
    let processed = 0;
    let skipped = 0;
    
    while (await cursor.hasNext()) {
      const book = await cursor.next();
      processed++;
      
      console.log(`🔍 Processing book ${processed}/${totalCount}: ${book.title}`);
      
      // Check if a book with this title already exists for the target user
      console.log(`   Checking if book already exists for user...`);
      const existing = await dbMain.collection('books').findOne({ 
        title: book.title, 
        userId: USER_EMAIL 
      });
      
      if (existing) {
        console.log(`   ⚠️  Book already exists for user: ${book.title} (skipping)`);
        skipped++;
        continue;
      }

      // Create new book object with userId
      console.log(`   Creating new book entry...`);
      const newBook = {
        ...book,
        _id: new ObjectId(), // New ID to avoid conflicts
        userId: USER_EMAIL,
        status: 'preview',
        isDigitalUnlocked: true,
        updatedAt: new Date()
      };

      console.log(`   💾 Inserting book: ${book.title}`);
      await dbMain.collection('books').insertOne(newBook);

      // Sync to user's recentBooks
      const recentBookEntry = {
        id: newBook._id.toString(),
        title: book.title,
        thumbnailUrl: book.pages[0]?.imageUrl || '',
        status: 'preview',
        isDigitalUnlocked: true,
        createdAt: book.createdAt
      };

      console.log(`   👤 Updating user ${USER_EMAIL} with new book...`);
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

      console.log(`   ✅ Transferred and allocated: ${book.title}`);
    }

    console.log(`🎉 Transfer completed! Processed: ${processed - skipped} new books, Skipped: ${skipped} duplicates`);

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