const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function checkBooksMissingPDF() {
  const client = new MongoClient(process.env.MONGODB_URI, {
    family: 4,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000
  });

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'story-db');
    
    console.log('🔍 Searching for books with all 27+ images but no PDF generated...\n');
    
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
          status: { $nin: ['pdf_ready', 'printing', 'shipped', 'delivered'] }
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
      console.log(`📘 Book ID: ${book._id}`);
      console.log(`   Title: ${book.title || 'Untitled'}`);
      console.log(`   Status: ${book.status || 'unknown'}`);
      console.log(`   Pages with images: ${book.pagesWithImages}/${book.totalPages || 0}`);
      console.log(`   Created: ${book.createdAt ? new Date(book.createdAt).toISOString() : 'N/A'}`);
      console.log(`   Updated: ${book.updatedAt ? new Date(book.updatedAt).toISOString() : 'N/A'}`);
      console.log('');
    }
    
    // Also check for books with exactly 28 pages (full book) and all images
    console.log('🔍 Searching for books with exactly 28 pages and all images but no PDF...\n');
    
    const fullBooksWithoutPDF = await db.collection('books').aggregate([
      {
        $match: {
          $or: [
            { pdfUrl: { $exists: false } },
            { pdfUrl: null },
            { pdfUrl: '' }
          ],
          pages: { $exists: true, $ne: null },
          status: { $nin: ['pdf_ready', 'printing', 'shipped', 'delivered'] }
        }
      },
      {
        $addFields: {
          totalPages: { $size: "$pages" },
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
          totalPages: { $gte: 28 },  // At least 28 pages
          pagesWithImages: { $gte: 28 }  // All pages have images
        }
      },
      {
        $project: {
          title: 1,
          status: 1,
          pagesWithImages: 1,
          totalPages: 1,
          createdAt: 1,
          updatedAt: 1,
          _id: 1
        }
      }
    ]).toArray();
    
    console.log(`📋 Found ${fullBooksWithoutPDF.length} books with 28+ pages and all images but no PDF\n`);
    
    for (const book of fullBooksWithoutPDF) {
      console.log(`📘 Book ID: ${book._id}`);
      console.log(`   Title: ${book.title || 'Untitled'}`);
      console.log(`   Status: ${book.status || 'unknown'}`);
      console.log(`   Pages with images: ${book.pagesWithImages}/${book.totalPages || 0}`);
      console.log(`   Created: ${book.createdAt ? new Date(book.createdAt).toISOString() : 'N/A'}`);
      console.log(`   Updated: ${book.updatedAt ? new Date(book.updatedAt).toISOString() : 'N/A'}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error checking books:', error);
  } finally {
    await client.close();
  }
}

// Run the check
checkBooksMissingPDF().then(() => {
  console.log('✅ Check completed!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});