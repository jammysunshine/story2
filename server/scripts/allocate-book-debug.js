const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const USER_EMAIL = 'nidhi.cambridge@gmail.com';

async function transferBooks() {
  console.log('🚀 Starting transfer script...');
  console.log('📧 Target User Email:', USER_EMAIL);

  const MONGODB_URI = process.env.MONGODB_URI || 'REPLACE_WITH_YOUR_MONGODB_URI';
  console.log('🔧 Creating MongoDB client with extended timeouts...');
  const client = new MongoClient(MONGODB_URI, { 
    family: 4,
    serverSelectionTimeoutMS: 30000,    // 30 seconds
    connectTimeoutMS: 30000,            // 30 seconds
    socketTimeoutMS: 60000,             // 60 seconds
    maxIdleTimeMS: 120000,              // 2 minutes
    maxPoolSize: 10
  });
  
  try {
    console.log('📡 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB successfully');

    // Access both DBs
    const dbV2 = client.db('story-db-v2');
    const dbMain = client.db('story-db');
    console.log('📚 Got DB references: v2=', dbV2.databaseName, 'main=', dbMain.databaseName);

    // Count books in story-db-v2
    console.log('🔍 Counting books in story-db-v2...');
    const totalBooks = await dbV2.collection('books').estimatedDocumentCount();
    console.log(`📊 Total books in story-db-v2: ${totalBooks}`);

    // Use cursor to process books one by one
    console.log('🔄 Starting transfer using cursor...');
    const cursor = dbV2.collection('books').find({}).batchSize(1); // Process one at a time
    
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let currentIndex = 0;
    
    console.log('📖 Beginning to process books one by one...');
    
    while (await cursor.hasNext()) {
      currentIndex++;
      console.log(`\n🔄 Processing book ${currentIndex}/${totalBooks}...`);
      
      const book = await cursor.next();
      console.log(`   🆔 Book ID: ${book._id.toString()}`);
      console.log(`   📝 Title: ${book.title}`);
      console.log(`   📄 Pages: ${book.pages ? book.pages.length : 0} pages`);
      console.log(`   📅 Created: ${book.createdAt}`);

      try {
        // Check if this specific book already exists for the user (individual check)
        console.log(`   🔍 Checking if book already exists for user: ${USER_EMAIL}...`);
        const existingBook = await dbMain.collection('books').findOne({ 
          title: book.title, 
          userId: USER_EMAIL 
        });
        
        if (existingBook) {
          console.log(`   ⚠️  DUPLICATE FOUND: Book already exists for user (skipping): ${book.title}`);
          skipped++;
          console.log(`   📊 Skipped count: ${skipped}`);
          continue;
        } else {
          console.log(`   ✅ NEW BOOK: Book does not exist for user, proceeding with transfer...`);      
        }
        
        // Create new book object with userId
        console.log(`   📋 Creating new book object with new ID...`);
        const newBook = {
          ...book,
          _id: new ObjectId(), // New ID to avoid conflicts
          userId: USER_EMAIL,
          status: 'preview',
          isDigitalUnlocked: true,
          updatedAt: new Date()
        };

        console.log(`   💾 INSERTING book into main database...`);
        await dbMain.collection('books').insertOne(newBook);
        console.log(`   ✅ Book inserted successfully with new ID: ${newBook._id.toString()}`);

        // Create recent book entry
        console.log(`   📝 Creating recent book entry...`);
        const recentBookEntry = {
          id: newBook._id.toString(),
          title: book.title,
          thumbnailUrl: book.pages[0]?.imageUrl || '',
          status: 'preview',
          isDigitalUnlocked: true,
          createdAt: book.createdAt
        };

        console.log(`   👤 UPDATING user's recent books...`);
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

        console.log(`   🎉 COMPLETED transfer for: ${book.title}`);
        processed++;
        console.log(`   📊 Processed count: ${processed}`);
      } catch (bookError) {
        console.error(`   ❌ ERROR processing book ${book._id}:`, bookError.message);
        console.error(`   📝 Error stack:`, bookError.stack);
        errors++;
        console.log(`   📊 Error count: ${errors}`);
      }
      
      console.log(`   🔄 Finished processing book ${currentIndex}/${totalBooks}`);
    }

    console.log(`\n🎉 TRANSFER COMPLETED!`);
    console.log(`   📊 Processed (new): ${processed} books`);
    console.log(`   📊 Skipped (duplicates): ${skipped} books`);
    console.log(`   📊 Errors: ${errors} books`);
    console.log(`   📊 Total attempted: ${processed + skipped + errors} books`);
    console.log(`   🎯 All books have been processed according to duplicate prevention rules`);

  } catch (error) {
    console.error('💥 MAJOR ERROR:', error);
    console.error('Error details:', error.stack);
  } finally {
    console.log('🔌 Closing MongoDB connection...');
    await client.close();
    console.log('🔒 Database connection closed.');
  }
}

console.log('🎬 Script starting execution...');
transferBooks().then(() => {
  console.log('🏁 Script execution completed successfully');
}).catch(error => {
  console.error('💥 Script execution failed:', error);
});