import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import logger from '../logger';
import { generateImages } from '../imageService';

const log = logger;

interface BookPage {
  pageNumber?: number;
  imageUrl?: string;
  [key: string]: any;
}

interface Book {
  _id: ObjectId;
  title?: string;
  pages: BookPage[];
  [key: string]: any;
}

async function testGenerateImagesDirect() {
  console.log('🎨 Testing image generation service directly...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI!, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Find a book to test with
    const book = await db.collection<Book>('books').findOne({
      pages: { $exists: true, $ne: null },
      "pages.length": { $gt: 0 }
    });

    if (!book) {
      console.log('❌ No books found to test image generation. Create a book first.');
      return;
    }

    console.log(`📖 Testing with book: ${book.title || 'Untitled'} (ID: ${book._id})`);
    console.log(`📊 Pages to process: ${book.pages.length}`);

    // Check if images already exist
    const pagesWithImages = book.pages.filter(page => page.imageUrl && !page.imageUrl.includes('placeholder'));
    const pagesWithoutImages = book.pages.filter(page => !page.imageUrl || page.imageUrl.includes('placeholder'));

    console.log(`🖼️  Pages with images: ${pagesWithImages.length}`);
    console.log(`🖼️  Pages without images: ${pagesWithoutImages.length}`);

    if (pagesWithoutImages.length === 0) {
      console.log('✅ All pages already have images. Nothing to generate.');
      return;
    }

    console.log('\n🔄 Starting direct image generation test...');

    // Test the generateImages function directly
    const startTime = Date.now();
    try {
      await generateImages(db, book._id.toString());
      const totalTime = Date.now() - startTime;

      console.log(`✅ Image generation completed successfully in ${totalTime}ms!`);

      // Verify the results
      const updatedBook = await db.collection<Book>('books').findOne({ _id: book._id });
      if (!updatedBook) {
        console.error('❌ Could not retrieve updated book after image generation');
        return;
      }
      
      const newPagesWithImages = updatedBook.pages.filter(page => page.imageUrl && !page.imageUrl.includes('placeholder'));
      const newlyGenerated = newPagesWithImages.length - pagesWithImages.length;

      console.log(`📊 Results: ${newlyGenerated} new images generated`);
      console.log(`📊 Total images now: ${newPagesWithImages.length}/${updatedBook.pages.length}`);

      // Show details of first few pages
      console.log('\n🖼️  Updated page images:');
      for (let i = 0; i < Math.min(3, updatedBook.pages.length); i++) {
        const page = updatedBook.pages[i];
        console.log(`  Page ${page.pageNumber || i+1}: ${page.imageUrl ? '✅ Generated' : '❌ Pending'}`);
      }

    } catch (generationError) {
      console.error('❌ Image generation failed:', (generationError as Error).message);
      if (generationError instanceof Error) {
        console.error('Stack trace:', generationError.stack);
      }
    }

    // Test environment configuration
    console.log('\n🔧 Environment Configuration Check:');
    const requiredEnvVars = [
      'GOOGLE_API_KEY',
      'GOOGLE_IMAGE_MODEL',
      'GCS_IMAGES_BUCKET_NAME',
      'GOOGLE_APPLICATION_CREDENTIALS'
    ];

    for (const varName of requiredEnvVars) {
      const isSet = !!process.env[varName];
      console.log(`  ${varName}: ${isSet ? '✅ Set' : '❌ Missing'}`);
    }

    // Test Google AI configuration
    console.log('\n🤖 Google AI Configuration:');
    if (process.env.GOOGLE_API_KEY) {
      console.log(`  API Key: ✅ Set (length: ${process.env.GOOGLE_API_KEY.length})`);
    } else {
      console.log(`  API Key: ❌ Missing`);
    }

    if (process.env.GOOGLE_IMAGE_MODEL) {
      console.log(`  Image Model: ${process.env.GOOGLE_IMAGE_MODEL}`);
    } else {
      console.log(`  Image Model: ❌ Using default`);
    }

    // Test GCS configuration
    console.log('\n☁️  Google Cloud Storage Configuration:');
    if (process.env.GCS_IMAGES_BUCKET_NAME) {
      console.log(`  Images Bucket: ${process.env.GCS_IMAGES_BUCKET_NAME}`);
    } else {
      console.log(`  Images Bucket: ❌ Not set`);
    }

    console.log('\n💡 Notes:');
    console.log('  - Image generation may take several minutes depending on page count');
    console.log('  - Ensure your Google API key has Image generation permissions');
    console.log('  - Check that your GCS bucket exists and is writable');
    console.log('  - Monitor costs as image generation uses Google AI credits');

  } catch (error) {
    console.error('💥 Error testing image generation:', (error as Error).message);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the test function
testGenerateImagesDirect().catch(console.error);

export { testGenerateImagesDirect };