require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const logger = require('../logger');

const log = logger;

async function quickCleanup() {
  console.log('🧹 Starting quick cleanup operations...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    console.log('\n🔍 ANALYZING CLEANUP OPPORTUNITIES:\n');

    // 1. Cleanup temporary/guest books (without user ID and older than 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const guestBooks = await db.collection('books').countDocuments({
      userId: { $exists: false },
      createdAt: { $lt: oneDayAgo },
      status: { $in: ['teaser', 'draft'] } // Only delete incomplete books
    });

    console.log(`📋 Guest books older than 24h (to be deleted): ${guestBooks}`);

    if (guestBooks > 0) {
      const deleteGuestBooks = process.argv.includes('--delete-guest-books') || 
                               process.argv.includes('-dgb');
      if (deleteGuestBooks) {
        const result = await db.collection('books').deleteMany({
          userId: { $exists: false },
          createdAt: { $lt: oneDayAgo },
          status: { $in: ['teaser', 'draft'] }
        });
        console.log(`✅ Deleted ${result.deletedCount} guest books`);
      } else {
        console.log(`💡 Run with --delete-guest-books to perform this cleanup`);
      }
    }

    // 2. Cleanup books with no pages (failed generation)
    const booksWithNoPages = await db.collection('books').countDocuments({
      $or: [
        { pages: { $exists: false } },
        { pages: { $size: 0 } },
        { pages: null }
      ],
      createdAt: { $lt: oneDayAgo }
    });

    console.log(`📋 Books with no pages (to be deleted): ${booksWithNoPages}`);

    if (booksWithNoPages > 0) {
      const deleteEmptyBooks = process.argv.includes('--delete-empty-books') || 
                               process.argv.includes('-deb');
      if (deleteEmptyBooks) {
        const result = await db.collection('books').deleteMany({
          $or: [
            { pages: { $exists: false } },
            { pages: { $size: 0 } },
            { pages: null }
          ],
          createdAt: { $lt: oneDayAgo }
        });
        console.log(`✅ Deleted ${result.deletedCount} empty books`);
      } else {
        console.log(`💡 Run with --delete-empty-books to perform this cleanup`);
      }
    }

    // 3. Cleanup failed books older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const failedBooks = await db.collection('books').countDocuments({
      status: 'failed',
      createdAt: { $lt: sevenDaysAgo }
    });

    console.log(`📋 Failed books older than 7 days (to be deleted): ${failedBooks}`);

    if (failedBooks > 0) {
      const deleteFailedBooks = process.argv.includes('--delete-failed-books') || 
                                process.argv.includes('-dfb');
      if (deleteFailedBooks) {
        const result = await db.collection('books').deleteMany({
          status: 'failed',
          createdAt: { $lt: sevenDaysAgo }
        });
        console.log(`✅ Deleted ${result.deletedCount} failed books`);
      } else {
        console.log(`💡 Run with --delete-failed-books to perform this cleanup`);
      }
    }

    // 4. Cleanup old webhook events (older than 7 days)
    const oldWebhookEvents = await db.collection('webhook_events').countDocuments({
      processedAt: { $lt: sevenDaysAgo }
    });

    console.log(`📋 Old webhook events (to be deleted): ${oldWebhookEvents}`);

    if (oldWebhookEvents > 0) {
      const deleteWebhookEvents = process.argv.includes('--delete-webhook-events') || 
                                  process.argv.includes('-dwe');
      if (deleteWebhookEvents) {
        const result = await db.collection('webhook_events').deleteMany({
          processedAt: { $lt: sevenDaysAgo }
        });
        console.log(`✅ Deleted ${result.deletedCount} old webhook events`);
      } else {
        console.log(`💡 Run with --delete-webhook-events to perform this cleanup`);
      }
    }

    // 5. Cleanup test users (emails containing 'test' or 'example')
    const testUsers = await db.collection('users').countDocuments({
      email: { $regex: /test|example/i }
    });

    console.log(`📋 Test users (to be deleted): ${testUsers}`);

    if (testUsers > 0) {
      const deleteTestUsers = process.argv.includes('--delete-test-users') || 
                              process.argv.includes('-dtu');
      if (deleteTestUsers) {
        const result = await db.collection('users').deleteMany({
          email: { $regex: /test|example/i }
        });
        console.log(`✅ Deleted ${result.deletedCount} test users`);
      } else {
        console.log(`💡 Run with --delete-test-users to perform this cleanup`);
      }
    }

    // 6. Check for orphaned orders (orders without corresponding books)
    const allOrders = await db.collection('orders').find({}).toArray();
    let orphanedOrders = 0;
    
    for (const order of allOrders) {
      const bookExists = await db.collection('books').findOne({ _id: order.bookId });
      if (!bookExists) {
        orphanedOrders++;
      }
    }

    console.log(`📋 Orphaned orders (to be deleted): ${orphanedOrders}`);

    if (orphanedOrders > 0) {
      const deleteOrphanedOrders = process.argv.includes('--delete-orphaned-orders') || 
                                   process.argv.includes('-doo');
      if (deleteOrphanedOrders) {
        // This is more complex as we need to identify the orphaned orders
        for (const order of allOrders) {
          const bookExists = await db.collection('books').findOne({ _id: order.bookId });
          if (!bookExists) {
            await db.collection('orders').deleteOne({ _id: order._id });
          }
        }
        console.log(`✅ Deleted ${orphanedOrders} orphaned orders`);
      } else {
        console.log(`💡 Run with --delete-orphaned-orders to perform this cleanup`);
      }
    }

    // Summary
    console.log('\n📋 QUICK CLEANUP SUMMARY:');
    console.log('   This script identifies potential cleanup opportunities.');
    console.log('   Run with appropriate flags to perform actual deletions.');
    console.log('   Always backup your database before performing bulk deletions.');
    
    console.log('\n💡 AVAILABLE FLAGS:');
    console.log('   --delete-guest-books (-dgb): Delete old guest books');
    console.log('   --delete-empty-books (-deb): Delete books with no pages');
    console.log('   --delete-failed-books (-dfb): Delete old failed books');
    console.log('   --delete-webhook-events (-dwe): Delete old webhook events');
    console.log('   --delete-test-users (-dtu): Delete test users');
    console.log('   --delete-orphaned-orders (-doo): Delete orphaned orders');

    console.log('\n✅ Quick cleanup analysis completed!');

  } catch (error) {
    log.error('💥 Error during quick cleanup:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the cleanup function
quickCleanup().catch(console.error);