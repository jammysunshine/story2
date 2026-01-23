const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const USER_EMAIL = 'nidhi.cambridge@gmail.com';

async function transferSingleBook() {
  console.log('🚀 Starting single book transfer test...');
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

    // Get just the first book from v2
    console.log('🔍 Fetching first book from story-db-v2...');
    const firstBook = await dbV2.collection('books').findOne();
    if (!firstBook) {
      console.log('📭 No books found in story-db-v2');
      return;
    }
    
    console.log(`📖 Found book: ${firstBook.title}`);

    // Check if this specific book already exists for the user
    console.log('🔍 Checking if this book already exists for the user...');
    const existingBook = await dbMain.collection('books').findOne({ 
      title: firstBook.title, 
      userId: USER_EMAIL 
    });
    
    if (existingBook) {
      console.log(`⚠️  Book already exists for user: ${firstBook.title} (skipping)`);
      return;
    }
    
    console.log(`✅ Book is new, proceeding with transfer...`);      
    
    // Create new book object with userId
    const newBook = {
      ...firstBook,
      _id: new ObjectId(), // New ID to avoid conflicts
      userId: USER_EMAIL,
      status: 'preview',
      isDigitalUnlocked: true,
      updatedAt: new Date()
    };

    console.log(`💾 Inserting book into main database...`);
    await dbMain.collection('books').insertOne(newBook);
    console.log(`✅ Book inserted successfully`);

    // Create recent book entry
    const recentBookEntry = {
      id: newBook._id.toString(),
      title: firstBook.title,
      thumbnailUrl: firstBook.pages[0]?.imageUrl || '',
      status: 'preview',
      isDigitalUnlocked: true,
      createdAt: firstBook.createdAt
    };

    console.log(`👤 Updating user's recent books...`);
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
    console.log(`✅ User updated successfully`);

    console.log(`🎉 Single book transfer completed: ${firstBook.title}`);

  } catch (error) {
    console.error('💥 Error:', error);
    console.error('Error details:', error.stack);
  } finally {
    console.log('🔌 Closing MongoDB connection...');
    await client.close();
    console.log('🔒 Database connection closed.');
  }
}

transferSingleBook().catch(console.error);