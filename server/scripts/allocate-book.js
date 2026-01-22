const { MongoClient, ObjectId } = require('mongodb');
const USER_EMAIL = 'nidhi.cambridge@gmail.com'; // The user to allocate to
const MONGODB_URI = 'mongodb+srv://jammysunshine:11wMGp1fnrwhZGIQ@cluster0.qqweu91.mongodb.net/story-db?retryWrites=true&w=majority';

async function allocateUnallocatedBooks() {
  const client = new MongoClient(MONGODB_URI, { family: 4 });

  try {
    await client.connect();
    const db = client.db('story-db-v2');

    // Find all books where userId is null
    const unallocatedBooks = await db.collection('books').find({ userId: null }).toArray();

    if (unallocatedBooks.length === 0) {
      console.log('No unallocated books found.');
      return;
    }

    console.log(`Found ${unallocatedBooks.length} unallocated books. Allocating to ${USER_EMAIL}...`);

    for (const book of unallocatedBooks) {
      const bookId = book._id.toString();

      // Update the book
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
    }

    console.log('All unallocated books allocated successfully.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

allocateUnallocatedBooks();