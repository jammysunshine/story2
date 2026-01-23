import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import logger from '../logger';

const log = logger;

interface BookPage {
  imageUrl?: string;
  [key: string]: any;
}

interface Book {
  _id: ObjectId;
  title?: string;
  userId?: string;
  createdAt?: Date;
  pages?: BookPage[];
  [key: string]: any;
}

interface User {
  _id: ObjectId;
  recentBooks?: Array<{ id: string }>;
  [key: string]: any;
}

async function removeBooksNoImages() {
  console.log('🗑️ Starting removal of books with no images...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI!, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    console.log('\n🔍 FINDING BOOKS WITH NO IMAGES:\n');

    // Find books with no images
    // Criteria: books where all pages have no imageUrl or only placeholder images
    const books = await db.collection<Book>('books').find({}).toArray();

    let booksWithNoImages: Book[] = [];
    let booksWithOnlyPlaceholders: Book[] = [];

    for (const book of books) {
      if (!book.pages || book.pages.length === 0) {
        booksWithNoImages.push(book);
        continue;
      }

      // Check if all pages have no images or only placeholders
      const pagesWithRealImages = book.pages.filter(page =>
        page.imageUrl &&
        !page.imageUrl.includes('placeholder') &&
        !page.imageUrl.includes('via.placeholder.com') &&
        !page.imageUrl.includes('Painting+Page') &&
        page.imageUrl.trim() !== ''
      );

      if (pagesWithRealImages.length === 0) {
        if (book.pages.length > 0) {
          booksWithOnlyPlaceholders.push(book);
        } else {
          booksWithNoImages.push(book);
        }
      }
    }

    console.log(`📋 Books with no pages: ${booksWithNoImages.length}`);
    console.log(`📋 Books with only placeholder images: ${booksWithOnlyPlaceholders.length}`);
    console.log(`📋 Total books to remove: ${booksWithNoImages.length + booksWithOnlyPlaceholders.length}`);

    // Show details of books that would be removed
    if (booksWithNoImages.length > 0) {
      console.log('\n📖 BOOKS WITH NO PAGES (will be removed):');
      for (const book of booksWithNoImages) {
        console.log(`  • ${book.title || 'Untitled'} (ID: ${book._id}, User: ${book.userId || 'Guest'}, Created: ${book.createdAt ? new Date(book.createdAt).toISOString().split('T')[0] : 'Unknown'})`);
      }
    }

    if (booksWithOnlyPlaceholders.length > 0) {
      console.log('\n🖼️  BOOKS WITH ONLY PLACEHOLDER IMAGES (will be removed):');
      for (const book of booksWithOnlyPlaceholders) {
        console.log(`  • ${book.title || 'Untitled'} (ID: ${book._id}, Pages: ${book.pages.length}, User: ${book.userId || 'Guest'}, Created: ${book.createdAt ? new Date(book.createdAt).toISOString().split('T')[0] : 'Unknown'})`);
      }
    }

    // Confirmation step
    const totalToRemove = booksWithNoImages.length + booksWithOnlyPlaceholders.length;
    if (totalToRemove === 0) {
      console.log('\n✅ No books found that match the criteria for removal.');
      return;
    }

    console.log(`\n⚠️  WARNING: About to remove ${totalToRemove} books.`);

    // Check if --force flag is provided
    const force = process.argv.includes('--force') || process.argv.includes('-f');
    if (!force) {
      console.log('💡 Run with --force or -f flag to actually perform the deletion.');
      console.log('   Example: node scripts/remove_books_no_images.js --force');
      return;
    }

    console.log('🚀 Performing deletion with --force flag...');

    // Perform the deletion
    let deletedCount = 0;

    // Delete books with no pages
    if (booksWithNoImages.length > 0) {
      const idsToDelete = booksWithNoImages.map(book => book._id);
      const result = await db.collection<Book>('books').deleteMany({
        _id: { $in: idsToDelete }
      });
      deletedCount += result.deletedCount;
      console.log(`✅ Deleted ${result.deletedCount} books with no pages`);
    }

    // Delete books with only placeholder images
    if (booksWithOnlyPlaceholders.length > 0) {
      const idsToDelete = booksWithOnlyPlaceholders.map(book => book._id);
      const result = await db.collection<Book>('books').deleteMany({
        _id: { $in: idsToDelete }
      });
      deletedCount += result.deletedCount;
      console.log(`✅ Deleted ${result.deletedCount} books with only placeholder images`);
    }

    console.log(`\n🎉 COMPLETED: Successfully removed ${deletedCount} books from the database.`);

    // Also clean up any orphaned references in users' recentBooks
    console.log('\n🧹 Cleaning up orphaned references in user records...');

    // Get all the IDs that were deleted
    const allDeletedIds = [
      ...booksWithNoImages.map(b => b._id.toString()),
      ...booksWithOnlyPlaceholders.map(b => b._id.toString())
    ];

    const usersUpdated = await db.collection<User>('users').updateMany(
      { "recentBooks.id": { $in: allDeletedIds } },
      { $pull: { "recentBooks": { "id": { $in: allDeletedIds } } } }
    );

    console.log(`✅ Cleaned up references in ${usersUpdated.modifiedCount} user records`);

    // Summary
    console.log('\n📋 REMOVAL SUMMARY:');
    console.log(`  • Books with no pages removed: ${booksWithNoImages.length}`);
    console.log(`  • Books with only placeholders removed: ${booksWithOnlyPlaceholders.length}`);
    console.log(`  • Total books removed: ${deletedCount}`);
    console.log(`  • User records updated: ${usersUpdated.modifiedCount}`);

    console.log('\n✅ Books with no images removal completed!');

  } catch (error) {
    log.error('💥 Error removing books with no images:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the removal function
removeBooksNoImages().catch(console.error);

export { removeBooksNoImages };