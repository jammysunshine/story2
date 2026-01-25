const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function checkBooksMissingPDF() {
  const client = new MongoClient(process.env.MONGODB_URI, {
    family: 4,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000
  });

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'story-db');
    
    console.log('🔍 Searching for books with all images but no PDF generated...\n');
    
    // Find books that have all images but no PDF
    const booksWithoutPDF = await db.collection('books').find({
      $or: [
        { pdfUrl: { $exists: false } },
        { pdfUrl: null },
        { pdfUrl: '' }
      ],
      pages: { $exists: true },
      status: { $ne: 'pdf_ready' } // Exclude books that already have PDF ready
    }).toArray();
    
    console.log(`📋 Found ${booksWithoutPDF.length} books without PDF\n`);
    
    for (const book of booksWithoutPDF) {
      // Count how many pages have images
      const totalPages = book.pages ? book.pages.length : 0;
      const pagesWithImages = book.pages ? book.pages.filter(page => 
        page.imageUrl && 
        !page.imageUrl.includes('placeholder') && 
        !page.imageUrl.includes('Painting+Page')
      ).length : 0;
      
      // Determine expected page count
      const expectedPages = parseInt(process.env.STORY_PAGES_COUNT || '23');
      const hasExpectedImages = pagesWithImages >= expectedPages;
      
      console.log(`📘 Book ID: ${book._id}`);
      console.log(`   Title: ${book.title || 'Untitled'}`);
      console.log(`   Status: ${book.status || 'unknown'}`);
      console.log(`   Pages with images: ${pagesWithImages}/${totalPages}`);
      console.log(`   Has expected images (${expectedPages}): ${hasExpectedImages ? '✅' : '❌'}`);
      console.log(`   Created: ${book.createdAt ? new Date(book.createdAt).toISOString() : 'N/A'}`);
      console.log(`   Updated: ${book.updatedAt ? new Date(book.updatedAt).toISOString() : 'N/A'}`);
      
      if (hasExpectedImages) {
        console.log(`   🎯 → This book has all expected images but no PDF generated!\n`);
      } else {
        console.log('');
      }
    }
    
    // Also find books that have all 28 pages (the typical full book count)
    console.log('\n🔍 Searching for books with exactly 28 pages (full book) but no PDF...\n');
    
    const fullBooksWithoutPDF = await db.collection('books').find({
      $or: [
        { pdfUrl: { $exists: false } },
        { pdfUrl: null },
        { pdfUrl: '' }
      ],
      pages: { $exists: true },
      status: { $ne: 'pdf_ready' },
      $expr: { $gte: [{ $size: "$pages" }, 28] } // At least 28 pages
    }).toArray();
    
    console.log(`📋 Found ${fullBooksWithoutPDF.length} books with 28+ pages but no PDF\n`);
    
    for (const book of fullBooksWithoutPDF) {
      const totalPages = book.pages ? book.pages.length : 0;
      const pagesWithImages = book.pages ? book.pages.filter(page => 
        page.imageUrl && 
        !page.imageUrl.includes('placeholder') && 
        !page.imageUrl.includes('Painting+Page')
      ).length : 0;
      
      const allImagesReady = pagesWithImages === totalPages;
      
      console.log(`📘 Book ID: ${book._id}`);
      console.log(`   Title: ${book.title || 'Untitled'}`);
      console.log(`   Status: ${book.status || 'unknown'}`);
      console.log(`   Total pages: ${totalPages}`);
      console.log(`   Pages with images: ${pagesWithImages}/${totalPages}`);
      console.log(`   All images ready: ${allImagesReady ? '✅' : '❌'}`);
      console.log(`   Created: ${book.createdAt ? new Date(book.createdAt).toISOString() : 'N/A'}`);
      console.log(`   Updated: ${book.updatedAt ? new Date(book.updatedAt).toISOString() : 'N/A'}`);
      
      if (allImagesReady) {
        console.log(`   🎯 → This book has ALL 28 pages with images but no PDF generated!\n`);
      } else {
        console.log('');
      }
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