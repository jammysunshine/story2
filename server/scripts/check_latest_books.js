require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const logger = require('../logger');

const log = logger;

async function checkLatestBooks() {
  log.info('🔍 Checking latest books in the database...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Get the 10 most recent books
    const books = await db.collection('books').find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    if (books.length === 0) {
      console.log('📭 No books found in the database.');
      return;
    }

    console.log(`\n📚 Found ${books.length} most recent books:\n`);
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ ID              │ Title                                    │ Status      │ Pages │');
    console.log('├─────────────────┼──────────────────────────────────────────┼─────────────┼───────┤');

    for (const book of books) {
      const id = book._id.toString().substring(0, 15) + '...';
      const title = (book.title || 'Untitled').substring(0, 38).padEnd(38);
      const status = (book.status || 'unknown').padEnd(11);
      const pageCount = (book.pages ? book.pages.length : 0).toString().padStart(5);

      console.log(`│ ${id} │ ${title} │ ${status} │ ${pageCount} │`);
      
      // Additional details for each book
      console.log(`│                 ├──────────────────────────────────────────┼─────────────┼───────┤`);
      console.log(`│                 │ User: ${(book.userId || 'guest').substring(0, 48).padEnd(48)} │ PDF: ${book.pdfUrl ? '✅' : '❌'}     │       │`);
      console.log(`│                 │ Created: ${new Date(book.createdAt).toISOString().substring(0, 19)}          │ Gelato: ${book.gelatoOrderId ? '✅' : '❌'}   │       │`);
      console.log(`│                 │ Child: ${book.childName || 'N/A'}                           │ Status: ${book.gelatoOrderStatus || 'N/A'} │       │`);
      console.log('├─────────────────┼──────────────────────────────────────────┼─────────────┼───────┤');
    }

    console.log('└─────────────────┴──────────────────────────────────────────┴─────────────┴───────┘');

    // Summary statistics
    const statusCounts = {};
    const userCounts = {};
    
    for (const book of books) {
      statusCounts[book.status] = (statusCounts[book.status] || 0) + 1;
      if (book.userId) {
        userCounts[book.userId] = (userCounts[book.userId] || 0) + 1;
      }
    }

    console.log('\n📊 Summary Statistics:');
    console.log('Status Distribution:');
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`  • ${status}: ${count}`);
    }

    if (Object.keys(userCounts).length > 0) {
      console.log('\nTop Users:');
      const sortedUsers = Object.entries(userCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [user, count] of sortedUsers) {
        console.log(`  • ${user}: ${count} books`);
      }
    }

  } catch (error) {
    log.error('💥 Error checking latest books:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the check function
checkLatestBooks().catch(console.error);