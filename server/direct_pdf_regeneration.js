/**
 * Direct PDF regeneration script that bypasses the API endpoint
 * This connects directly to the database and calls the generatePdf function
 */

const { MongoClient, ObjectId } = require('mongodb');
const { generatePdf } = require('./pdfService');
require('dotenv').config();

async function directPDFRegeneration(bookId) {
  if (!bookId) {
    console.error('❌ Please provide a book ID as an argument');
    console.log('Usage: node direct_pdf_regeneration.js <bookId>');
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI, {
    family: 4,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000
  });

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'story-db');
    
    console.log(`🔍 Regenerating PDF for book: ${bookId}`);
    
    // Get the book to verify it exists
    const book = await db.collection('books').findOne({ 
      _id: new ObjectId(bookId) 
    });
    
    if (!book) {
      console.error(`❌ Book with ID ${bookId} not found`);
      process.exit(1);
    }
    
    console.log(`📘 Book: "${book.title || 'Untitled'}"`);
    console.log(`   Status: ${book.status || 'unknown'}`);
    
    // Attempt to generate PDF directly
    console.log(`🔄 Starting direct PDF generation...`);
    
    const pdfUrl = await generatePdf(db, bookId);
    
    console.log(`✅ PDF successfully generated: ${pdfUrl}`);
    
    // Update the book record with the new PDF URL and status
    const updateResult = await db.collection('books').updateOne(
      { _id: new ObjectId(bookId) },
      {
        $unset: { needsPDFRegeneration: "" }, // Remove the regeneration flag
        $set: {
          pdfUrl: pdfUrl,
          status: 'pdf_ready',
          lastPDFGenerationAttempt: new Date(),
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`💾 Database updated. Matched: ${updateResult.matchedCount}, Modified: ${updateResult.modifiedCount}`);
    console.log(`📄 Final PDF URL stored in database: ${pdfUrl}`);
    
  } catch (error) {
    console.error('❌ Error in direct PDF regeneration:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Get the book ID from command line arguments
const bookId = process.argv[2];

// Run the regeneration function
directPDFRegeneration(bookId);