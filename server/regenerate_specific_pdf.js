/**
 * Script to regenerate PDFs for books that have all images but no PDF
 * 
 * To use this script:
 * 1. Make sure your server is running on port 3001
 * 2. Run this script: node regenerate_specific_pdf.js <bookId>
 * 
 * Example: node regenerate_specific_pdf.js 697457b968550d2148a86bce
 */

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function regenerateSpecificBookPDF(bookId) {
  if (!bookId) {
    console.error('❌ Please provide a book ID as an argument');
    console.log('Usage: node regenerate_specific_pdf.js <bookId>');
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
    
    console.log(`🔍 Checking book: ${bookId}`);
    
    // Get the book to verify it has all images and needs PDF regeneration
    const book = await db.collection('books').findOne({ 
      _id: new ObjectId(bookId) 
    });
    
    if (!book) {
      console.error(`❌ Book with ID ${bookId} not found`);
      process.exit(1);
    }
    
    // Count pages with images
    const pagesWithImages = book.pages ? book.pages.filter(page => 
      page.imageUrl && 
      !page.imageUrl.includes('placeholder') && 
      !page.imageUrl.includes('Painting+Page')
    ).length : 0;
    
    console.log(`📘 Book: "${book.title || 'Untitled'}"`);
    console.log(`   Status: ${book.status || 'unknown'}`);
    console.log(`   Pages with images: ${pagesWithImages}/${book.pages ? book.pages.length : 0}`);
    console.log(`   Needs PDF Regeneration: ${!!book.needsPDFRegeneration}`);
    
    if (pagesWithImages < 27) {
      console.warn(`⚠️  This book only has ${pagesWithImages} images, which is less than expected. May not be ready for PDF generation.`);
    }
    
    // Check if the book has the 'needsPDFRegeneration' flag we set earlier
    if (!book.needsPDFRegeneration) {
      console.log(`ℹ️  This book wasn't previously marked for regeneration, but attempting anyway...`);
    }
    
    console.log(`\n🔄 Triggering PDF regeneration via API call...`);
    
    // Call the internal API endpoint to generate the PDF
    const response = await fetch(`http://localhost:3001/api/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bookId: bookId })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ PDF generation API call failed with status ${response.status}:`, errorText);
      process.exit(1);
    }
    
    const result = await response.json();
    console.log(`✅ PDF generation triggered successfully!`);
    console.log(`📄 PDF URL: ${result.pdfUrl}`);
    
    // Update the book status to indicate PDF generation was attempted
    await db.collection('books').updateOne(
      { _id: new ObjectId(bookId) },
      {
        $unset: { needsPDFRegeneration: "" }, // Remove the regeneration flag
        $set: {
          status: 'pdf_ready',  // Update status to reflect PDF is ready
          pdfUrl: result.pdfUrl,
          lastPDFGenerationAttempt: new Date(),
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`💾 Database updated with new PDF URL and status`);
    
  } catch (error) {
    console.error('❌ Error regenerating PDF for book:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Get the book ID from command line arguments
const bookId = process.argv[2];

// Run the regeneration function
regenerateSpecificBookPDF(bookId);