// TypeScript version of the script
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const BOOK_ID: string = '6971e7f777734bddea0fcca8'; // The specific book ID
const USER_EMAIL: string = 'nidhi.cambridge@gmail.com'; // The user to allocate to
const MONGODB_URI: string = process.env.MONGODB_URI || 'REPLACE_WITH_YOUR_MONGODB_URI';



async function transferBooks(): Promise<void> {
  console.log('Starting transfer script...');
  const client: MongoClient = new MongoClient(MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 60000, connectTimeoutMS: 60000 });
  console.log('MongoClient created');

  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Connected to MongoDB');

    // Access both DBs
    const dbV2 = client.db('story-db-v2');
    const dbMain = client.db('story-db');
    console.log('Got DB references: v2=', dbV2.databaseName, 'main=', dbMain.databaseName);

    // Create index if needed
    console.log('Creating index on story-db-v2 books collection...');
    await dbV2.collection('books').createIndex({ _id: 1 });
    console.log('Index created.');

    // Count books in story-db-v2
    console.log('Counting books in story-db-v2...');
    const totalCount = await dbV2.collection('books').countDocuments();
    console.log(`Count completed: ${totalCount} books in story-db-v2.`);

    if (totalCount === 0) {
      console.log('No books found in story-db-v2.');
      return;
    }

    // Transfer using cursor
    console.log(`Transferring books from story-db-v2 to story-db and allocating to ${USER_EMAIL}...`);
    console.log('Creating cursor...');
    const cursor = dbV2.collection('books').find({}).limit(21);
    console.log('Cursor created');
    let processed = 0;
    console.log('Starting while loop...');
    while (await cursor.hasNext()) {
      console.log('Cursor has next, calling next...');
      const book = await cursor.next();
      processed++;
      console.log(`Processing book ${processed}: ${book.title}`);

      // Check if book already exists in main DB
      const existing = await dbMain.collection('books').findOne({ title: book.title, userId: USER_EMAIL });
      if (existing) {
        console.log(`Book already exists in main DB: ${book.title}`);
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

      console.log(`Inserting book: ${book.title}`);
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

      console.log(`Transferred and allocated: ${book.title}`);
    }

    console.log('All books transferred and allocated successfully.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

transferBooks();