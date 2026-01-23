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

    // Count existing books for the target user to avoid duplicates
    console.log('🔍 Checking for existing books for target user to avoid duplicates...');
    const existingBooks = await dbMain.collection('books').find({ userId: USER_EMAIL }).toArray();
    const existingBookTitles = new Set(existingBooks.map(book => book.title));
    console.log(`📋 Found ${existingBookTitles.size} existing books for user ${USER_EMAIL}`);

    // Get all books from v2 that don't already exist for the target user
    console.log('🔍 Fetching books to transfer (excluding duplicates)...');
    const booksToTransfer = await dbV2.collection('books').find({}).toArray();
    console.log(`📊 Found ${booksToTransfer.length} total books in v2`);
    
    const filteredBooks = booksToTransfer.filter(book => !existingBookTitles.has(book.title));
    console.log(`✅ Filtered to ${filteredBooks.length} books that need to be transferred (duplicates excluded)`);

    if (filteredBooks.length === 0) {
      console.log('✅ All books already exist for the target user. Nothing to transfer.');
      return;
    }

    // Transfer books one by one
    console.log(`🔄 Starting transfer of ${filteredBooks.length} books...`);
    let processed = 0;
    
    for (const book of filteredBooks) {
      processed++;
      console.log(`📦 Processing book ${processed}/${filteredBooks.length}: ${book.title}`);

      // Check if book already exists in main DB by title AND userId to be extra safe
      const existing = await dbMain.collection('books').findOne({ 
        title: book.title, 
        userId: USER_EMAIL 
      });
      
      if (existing) {
        console.log(`⚠️  Book already exists in main DB: ${book.title} (skipping)`);
        continue;
      }

      // Create new book object with userId
      const newBook = {
        ...book,
        _id: new ObjectId(), // New ID to avoid conflicts
        userId: USER_EMAIL,
        status: 'preview',
        isDigitalUnlocked: true,
        updatedAt: new Date()
      };

      console.log(`💾 Inserting book: ${book.title}`);
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

      console.log(`👤 Updating user ${USER_EMAIL} with new book...`);
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

      console.log(`✅ Transferred and allocated: ${book.title}`);
    }

    console.log(`🎉 Successfully transferred ${processed} books to ${USER_EMAIL}`);

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