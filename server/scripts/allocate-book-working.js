const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const USER_EMAIL = 'nidhi.cambridge@gmail.com';

async function transferBooks() {
  console.log('🚀 Starting transfer script...');
  console.log('📧 Target User Email:', USER_EMAIL);

  const MONGODB_URI = process.env.MONGODB_URI || 'REPLACE_WITH_YOUR_MONGODB_URI';
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
    console.log('✅ Connected to MongoDB');

    // Access both DBs
    const dbV2 = client.db('story-db-v2');
    const dbMain = client.db('story-db');
    console.log('📚 Got DB references: v2=', dbV2.databaseName, 'main=', dbMain.databaseName);

    // Count books in story-db-v2
    console.log('🔍 Counting books in story-db-v2...');
    const totalBooks = await dbV2.collection('books').estimatedDocumentCount();
    console.log(`📊 Total books in story-db-v2: ${totalBooks}`);

    // Get all book IDs from v2 to process one by one
    console.log('🔍 Fetching book IDs from story-db-v2...');
    const allBookIds = await dbV2.collection('books').find({}, { _id: 1 }).toArray();
    console.log(`📋 Fetched ${allBookIds.length} book IDs to process`);

    // Process each book one by one
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (let i = 0; i < allBookIds.length; i++) {
      const bookId = allBookIds[i]._id;
      console.log(`\n📦 Processing book ${i+1}/${allBookIds.length} (ID: ${bookId.toString()})`);
      
      try {
        // Fetch the specific book
        const book = await dbV2.collection('books').findOne({ _id: bookId });
        if (!book) {
          console.log(`   ❌ Book not found with ID: ${bookId}`);
          continue;
        }
        
        console.log(`   Title: ${book.title}`);

        // Check if this specific book already exists for the user (individual check)
        console.log(`   🔍 Checking if book already exists for user...`);
        const existingBook = await dbMain.collection('books').findOne({ 
          title: book.title, 
          userId: USER_EMAIL 
        });
        
        if (existingBook) {
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
        processed++;
      } catch (bookError) {
        console.error(`   ❌ Error processing book ${bookId}:`, bookError.message);
        errors++;
      }
    }

    console.log(`\n🎉 Transfer completed!`);
    console.log(`   Processed (new): ${processed} books`);
    console.log(`   Skipped (duplicates): ${skipped} books`);
    console.log(`   Errors: ${errors} books`);
    console.log(`   Total attempted: ${processed + skipped + errors} books`);

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