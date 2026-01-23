import 'dotenv/config';
import { MongoClient } from 'mongodb';
import logger from '../logger';

const log = logger;

interface BookPage {
  pageNumber?: number;
  imageUrl?: string;
  url?: string;
  [key: string]: any;
}

interface Book {
  _id: any;
  title?: string;
  pdfUrl?: string;
  photoUrl?: string;
  pages?: BookPage[];
  [key: string]: any;
}

async function verifySydneyURLs() {
  log.info('🌐 Starting URL format verification...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI!, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Get sample books to check URL formats
    const books = await db.collection<Book>('books').find({}).limit(10).toArray();

    console.log(`\n🔍 Checking URL formats for ${books.length} sample books...`);

    for (const book of books) {
      console.log(`\n📖 Book: ${book.title || 'Untitled'} (ID: ${book._id})`);

      // Check PDF URL format
      if (book.pdfUrl) {
        console.log(`📄 PDF URL: ${book.pdfUrl}`);

        // Validate PDF URL format
        try {
          const url = new URL(book.pdfUrl);
          const isValidFormat = url.protocol === 'https:' &&
                               url.hostname.includes('storage.googleapis.com');
          console.log(`   Format: ${isValidFormat ? '✅ Valid' : '❌ Invalid'}`);

          // Check if it's a proper GCS URL
          const isGCS = book.pdfUrl.includes('storage.googleapis.com') &&
                       book.pdfUrl.includes(process.env.GCS_PDFS_BUCKET_NAME || 'pdfs');
          console.log(`   GCS Format: ${isGCS ? '✅ Correct' : '❌ Incorrect'}`);
        } catch (e) {
          console.log(`   Format: ❌ Invalid URL`);
        }
      } else {
        console.log(`📄 PDF URL: ❌ None`);
      }

      // Check image URLs in pages
      if (book.pages && book.pages.length > 0) {
        console.log(`🖼️  Checking ${Math.min(3, book.pages.length)} sample pages...`);

        for (let i = 0; i < Math.min(3, book.pages.length); i++) {
          const page = book.pages[i];
          const imageUrl = page.imageUrl || page.url;

          if (imageUrl) {
            console.log(`   Page ${page.pageNumber || i+1}: ${imageUrl.substring(0, 60)}...`);

            try {
              const url = new URL(imageUrl);
              const isValidFormat = url.protocol === 'https:' &&
                                   (url.hostname.includes('storage.googleapis.com') ||
                                    url.hostname.includes('via.placeholder.com'));
              console.log(`     Format: ${isValidFormat ? '✅ Valid' : '❌ Invalid'}`);

              // Check if it's a placeholder
              const isPlaceholder = imageUrl.includes('via.placeholder.com') ||
                                  imageUrl.includes('placeholder.png') ||
                                  imageUrl.includes('Painting+Page');
              console.log(`     Placeholder: ${isPlaceholder ? '⚠️  Yes' : '✅ No'}`);
            } catch (e) {
              console.log(`     Format: ❌ Invalid URL`);
            }
          } else {
            console.log(`   Page ${page.pageNumber || i+1}: ❌ No image URL`);
          }
        }
      }

      // Check user avatar or photo URL if exists
      if (book.photoUrl) {
        console.log(`👤 Photo URL: ${book.photoUrl}`);
        try {
          const url = new URL(book.photoUrl);
          const isValidFormat = url.protocol === 'https:' &&
                               url.hostname.includes('storage.googleapis.com');
          console.log(`   Format: ${isValidFormat ? '✅ Valid' : '❌ Invalid'}`);
        } catch (e) {
          console.log(`   Format: ❌ Invalid URL`);
        }
      }
    }

    // Check environment variables for URL configuration
    console.log('\n🔧 Environment Variable Check:');
    const requiredEnvVars = [
      'GCS_IMAGES_BUCKET_NAME',
      'GCS_PDFS_BUCKET_NAME',
      'APP_URL'
    ];

    for (const varName of requiredEnvVars) {
      const value = process.env[varName];
      console.log(`  ${varName}: ${value ? '✅ Set' : '❌ Missing'}`);
      if (value) {
        console.log(`    Value: ${value}`);
      }
    }

    // Check for common URL patterns in the database
    console.log('\n🔍 Scanning for common URL patterns...');

    // Count placeholder URLs
    const placeholderCount = await db.collection<Book>('books').countDocuments({
      "pages.imageUrl": { $regex: /placeholder|Painting\+Page/ }
    });
    console.log(`  Books with placeholder images: ${placeholderCount}`);

    // Count valid GCS image URLs
    const validImageCount = await db.collection<Book>('books').countDocuments({
      "pages.imageUrl": { $regex: /storage\.googleapis\.com/ }
    });
    console.log(`  Books with valid GCS images: ${validImageCount}`);

    // Count valid PDF URLs
    const validPdfCount = await db.collection<Book>('books').countDocuments({
      pdfUrl: { $regex: /storage\.googleapis\.com/ }
    });
    console.log(`  Books with valid PDFs: ${validPdfCount}`);

    console.log('\n✅ URL format verification completed!');
    console.log('\n💡 Tips:');
    console.log('  - Ensure GCS buckets are properly configured');
    console.log('  - Check that service accounts have proper permissions');
    console.log('  - Verify APP_URL is set correctly for redirects');

  } catch (error) {
    log.error('💥 Error verifying URLs:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the verification function
verifySydneyURLs().catch(console.error);

export { verifySydneyURLs };