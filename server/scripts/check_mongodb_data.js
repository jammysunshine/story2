require('dotenv').config();
const { MongoClient } = require('mongodb');
const logger = require('../logger');

const log = logger;

async function checkMongoDBData() {
  log.info('🔍 Starting MongoDB data integrity check...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Get all collections
    const collections = await db.collections();
    log.info(`🗄️ Found ${collections.length} collections in the database`);

    // Check each collection
    for (const collection of collections) {
      const collectionName = collection.collectionName;
      const count = await collection.countDocuments();
      console.log(`\n📋 Collection: ${collectionName} (${count} documents)`);

      if (count > 0) {
        // Get a sample document to inspect structure
        const sampleDoc = await collection.findOne({});
        if (sampleDoc) {
          const fields = Object.keys(sampleDoc).filter(key => !key.startsWith('_'));
          console.log(`  • Fields: ${fields.length} (${fields.join(', ')})`);
          
          // Check for common required fields based on collection name
          if (collectionName === 'books') {
            const requiredFields = ['title', 'childName', 'pages', 'status', 'createdAt'];
            const missingFields = requiredFields.filter(field => !(field in sampleDoc));
            if (missingFields.length > 0) {
              console.log(`  ⚠️  Missing required fields: ${missingFields.join(', ')}`);
            } else {
              console.log(`  ✅ All required fields present`);
            }
          } else if (collectionName === 'users') {
            const requiredFields = ['email', 'name', 'createdAt'];
            const missingFields = requiredFields.filter(field => !(field in sampleDoc));
            if (missingFields.length > 0) {
              console.log(`  ⚠️  Missing required fields: ${missingFields.join(', ')}`);
            } else {
              console.log(`  ✅ All required fields present`);
            }
          } else if (collectionName === 'orders') {
            const requiredFields = ['bookId', 'userId', 'amount', 'status', 'createdAt'];
            const missingFields = requiredFields.filter(field => !(field in sampleDoc));
            if (missingFields.length > 0) {
              console.log(`  ⚠️  Missing required fields: ${missingFields.join(', ')}`);
            } else {
              console.log(`  ✅ All required fields present`);
            }
          }
        }
      } else {
        console.log(`  📄 No documents in this collection`);
      }
    }

    // Check for orphaned records
    console.log('\n🔍 Checking for potential orphaned records...');

    // Check for books without corresponding users
    const books = await db.collection('books').find({ userId: { $exists: true, $ne: null } }).toArray();
    const bookUserIds = [...new Set(books.map(b => b.userId))].filter(id => id);
    
    if (bookUserIds.length > 0) {
      const users = await db.collection('users').find({ email: { $in: bookUserIds } }).toArray();
      const userEmails = new Set(users.map(u => u.email));
      
      const orphanedBooks = bookUserIds.filter(id => !userEmails.has(id));
      console.log(`  • Books with non-existent users: ${orphanedBooks.length}`);
    }

    // Check for orders without corresponding books
    const orders = await db.collection('orders').find({ bookId: { $exists: true } }).toArray();
    if (orders.length > 0) {
      const orderBookIds = [...new Set(orders.map(o => o.bookId.toString()))];
      const books = await db.collection('books').find({ _id: { $in: orderBookIds.map(id => new db.collection('books').database.ObjectId(id)) } }).toArray();
      const bookIds = new Set(books.map(b => b._id.toString()));
      
      const orphanedOrders = orderBookIds.filter(id => !bookIds.has(id));
      console.log(`  • Orders with non-existent books: ${orphanedOrders.length}`);
    }

    // Check for data consistency
    console.log('\n🔍 Checking data consistency...');

    // Check for books with invalid status values
    const allBooks = await db.collection('books').find({}).toArray();
    const validStatuses = ['teaser', 'draft', 'generating', 'preview', 'paid', 'pdf_ready', 'printing', 'shipped', 'failed', 'fulfillment_error'];
    const invalidStatusBooks = allBooks.filter(book => book.status && !validStatuses.includes(book.status));
    console.log(`  • Books with invalid status: ${invalidStatusBooks.length}`);

    // Check for books with missing required fields
    const booksWithoutTitle = allBooks.filter(book => !book.title);
    const booksWithoutChildName = allBooks.filter(book => !book.childName);
    const booksWithoutPages = allBooks.filter(book => !book.pages || book.pages.length === 0);
    
    console.log(`  • Books without title: ${booksWithoutTitle.length}`);
    console.log(`  • Books without child name: ${booksWithoutChildName.length}`);
    console.log(`  • Books without pages: ${booksWithoutPages.length}`);

    console.log('\n✅ MongoDB data integrity check completed!');
  } catch (error) {
    log.error('💥 Error checking MongoDB data:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the check function
checkMongoDBData().catch(console.error);