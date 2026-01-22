const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const BOOK_ID = '6971e7f777734bddea0fcca8'; // The specific book ID
const USER_EMAIL = 'nidhi.cambridge@gmail.com'; // The user to allocate to
const MONGODB_URI = process.env.MONGODB_URI || 'REPLACE_WITH_YOUR_MONGODB_URI';



async function allocateBook() {
  console.log('Starting script...');
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 60000, connectTimeoutMS: 60000 });
  console.log('MongoClient created');

  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db('story-db-v2');
    console.log('Got DB reference');

    console.log(`Allocating book ${BOOK_ID} to ${USER_EMAIL}`);

    // Update the book
    console.log(`Updating book in DB`);
    const updateResult = await db.collection('books').updateOne(
      { _id: new ObjectId(BOOK_ID) },
      {
        $set: {
          userId: USER_EMAIL,
          status: 'preview', // Unlock it for preview
          isDigitalUnlocked: true,
          updatedAt: new Date()
        }
      }
    );
    console.log(`Book update result:`, updateResult);

    if (updateResult.matchedCount === 0) {
      console.log('Book not found!');
      return;
    }

    console.log('Book allocated successfully.');

    // Sync to user's recentBooks
    const book = await db.collection('books').findOne({ _id: new ObjectId(BOOK_ID) });
    if (book) {
      const recentBookEntry = {
        id: BOOK_ID,
        title: book.title,
        thumbnailUrl: book.pages[0]?.imageUrl || '',
        status: 'preview',
        isDigitalUnlocked: true,
        createdAt: book.createdAt
      };

      console.log(`Syncing to user recentBooks`);
      await db.collection('users').updateOne(
        { email: USER_EMAIL },
        {
          $set: { updatedAt: new Date() },
          $push: {
            recentBooks: {
              $each: [recentBookEntry],
              $position: 0,
              $slice: 2 // Keep only last 2
            }
          }
        },
        { upsert: true }
      );

      console.log('Synced to user\'s recent books.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

allocateBook();