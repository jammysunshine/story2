const { MongoClient, ObjectId } = require('mongodb');
const { generatePdf } = require('./pdfService');
require('dotenv').config();

async function regeneratePDFsForFailedBooks() {
  const client = new MongoClient(process.env.MONGODB_URI, {
    family: 4,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000
  });

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'story-db');
    
    console.log('🔍 Searching for books with all images but no PDF generated...\n');
    
    // Find books that have at least 27 images with URLs but no PDF
    const booksWithoutPDF = await db.collection('books').aggregate([
      {
        $match: {
          $or: [
            { pdfUrl: { $exists: false } },
            { pdfUrl: null },
            { pdfUrl: '' }
          ],
          pages: { $exists: true, $ne: null },
          status: { $in: ['failed', 'teaser_ready'] } // Focus on failed books and teaser_ready books
        }
      },
      {
        $addFields: {
          pagesWithImages: {
            $size: {
              $filter: {
                input: "$pages",
                cond: {
                  $and: [
                    { $ne: ["$$this.imageUrl", null] },
                    { $not: { $regexMatch: { input: "$$this.imageUrl", regex: /placeholder|Painting\+Page/i } } }
                  ]
                }
              }
            }
          }
        }
      },
      {
        $match: {
          pagesWithImages: { $gte: 27 }  // At least 27 pages with images
        }
      },
      {
        $project: {
          title: 1,
          status: 1,
          pagesWithImages: 1,
          totalPages: { $size: "$pages" },
          createdAt: 1,
          updatedAt: 1,
          _id: 1
        }
      }
    ]).toArray();
    
    console.log(`📋 Found ${booksWithoutPDF.length} books with 27+ images but no PDF\n`);
    
    for (const book of booksWithoutPDF) {
      console.log(`🔄 Attempting to regenerate PDF for book: ${book._id} - "${book.title}"`);
      console.log(`   Pages with images: ${book.pagesWithImages}/${book.totalPages || 0}`);
      console.log(`   Status: ${book.status}`);
      
      try {
        // Attempt to generate PDF for this book
        const pdfUrl = await generatePdf(db, book._id.toString());
        
        console.log(`   ✅ PDF successfully generated: ${pdfUrl}`);
        
        // Update the book record with the new PDF URL and status
        const updateResult = await db.collection('books').updateOne(
          { _id: new ObjectId(book._id) },
          {
            $set: {
              pdfUrl: pdfUrl,
              status: 'pdf_ready',
              updatedAt: new Date()
            }
          }
        );
        
        console.log(`   📝 Database updated. Matched: ${updateResult.matchedCount}, Modified: ${updateResult.modifiedCount}\n`);
        
      } catch (error) {
        console.error(`   ❌ Failed to generate PDF for book ${book._id}:`, error.message);
        console.error(`      Error details:`, error);
        
        // Optionally update the book status to reflect the continued failure
        await db.collection('books').updateOne(
          { _id: new ObjectId(book._id) },
          {
            $set: {
              status: 'failed',
              error: error.message,
              updatedAt: new Date()
            }
          }
        );
        
        console.log(`   📝 Failure status recorded in database.\n`);
      }
    }

  } catch (error) {
    console.error('❌ Error in PDF regeneration process:', error);
  } finally {
    await client.close();
  }
}

// Run the PDF regeneration
regeneratePDFsForFailedBooks().then(() => {
  console.log('✅ PDF regeneration process completed!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});