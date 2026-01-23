import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import logger from '../logger';

const log = logger;

interface Book {
  _id: ObjectId;
  title?: string;
  status?: string;
  userId?: string;
  [key: string]: any;
}

interface DeleteResult {
  deletedCount: number;
}

async function deleteBooksSimple() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('📚 Usage: node scripts/delete_books_simple.js <bookId1> [bookId2] [bookId3] ...');
    console.log('📚 Or: node scripts/delete_books_simple.js --user <email> (deletes all books for a user)');
    console.log('📚 Or: node scripts/delete_books_simple.js --status <status> (deletes all books with specific status)');
    console.log('📚 Or: node scripts/delete_books_simple.js --teaser (deletes all teaser books)');
    return;
  }

  console.log('🗑️ Starting simple book deletion...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI!, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    let deleteResult: DeleteResult;
    let deletedCount = 0;
    let description = '';

    if (args[0] === '--user') {
      // Delete all books for a specific user
      const userEmail = args[1];
      if (!userEmail) {
        console.error('❌ Error: Email required when using --user option');
        return;
      }

      console.log(`\n📧 Deleting all books for user: ${userEmail}`);
      deleteResult = await db.collection<Book>('books').deleteMany({ userId: userEmail });
      deletedCount = deleteResult.deletedCount;
      description = `all books for user ${userEmail}`;

    } else if (args[0] === '--status') {
      // Delete all books with a specific status
      const status = args[1];
      if (!status) {
        console.error('❌ Error: Status required when using --status option');
        return;
      }

      console.log(`\n🏷️  Deleting all books with status: ${status}`);
      deleteResult = await db.collection<Book>('books').deleteMany({ status: status });
      deletedCount = deleteResult.deletedCount;
      description = `all books with status '${status}'`;

    } else if (args[0] === '--teaser') {
      // Delete all teaser books
      console.log('\n👶 Deleting all teaser books...');
      deleteResult = await db.collection<Book>('books').deleteMany({ status: 'teaser' });
      deletedCount = deleteResult.deletedCount;
      description = 'all teaser books';

    } else {
      // Delete specific books by ID
      const bookIds = args.map(id => {
        if (!ObjectId.isValid(id)) {
          console.error(`❌ Invalid ObjectId: ${id}`);
          return null;
        }
        return new ObjectId(id);
      }).filter(id => id !== null) as ObjectId[];

      if (bookIds.length === 0) {
        console.error('❌ No valid book IDs provided');
        return;
      }

      console.log(`\n🆔 Deleting books with IDs: ${bookIds.map(id => id.toString()).join(', ')}`);

      // Fetch books to show titles before deletion
      const booksToDelete = await db.collection<Book>('books').find({ _id: { $in: bookIds } }).toArray();
      console.log('\n📖 Books to be deleted:');
      for (const book of booksToDelete) {
        console.log(`  • ${book.title || 'Untitled'} (ID: ${book._id}, Status: ${book.status || 'N/A'})`);
      }

      deleteResult = await db.collection<Book>('books').deleteMany({ _id: { $in: bookIds } });
      deletedCount = deleteResult.deletedCount;
      description = `${bookIds.length} specific book(s)`;
    }

    console.log(`\n✅ Successfully deleted ${deletedCount} ${description}`);

    // Also remove references from user records
    let updateUserResult;
    if (args[0] === '--user') {
      const userEmail = args[1];
      updateUserResult = await db.collection('users').updateMany(
        { email: userEmail },
        { $unset: { recentBooks: 1 } }  // Remove the recentBooks array
      );
      console.log(`🧹 Cleaned up recent books reference in ${updateUserResult.modifiedCount} user record(s)`);
    } else if (args[0] !== '--status' && args[0] !== '--teaser') {
      // For specific book IDs, remove references individually
      const bookIds = args.map(id => new ObjectId(id)).filter(id => ObjectId.isValid(id));
      updateUserResult = await db.collection('users').updateMany(
        { "recentBooks.id": { $in: bookIds.map(id => id.toString()) } },
        { $pull: { "recentBooks": { "id": { $in: bookIds.map(id => id.toString()) } } } }
      );
      console.log(`🧹 Cleaned up references in ${updateUserResult.modifiedCount} user record(s)`);
    }

    console.log('\n📋 DELETION SUMMARY:');
    console.log(`  • ${description} deleted: ${deletedCount}`);
    console.log(`  • Matching user records updated: ${updateUserResult ? updateUserResult.modifiedCount : 'N/A'}`);

    console.log('\n✅ Simple book deletion completed!');

  } catch (error) {
    log.error('💥 Error deleting books:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the deletion function
deleteBooksSimple().catch(console.error);

export { deleteBooksSimple };