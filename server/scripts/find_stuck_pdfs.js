const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { MongoClient, ObjectId } = require('mongodb');

async function findStuckPdfs() {
  console.log('🔍 Searching for books with 27 images but no PDF...');

  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Find books where pdfUrl is missing, null, or empty string
    // and pages array exists
    const query = {
      $or: [
        { pdfUrl: { $exists: false } },
        { pdfUrl: null },
        { pdfUrl: '' }
      ],
      pages: { $exists: true }
    };

    const books = await db.collection('books').find(query).toArray();

    const stuckBooks = books.filter(book => {
      if (!book.pages) return false;
      
      // Count pages that actually have a real image URL (not a placeholder)
      const validImagesCount = book.pages.filter(p => 
        p.imageUrl && 
        !p.imageUrl.includes('placeholder') && 
        !p.imageUrl.includes('Painting+Page')
      ).length;

      return validImagesCount >= 27;
    });

    if (stuckBooks.length === 0) {
      console.log('✅ No stuck books found with 27+ images.');
      return;
    }

    console.log(`\n🚨 Found ${stuckBooks.length} books stuck without PDFs:\n`);
    console.log('┌──────────────────────────┬─────────────┬────────────┬─────────────────────┐');
    console.log('│ Book ID                  │ Status      │ Image Count│ Created At          │');
    console.log('├──────────────────────────┼─────────────┼────────────┼─────────────────────┤');

    for (const book of stuckBooks) {
      const id = book._id.toString();
      const status = (book.status || 'N/A').padEnd(11);
      const imgCount = book.pages.length.toString().padStart(10);
      const createdAt = new Date(book.createdAt).toISOString().substring(0, 19);

      console.log(`│ ${id} │ ${status} │ ${imgCount} │ ${createdAt} │`);
    }
    console.log('└──────────────────────────┴─────────────┴────────────┴─────────────────────┘');

    console.log('\n💡 Recommendation: Once the fix is deployed, run the rescue script for these IDs.');

  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await client.close();
  }
}

findStuckPdfs().catch(console.error);
