require('dotenv').config();
const { MongoClient } = require('mongodb');
const logger = require('../logger');

const log = logger;

async function setupIndexes() {
  log.info('🚀 Starting MongoDB Index Setup...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Define collections and their indexes
    const collectionsWithIndexes = [
      {
        name: 'books',
        indexes: [
          { key: { userId: 1 }, options: { background: true } },
          { key: { status: 1 }, options: { background: true } },
          { key: { createdAt: -1 }, options: { background: true } },
          { key: { userId: 1, createdAt: -1 }, options: { background: true } },
          { key: { gelatoOrderId: 1 }, options: { sparse: true, background: true } }, // Sparse index for Gelato Order ID (Webhook optimization)
          { key: { pdfUrl: 1 }, options: { sparse: true, background: true } }, // Sparse index for PDF URL
          { key: { finalPageCount: 1 }, options: { sparse: true, background: true } } // Sparse index for final page count
        ]
      },
      {
        name: 'users',
        indexes: [
          { key: { email: 1 }, options: { unique: true, background: true } },
          { key: { createdAt: -1 }, options: { background: true } },
          { key: { credits: 1 }, options: { background: true } },
          { key: { pdfsCount: 1 }, options: { background: true } },
          { key: { storiesCount: 1 }, options: { background: true } }
        ]
      },
      {
        name: 'orders',
        indexes: [
          { key: { bookId: 1 }, options: { background: true } },
          { key: { userId: 1 }, options: { background: true } },
          { key: { createdAt: -1 }, options: { background: true } },
          { key: { status: 1 }, options: { background: true } },
          { key: { stripeSessionId: 1 }, options: { sparse: true, background: true } } // Sparse for backward compatibility
        ]
      },
      {
        name: 'webhook_events',  // For webhook idempotency
        indexes: [
          { key: { eventId: 1 }, options: { unique: true, background: true } },
          { key: { processedAt: 1 }, options: { expireAfterSeconds: 604800 } } // Expire after 7 days
        ] 
      }
    ];

    // Create indexes for each collection
    for (const collectionSpec of collectionsWithIndexes) {
      const collection = db.collection(collectionSpec.name);
      log.info(`🔧 Setting up indexes for collection: ${collectionSpec.name}`);

      for (const indexSpec of collectionSpec.indexes) {
        try {
          // Check if index already exists
          const indexes = await collection.indexes();
          const indexExists = indexes.some(idx => 
            JSON.stringify(idx.key) === JSON.stringify(indexSpec.key)
          );

          if (!indexExists) {
            await collection.createIndex(indexSpec.key, indexSpec.options);
            log.info(`✅ Created index: ${JSON.stringify(indexSpec.key)} on ${collectionSpec.name}`);
          } else {
            log.info(`ℹ️ Index already exists: ${JSON.stringify(indexSpec.key)} on ${collectionSpec.name}`);
          }
        } catch (indexErr) {
          log.error(`❌ Error creating index ${JSON.stringify(indexSpec.key)} on ${collectionSpec.name}:`, indexErr.message);
        }
      }
    }

    log.info('🎉 All MongoDB indexes have been set up successfully!');
    log.info('💡 Indexes will improve query performance for common operations.');
  } catch (error) {
    log.error('💥 Error setting up MongoDB indexes:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the setup function
setupIndexes().catch(console.error);