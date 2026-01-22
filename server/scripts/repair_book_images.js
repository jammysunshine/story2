require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const logger = require('../logger');

const log = logger;

async function repairBookImages() {
  log.info('🔧 Starting book image repair process...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Find books with missing or placeholder images
    const books = await db.collection('books').find({
      $or: [
        { "pages.imageUrl": { $regex: /placeholder|Painting\+Page|via\.placeholder/ } },
        { "pages.imageUrl": { $exists: false } },
        { "pages.imageUrl": null },
        { "pages.imageUrl": "" }
      ]
    }).toArray();

    log.info(`Found ${books.length} books with missing or placeholder images`);

    if (books.length === 0) {
      console.log('✅ No books with missing images found. All books appear to have valid images.');
      return;
    }

    for (const book of books) {
      console.log(`\n📖 Processing book: ${book.title || 'Untitled'} (ID: ${book._id})`);
      
      let updatedPages = [...book.pages];
      let hasUpdates = false;
      
      for (let i = 0; i < updatedPages.length; i++) {
        const page = updatedPages[i];
        const originalImageUrl = page.imageUrl;
        
        // Check if image URL is a placeholder or missing
        if (!page.imageUrl || 
            page.imageUrl.includes('placeholder') || 
            page.imageUrl.includes('via.placeholder.com') ||
            page.imageUrl.includes('Painting+Page')) {
          
          console.log(`  📄 Page ${page.pageNumber || i+1}: ${originalImageUrl ? 'Placeholder' : 'Missing'} image detected`);
          
          // Try to reconstruct the image URL based on book ID and page number
          if (book._id && page.pageNumber) {
            // This is a guess - in a real scenario, you'd need to regenerate the image
            // For now, we'll just flag it for regeneration
            console.log(`    🔄 Marking page ${page.pageNumber} for image regeneration`);
            // In a real implementation, you'd call the image generation service here
            hasUpdates = true;
          } else {
            console.log(`    ⚠️ Cannot reconstruct image URL - missing book ID or page number`);
          }
        } else {
          console.log(`  📄 Page ${page.pageNumber || i+1}: ✅ Valid image`);
        }
      }
      
      if (hasUpdates) {
        // In a real implementation, we would update the book status to trigger image regeneration
        await db.collection('books').updateOne(
          { _id: new ObjectId(book._id) },
          {
            $set: {
              status: 'generating', // Reset status to trigger regeneration
              updatedAt: new Date()
            }
          }
        );
        
        console.log(`  🔄 Book status reset to 'generating' to trigger image regeneration`);
      }
    }

    // Also check for books with no pages at all
    const booksWithoutPages = await db.collection('books').countDocuments({
      $or: [
        { pages: { $exists: false } },
        { pages: { $size: 0 } },
        { pages: null }
      ]
    });

    if (booksWithoutPages > 0) {
      console.log(`\n⚠️  Found ${booksWithoutPages} books with no pages. These may need story regeneration.`);
    }

    // Summary
    console.log(`\n📋 REPAIR SUMMARY:`);
    console.log(`  - Books checked: ${books.length}`);
    console.log(`  - Books with missing/placeholder images: ${books.length}`);
    console.log(`  - Books with no pages: ${booksWithoutPages}`);
    console.log(`\n💡 Next Steps:`);
    console.log(`  - Run image generation for books with placeholder images`);
    console.log(`  - Verify that all image generation processes completed successfully`);
    console.log(`  - Check for any failed image generations and retry`);

  } catch (error) {
    log.error('💥 Error repairing book images:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the repair function
repairBookImages().catch(console.error);