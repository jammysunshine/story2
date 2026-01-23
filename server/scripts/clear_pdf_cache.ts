import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

async function repairBook() {
  const args = process.argv.slice(2);
  const bookId = args[0];

  if (!bookId || !ObjectId.isValid(bookId)) {
    console.error('❌ Please provide a valid Book ID: node scripts/clear_pdf_cache.js <bookId>');
    return;
  }

  console.log(`🔧 Attempting to clear PDF cache for book ID: ${bookId}`);

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI!, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Find the book to verify it exists
    const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });

    if (!book) {
      console.error(`❌ Book with ID ${bookId} not found.`);
      return;
    }

    console.log(`📖 Found book: ${book.title}`);
    console.log(`📄 Current PDF URL: ${book.pdfUrl || 'None'}`);
    console.log(`📊 Current Status: ${book.status}`);

    // Remove the PDF URL to force regeneration
    const result = await db.collection('books').updateOne(
      { _id: new ObjectId(bookId) },
      {
        $unset: { pdfUrl: "" },
        $set: {
          status: 'paid', // Reset status to allow regeneration
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Success! PDF URL has been cleared.');
      console.log('🚀 Next Step: Go to the app and click "Download PDF" or "Order" to trigger a fresh, fixed generation.');
    } else {
      console.log('⚠️ No changes were made. Book may have already been cleared.');
    }
  } catch (error) {
    console.error('💥 Error clearing PDF cache:', error);
  } finally {
    await client.close();
    console.log('🔒 Database connection closed.');
  }
}

// Run the repair function
repairBook().catch(console.error);

export { repairBook };