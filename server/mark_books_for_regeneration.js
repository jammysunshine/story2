const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function markBooksForPDFRegeneration() {
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
      console.log(`🔄 Marking book for PDF regeneration: ${book._id} - "${book.title}"`);
      console.log(`   Pages with images: ${book.pagesWithImages}/${book.totalPages || 0}`);
      console.log(`   Status: ${book.status}`);
      
      // Update the book record to indicate it needs PDF regeneration
      const updateResult = await db.collection('books').updateOne(
        { _id: new ObjectId(book._id) },
        {
          $set: {
            needsPDFRegeneration: true,
            lastPDFGenerationAttempt: new Date(),
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`   📝 Database marked for regeneration. Matched: ${updateResult.matchedCount}, Modified: ${updateResult.modifiedCount}\n`);
    }

    console.log(`\n💡 To regenerate PDFs for these books, you can:`);
    console.log(`   1. Run the PDF generation endpoint manually for each book ID`);
    console.log(`   2. Use the existing API endpoint: POST /api/generate-pdf with body {bookId: "BOOK_ID"}`);
    console.log(`   3. Or run the full regeneration script during off-peak hours`);

  } catch (error) {
    console.error('❌ Error marking books for PDF regeneration:', error);
  } finally {
    await client.close();
  }
}

// Run the marking process
markBooksForPDFRegeneration().then(() => {
  console.log('✅ Marking process completed!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});