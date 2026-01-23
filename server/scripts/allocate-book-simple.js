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

    // Get all books from v2 to transfer
    console.log('🔍 Fetching all books from story-db-v2...');
    const allBooks = await dbV2.collection('books').find({}).toArray();
    console.log(`📊 Found ${allBooks.length} books in story-db-v2 to process`);

    // Get existing book titles for the target user to avoid duplicates
    console.log('🔍 Fetching existing book titles for target user...');
    const existingBooks = await dbMain.collection('books').find({ userId: USER_EMAIL }).toArray();
    const existingTitles = new Set(existingBooks.map(b => b.title));
    console.log(`📋 Found ${existingTitles.size} existing book titles for user ${USER_EMAIL}`);

    // Process each book
    let processed = 0;
    let skipped = 0;
    
    for (let i = 0; i < allBooks.length; i++) {
      const book = allBooks[i];
      console.log(`\n📦 Processing book ${i+1}/${allBooks.length}: ${book.title}`);
      
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
      processed++;
    }

    console.log(`\n🎉 Transfer completed!`);
    console.log(`   Processed (new): ${processed} books`);
    console.log(`   Skipped (duplicates): ${skipped} books`);
    console.log(`   Total books in target database for user: ${processed + existingTitles.size}`);

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