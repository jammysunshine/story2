require('dotenv').config();
const { MongoClient } = require('mongodb');
const logger = require('../logger');

const log = logger;

async function migrateUserStats() {
  log.info('🔄 Starting user statistics migration...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Get all users
    const users = await db.collection('users').find({}).toArray();
    log.info(`🚀 Starting optimized migration for ${users.length} users...`);

    for (const user of users) {
      const email = user.email;
      
      // Find all books associated with this user
      const books = await db.collection('books').find({
        $or: [{ userId: email }, { userId: user._id.toString() }]
      }, {
        projection: { _id: 1, title: 1, status: 1, createdAt: 1, pdfUrl: 1, "pages.imageUrl": 1 }
      }).toArray();

      // Calculate statistics
      let storiesCount = books.length;
      let imagesCount = 0;
      let pdfsCount = 0;

      for (const book of books) {
        // Count images (pages with imageUrl)
        if (book.pages && Array.isArray(book.pages)) {
          imagesCount += book.pages.filter(page => page.imageUrl && !page.imageUrl.includes('placeholder')).length;
        }
        
        // Count PDFs
        if (book.pdfUrl) {
          pdfsCount++;
        }
      }

      // Update user record with calculated statistics
      await db.collection('users').updateOne(
        { _id: user._id },
        {
          $set: {
            storiesCount: storiesCount || 0,
            imagesCount: imagesCount || 0,
            pdfsCount: pdfsCount || 0,
            lastMigration: new Date()
          }
        }
      );

      log.info(`✅ ${email}: S:${storiesCount} I:${imagesCount} P:${pdfsCount}`);
    }

    log.info('\n🎉 Migration complete!');
    log.info('📈 User statistics have been recalculated and updated.');
    log.info('💡 This ensures accurate dashboard metrics for all users.');
  } catch (error) {
    log.error('💥 Migration failed:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the migration function
migrateUserStats().catch(console.error);