const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const BOOK_ID = '6971e7f777734bddea0fcca8'; // The specific book ID
const USER_EMAIL = 'nidhi.cambridge@gmail.com'; // The user to allocate to
const MONGODB_URI = process.env.MONGODB_URI || 'REPLACE_WITH_YOUR_MONGODB_URI';



async function allocateUnallocatedBooks() {
  console.log('Starting script...');
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 60000, connectTimeoutMS: 60000 });
  console.log('MongoClient created');

  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db('story-db-v2');
    console.log('Got DB reference');

    // Find all books where userId is null
    console.log('Querying for unallocated books...');
    const unallocatedBooks = await db.collection('books').find({ userId: null }).toArray();
    console.log('Query completed');

    if (unallocatedBooks.length === 0) {
      console.log('No unallocated books found.');
      return;
    }

    console.log(`Found ${unallocatedBooks.length} unallocated books. Allocating to ${USER_EMAIL}...`);

    for (const book of unallocatedBooks) {
      const bookId = book._id.toString();
      console.log(`Processing book ${bookId}`);

      // Update the book
      console.log(`Updating book ${bookId} in DB`);
      await db.collection('books').updateOne(
        { _id: book._id },
        {
          $set: {
            userId: USER_EMAIL,
            status: 'preview', // Unlock it for preview
            isDigitalUnlocked: true,
            updatedAt: new Date()
          }
        }
      );
      console.log(`Book ${bookId} updated`);

      console.log(`Allocated book ${bookId}: ${book.title}`);

      // Sync to user's recentBooks
      const recentBookEntry = {
        id: bookId,
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
      console.log(`Synced book ${bookId} to user`);
    }

    console.log('All unallocated books allocated successfully.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

allocateUnallocatedBooks();