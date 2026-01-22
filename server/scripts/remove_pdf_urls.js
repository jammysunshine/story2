require('dotenv').config();
const { MongoClient } = require('mongodb');
const logger = require('../logger');

const log = logger;

async function removeRecentPdfUrls() {
  log.info('🚀 Starting PDF URL removal for all books');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Find all books that have a pdfUrl
    const books = await db.collection('books').find({
      pdfUrl: { $exists: true, $ne: null }  // Only books that have a pdfUrl
    }).toArray();

    log.info(`Found ${books.length} books with PDF URLs`);

    if (books.length === 0) {
      log.info('No books with PDF URLs found');
      return;
    }

    // Remove pdfUrl from these specific books
    const result = await db.collection('books').updateMany(
      { _id: { $in: books.map(book => book._id) } },
      {
        $unset: { pdfUrl: "" },
        $set: { status: 'paid', updatedAt: new Date() } // Reset status to allow regeneration
      }
    );

    log.info(`✅ Successfully removed PDF URLs from ${result.modifiedCount} books`);

    // Log which books had their PDF URLs removed
    for (const book of books) {
      log.info(`Removed PDF URL for book: ${book.title || book._id.toString()}, ID: ${book._id}, User: ${book.userId || 'unknown'}`);
    }
  } catch (error) {
    log.error('❌ Error removing PDF URLs:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the function
removeRecentPdfUrls().catch(console.error);