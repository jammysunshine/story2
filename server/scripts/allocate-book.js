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

    // Count unallocated books
    console.log('Counting unallocated books...');
    const totalCount = await db.collection('books').countDocuments({ userId: null });
    console.log(`Count completed: ${totalCount} unallocated books. Allocating to ${USER_EMAIL}...`);

    if (totalCount === 0) {
      console.log('No unallocated books found.');
      return;
    }

    // Process one by one using cursor
    console.log('Starting cursor processing...');
    const cursor = db.collection('books').find({ userId: null }).limit(19);
    let processed = 0;
    while (await cursor.hasNext()) {
      const book = await cursor.next();
      processed++;
      const bookId = book._id.toString();
      console.log(`Processing book ${processed}: ${bookId} - ${book.title}`);

      // Update the book
      console.log(`Updating book ${bookId}...`);
      const result = await db.collection('books').updateOne(
        { _id: book._id },
        {
          $set: {
            userId: USER_EMAIL,
            status: 'preview',
            isDigitalUnlocked: true,
            updatedAt: new Date()
          }
        }
      );
      console.log(`Update completed for ${bookId}:`, result);
    }
    console.log('All processing completed.');

    console.log('All unallocated books allocated successfully.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

allocateUnallocatedBooks();