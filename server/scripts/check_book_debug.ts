import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import logger from '../logger';

const log = logger;

interface BookPage {
  pageNumber: number;
  text: string;
  prompt: string;
  imageUrl?: string;
  type?: string;
}

interface Book {
  _id: ObjectId;
  title?: string;
  childName?: string;
  status?: string;
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  pages?: BookPage[];
  pdfUrl?: string;
  finalPageCount?: number;
  gelatoOrderId?: string;
  gelatoOrderStatus?: string;
  shippingDetails?: any;
  animal?: string;
  location?: string;
  lesson?: string;
  characterStyle?: string;
  heroBible?: string;
  animalBible?: string;
  finalPrompt?: string;
  isDigitalUnlocked?: boolean;
  [key: string]: any;
}

async function checkBookDebug() {
  const args = process.argv.slice(2);
  const bookId = args[0];

  if (!bookId) {
    console.log('📖 Usage: node scripts/check_book_debug.js <bookId>');
    console.log('📖 Or run without arguments to check the most recent book');
    return;
  }

  log.info('🔍 Starting book debug check...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI!, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    let book: Book | null;
    if (bookId && ObjectId.isValid(bookId)) {
      // Find specific book by ID
      book = await db.collection<Book>('books').findOne({ _id: new ObjectId(bookId) });
    } else {
      // Find the most recent book
      book = await db.collection<Book>('books').findOne({}, { sort: { createdAt: -1 } as any });
    }

    if (!book) {
      console.log('❌ No book found.');
      return;
    }

    console.log('\n📖 BOOK DEBUG REPORT');
    console.log('=====================');
    console.log(`ID: ${book._id}`);
    console.log(`Title: ${book.title || 'N/A'}`);
    console.log(`Child Name: ${book.childName || 'N/A'}`);
    console.log(`Status: ${book.status || 'N/A'}`);
    console.log(`User ID: ${book.userId || 'N/A'}`);
    console.log(`Created: ${book.createdAt ? new Date(book.createdAt).toISOString() : 'N/A'}`);
    console.log(`Updated: ${book.updatedAt ? new Date(book.updatedAt).toISOString() : 'N/A'}`);

    console.log(`\n📋 PAGES:`);
    console.log(`Total Pages: ${book.pages ? book.pages.length : 0}`);

    if (book.pages && book.pages.length > 0) {
      for (let i = 0; i < Math.min(book.pages.length, 5); i++) { // Show first 5 pages
        const page = book.pages[i];
        console.log(`  Page ${page.pageNumber || i+1}: ${page.type || 'story'} - ${page.imageUrl ? '✅ Image' : '❌ No Image'}`);
      }

      if (book.pages.length > 5) {
        console.log(`  ... and ${book.pages.length - 5} more pages`);
      }
    }

    console.log(`\n🖼️ IMAGES:`);
    if (book.pages) {
      const imagePages = book.pages.filter(p => p.imageUrl);
      const missingImages = book.pages.filter(p => !p.imageUrl);
      console.log(`Pages with images: ${imagePages.length}`);
      console.log(`Pages missing images: ${missingImages.length}`);

      if (missingImages.length > 0) {
        console.log(`Missing image pages: ${missingImages.map(p => p.pageNumber).join(', ')}`);
      }
    }

    console.log(`\n📄 PDF INFO:`);
    console.log(`PDF URL: ${book.pdfUrl ? '✅ Available' : '❌ None'}`);
    console.log(`Final Page Count: ${book.finalPageCount || 'Not set'}`);
    console.log(`PDF Ready Status: ${book.status === 'pdf_ready' ? '✅ Yes' : '❌ No'}`);

    console.log(`\n📦 FULFILLMENT INFO:`);
    console.log(`Gelato Order ID: ${book.gelatoOrderId || 'Not set'}`);
    console.log(`Gelato Order Status: ${book.gelatoOrderStatus || 'Not set'}`);
    console.log(`Shipping Details: ${book.shippingDetails ? '✅ Available' : '❌ None'}`);

    console.log(`\n🎨 CREATION DETAILS:`);
    console.log(`Animal: ${book.animal || 'N/A'}`);
    console.log(`Location: ${book.location || 'N/A'}`);
    console.log(`Lesson: ${book.lesson || 'N/A'}`);
    console.log(`Character Style: ${book.characterStyle || 'N/A'}`);

    console.log(`\n🧠 BIBLES:`);
    console.log(`Hero Bible: ${book.heroBible ? '✅ Available' : '❌ None'}`);
    console.log(`Animal Bible: ${book.animalBible ? '✅ Available' : '❌ None'}`);
    console.log(`Final Prompt: ${book.finalPrompt ? '✅ Available' : '❌ None'}`);

    console.log(`\n💳 PAYMENT INFO:`);
    console.log(`Digital Unlocked: ${book.isDigitalUnlocked ? '✅ Yes' : '❌ No'}`);

    // Check for potential issues
    console.log(`\n⚠️  POTENTIAL ISSUES:`);
    const issues = [];

    if (!book.title) issues.push('Missing title');
    if (!book.childName) issues.push('Missing child name');
    if (!book.pages || book.pages.length === 0) issues.push('No pages');
    if (book.pages && book.pages.some(p => !p.imageUrl)) issues.push('Some pages missing images');
    if (!book.heroBible) issues.push('Missing hero bible');
    if (!book.animalBible) issues.push('Missing animal bible');
    if (!book.userId) issues.push('No user ID (guest book)');

    if (issues.length > 0) {
      issues.forEach(issue => console.log(`  • ${issue}`));
    } else {
      console.log(`  ✅ No obvious issues detected`);
    }

    console.log('\n✅ Book debug check completed!');

  } catch (error) {
    log.error('💥 Error checking book:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the check function
checkBookDebug().catch(console.error);

export { checkBookDebug };