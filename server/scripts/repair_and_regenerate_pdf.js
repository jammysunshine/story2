require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const logger = require('../logger');

const log = logger;

async function repairAndRegenerate() {
  console.log('🚀 Starting PDF Repair & Regeneration...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Find a book that needs repair (has a PDF URL but needs regenerating)
    const book = await db.collection('books').findOne({
      pdfUrl: { $exists: true, $ne: null }
    }, { sort: { createdAt: -1 } });

    if (!book) {
      console.error('❌ No suitable book found for repair.');
      return;
    }

    console.log(`🔧 Found book for repair: ${book.title} (ID: ${book._id})`);
    console.log(`📄 Current PDF URL: ${book.pdfUrl}`);
    console.log(`📊 Status: ${book.status}`);

    // 2. Clear existing PDF URL to force a fresh generation
    console.log('🧹 Clearing old PDF URL from database...');
    await db.collection('books').updateOne(
      { _id: new ObjectId(book._id) },
      { $unset: { pdfUrl: "" } }
    );
    console.log('✅ Cleared old PDF URL from database.');

    // 3. Trigger the PDF generation API
    const baseUrl = process.env.APP_URL || 'http://localhost:3001';
    console.log(`📡 Triggering regeneration at: ${baseUrl}/api/generate-pdf`);
    
    const response = await fetch(`${baseUrl}/api/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bookId: book._id.toString() }),
    });

    const result = await response.json();
    console.log('📥 API Response:', result);

    if (result.pdfUrl) {
      console.log('✅ SUCCESS! Fresh PDF generated.');
      console.log(`🔗 New PDF Link: ${result.pdfUrl}`);

      // Update the book record with the new PDF URL and status
      await db.collection('books').updateOne(
        { _id: new ObjectId(book._id) },
        {
          $set: {
            pdfUrl: result.pdfUrl,
            status: 'pdf_ready',
            updatedAt: new Date()
          }
        }
      );
      console.log('✅ Book record updated with new PDF URL and status.');
    } else {
      console.error('❌ PDF generation failed:', result.error || 'Unknown error');
      console.error('📝 Result details:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('💥 Repair process failed:', error);
    log.error('PDF repair error:', error);
  } finally {
    await client.close();
    console.log('🔒 Database connection closed.');
  }
}

// Run the repair function
repairAndRegenerate().catch(console.error);