import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import logger from '../logger';

const log = logger;

interface BookPage {
  pageNumber: number;
  text?: string;
  prompt?: string;
  imageUrl?: string;
}

interface Book {
  _id: ObjectId;
  title?: string;
  status?: string;
  userId?: string;
  createdAt?: Date;
  pages?: BookPage[];
  [key: string]: any;
}

async function checkTruncatedBooks() {
  log.info('📚 Starting truncated books check...');

  // Expected number of pages (based on environment or default)
  const expectedPages = parseInt(process.env.STORY_PAGES_COUNT || '23');
  const expectedTeaserPages = parseInt(process.env.STORY_TEASER_PAGES_COUNT || '7');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI!, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Get all books
    const books = await db.collection<Book>('books').find({}).toArray();

    console.log(`\n📖 Found ${books.length} books in the database`);
    console.log(`📋 Expected pages per book: ${expectedPages} (full), ${expectedTeaserPages} (teaser)\n`);

    // Categorize books by page count
    const booksWithExpectedPages = books.filter(book => book.pages && book.pages.length === expectedPages);
    const booksWithTeaserPages = books.filter(book => book.pages && book.pages.length === expectedTeaserPages);
    const booksWithFewerPages = books.filter(book => book.pages && book.pages.length > 0 && book.pages.length < expectedTeaserPages);
    const booksWithZeroPages = books.filter(book => !book.pages || book.pages.length === 0);
    const booksWithTooManyPages = books.filter(book => book.pages && book.pages.length > expectedPages);

    console.log('📊 BOOK PAGE COUNT ANALYSIS:');
    console.log(`  • Full books (expected ${expectedPages} pages): ${booksWithExpectedPages.length}`);
    console.log(`  • Teaser books (expected ${expectedTeaserPages} pages): ${booksWithTeaserPages.length}`);
    console.log(`  • Books with fewer than expected pages: ${booksWithFewerPages.length}`);
    console.log(`  • Books with zero pages: ${booksWithZeroPages.length}`);
    console.log(`  • Books with too many pages: ${booksWithTooManyPages.length}`);

    // Show truncated books in detail
    if (booksWithFewerPages.length > 0) {
      console.log('\n⚠️  BOOKS WITH FEWER THAN EXPECTED PAGES:');
      for (const book of booksWithFewerPages) {
        console.log(`\n  📖 ${book.title || 'Untitled'} (ID: ${book._id})`);
        console.log(`     Pages: ${book.pages.length}/${expectedTeaserPages} (${book.status || 'unknown status'})`);
        console.log(`     User: ${book.userId || 'Guest'}`);
        console.log(`     Created: ${book.createdAt ? new Date(book.createdAt).toISOString() : 'Unknown'}`);

        // Check if it's supposed to be a full book but has fewer pages
        if (book.status === 'paid' || book.status === 'pdf_ready' || book.status === 'printing') {
          console.log(`     ⚠️  ISSUE: Paid book with only ${book.pages.length} pages (should have ${expectedPages})`);
        }
      }
    }

    // Show books with zero pages
    if (booksWithZeroPages.length > 0) {
      console.log('\n❌ BOOKS WITH ZERO PAGES (SEVERELY TRUNCATED):');
      for (const book of booksWithZeroPages) {
        console.log(`\n  📖 ${book.title || 'Untitled'} (ID: ${book._id})`);
        console.log(`     Status: ${book.status || 'unknown'}`);
        console.log(`     User: ${book.userId || 'Guest'}`);
        console.log(`     Created: ${book.createdAt ? new Date(book.createdAt).toISOString() : 'Unknown'}`);
        console.log(`     ⚠️  CRITICAL: This book has no pages at all!`);
      }
    }

    // Check for books with missing content
    console.log('\n🔍 CHECKING FOR CONTENT INTEGRITY...');
    let booksWithMissingContent = 0;
    let booksWithMissingPrompts = 0;
    let booksWithMissingText = 0;

    for (const book of books) {
      if (book.pages && book.pages.length > 0) {
        // Check if pages have content
        const pagesWithoutText = book.pages.filter(page => !page.text);
        const pagesWithoutPrompts = book.pages.filter(page => !page.prompt);

        if (pagesWithoutText.length > 0) {
          booksWithMissingText++;
          if (pagesWithoutText.length === book.pages.length) {
            log.info(`⚠️ Book ${book._id} has no text in any pages`);
          }
        }

        if (pagesWithoutPrompts.length > 0) {
          booksWithMissingPrompts++;
          if (pagesWithoutPrompts.length === book.pages.length) {
            log.info(`⚠️ Book ${book._id} has no prompts in any pages`);
          }
        }

        // Check if any page is completely empty
        const emptyPages = book.pages.filter(page => !page.text && !page.prompt && !page.imageUrl);
        if (emptyPages.length > 0) {
          booksWithMissingContent++;
          log.info(`⚠️ Book ${book._id} has ${emptyPages.length} completely empty pages`);
        }
      }
    }

    console.log(`  • Books with missing text: ${booksWithMissingText}`);
    console.log(`  • Books with missing prompts: ${booksWithMissingPrompts}`);
    console.log(`  • Books with missing content: ${booksWithMissingContent}`);

    // Check for books that are in 'paid' status but have incomplete content
    const paidBooks = books.filter(book => book.status === 'paid');
    const paidBooksWithIssues = paidBooks.filter(book =>
      !book.pages ||
      book.pages.length < expectedPages ||
      (book.pages && book.pages.some(page => !page.text || !page.prompt))
    );

    console.log(`\n💳 PAID BOOKS WITH ISSUES: ${paidBooksWithIssues.length} out of ${paidBooks.length} paid books`);
    if (paidBooksWithIssues.length > 0) {
      console.log('  These books may need regeneration or refund processing:');
      for (const book of paidBooksWithIssues) {
        console.log(`    • ${book.title || 'Untitled'} (${book.pages ? book.pages.length : 0} pages, ID: ${book._id})`);
      }
    }

    // Summary
    console.log('\n📋 TRUNCATION SUMMARY:');
    const totalIssues = booksWithFewerPages.length + booksWithZeroPages.length + booksWithMissingContent;
    console.log(`  • Total books with potential truncation issues: ${totalIssues}`);
    console.log(`  • Percentage of affected books: ${books.length > 0 ? Math.round((totalIssues / books.length) * 100) : 0}%`);

    if (totalIssues === 0) {
      console.log('\n✅ No truncation issues detected! All books have expected page counts.');
    } else {
      console.log('\n💡 Recommended Actions:');
      console.log('  • Investigate books with zero pages - these may need regeneration');
      console.log('  • Check paid books with incomplete content - may need refunds or regeneration');
      console.log('  • Verify the story generation process for books with missing content');
    }

    // Environment configuration check
    console.log('\n🔧 STORY GENERATION CONFIGURATION:');
    const storyVars = [
      'STORY_PAGES_COUNT',
      'STORY_TEASER_PAGES_COUNT',
      'GOOGLE_API_KEY',
      'GOOGLE_IMAGE_MODEL'
    ];

    for (const varName of storyVars) {
      const isSet = !!process.env[varName];
      console.log(`  ${varName}: ${isSet ? '✅ Set' : '❌ Missing'}`);
      if (process.env[varName]) {
        console.log(`    Value: ${process.env[varName]}`);
      }
    }

    console.log('\n✅ Truncated books check completed!');

  } catch (error) {
    log.error('💥 Error checking for truncated books:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the check function
checkTruncatedBooks().catch(console.error);

export { checkTruncatedBooks };