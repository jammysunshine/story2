const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const path = require('path');

// Load .env file
const envPath = path.resolve(process.cwd(), '.env');
const result = require('dotenv').config({ path: envPath });

if (result.error) {
  console.error('❌ Error loading .env file:', result.error);
} else {
  console.log('✅ .env file loaded from:', envPath);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('❌ MONGODB_URI missing from .env');
  console.log('Environment variables found:', Object.keys(process.env).filter(k => !k.startsWith('npm_')));
  process.exit(1);
} else {
  const maskedUri = uri.replace(/\/\/.*@/, '//<user>:<password>@');
  console.log('🔗 Using MONGODB_URI:', maskedUri);
}

async function syncImages() {
  console.log('🔌 Attempting to connect to MongoDB...');

  // Increase timeouts for MongoDB Atlas
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 60000,      // 60 seconds
    connectTimeoutMS: 60000,              // 60 seconds
    socketTimeoutMS: 480000,              // 8 minutes
    maxIdleTimeMS: 480000,                // 8 minutes
    maxPoolSize: 10,                      // Increase pool size
    retryWrites: true,
    retryReads: true
  });

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB successfully');

    // Explicitly target story-db
    const db = client.db('story-db');

    console.log('🧪 Diagnostic: Listing collections...');
    const collections = await db.listCollections().toArray();
    console.log('📋 Collections found:', collections.map(c => c.name).join(', '));

    console.log('📡 Counting total books...');
    const totalBooks = await db.collection('books').estimatedDocumentCount();
    console.log(`📚 Total books to process: ${totalBooks}`);

    // Use a cursor to process books one by one to avoid memory issues
    console.log('📖 Starting to process books using cursor...');
    const bookCursor = db.collection('books').find({}).batchSize(1);
    
    let totalSynced = 0;
    let totalUpdated = 0;
    let processedBooks = 0;

    while (await bookCursor.hasNext()) {
      const book = await bookCursor.next();
      processedBooks++;
      
      console.log(`\n📖 PROCESSING BOOK ${processedBooks}/${totalBooks}:`);
      console.log(`   ID: ${book._id}`);
      console.log(`   Title: ${book.title || 'No title'}`);
      console.log(`   User: ${book.userId || 'No user'}`);
      
      if (!book.pages || !Array.isArray(book.pages)) {
        console.log(`   ⚠️  Book ${book._id} has no pages or pages is not an array`);
        continue;
      }
      
      console.log(`   Pages: ${book.pages.length}`);
      
      let pagesProcessed = 0;
      for (const page of book.pages) {
        pagesProcessed++;
        if (!page.pageNumber) {
          console.log(`   📄 Page ${pagesProcessed}: No page number, skipping`);
          continue;
        }

        console.log(`   📄 Processing page ${page.pageNumber}...`);
        
        const isPlaceholder = !page.imageUrl ||
                             page.imageUrl.includes('placeholder') ||
                             page.imageUrl.includes('Painting+Page');

        let gcsUrl = page.imageUrl || '';
        if (page.imageUrl && page.imageUrl.includes('storage.googleapis.com')) {
          gcsUrl = page.imageUrl.split('?')[0];
        }

        console.log(`     Image URL: ${page.imageUrl ? page.imageUrl.substring(0, 60) + '...' : 'No image'}`);
        console.log(`     GCS URL: ${gcsUrl ? gcsUrl.substring(0, 60) + '...' : 'No GCS URL'}`);
        console.log(`     Is Placeholder: ${isPlaceholder}`);

        const imageRecord = {
          bookId: book._id,
          pageNumber: page.pageNumber,
          gcsUrl: gcsUrl,
          updatedAt: new Date(),
          model: isPlaceholder ? 'placeholder' : 'recovered_migration'
        };

        console.log(`     🔄 Upserting image record for book ${book._id}, page ${page.pageNumber}...`);
        
        const result = await db.collection('images').updateOne(
          { bookId: book._id, pageNumber: page.pageNumber },
          {
            $set: imageRecord,
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );

        if (result.upsertedCount && result.upsertedCount > 0) {
          totalSynced++;
          console.log(`     ✨ NEW RECORD CREATED for page ${page.pageNumber}`);
        } else if (result.modifiedCount && result.modifiedCount > 0) {
          totalUpdated++;
          console.log(`     🔄 RECORD UPDATED for page ${page.pageNumber}`);
        } else {
          console.log(`     ↔️  RECORD EXISTS (no change) for page ${page.pageNumber}`);
        }
      }
      
      console.log(`   ✅ Book ${book._id} completed: ${pagesProcessed} pages processed`);
      console.log(`   📊 Progress: ${processedBooks}/${totalBooks} books processed`);
    }

    console.log(`
🎉 Sync Complete!`);
    console.log(`📊 SUMMARY:`);
    console.log(`   Total Books Processed: ${processedBooks}`);
    console.log(`   ✨ New Image Records: ${totalSynced}`);
    console.log(`   🔄 Updated Image Records: ${totalUpdated}`);
    console.log(`   📚 Total Pages Processed: ${processedBooks} books with all their pages`);

  } catch (error) {
    console.error('💥 Sync failed:', error);
    console.error('Error details:', error.stack);
  } finally {
    console.log('🔌 Closing connection...');
    await client.close();
  }
}

console.log('🎬 Starting sync process...');
syncImages().catch(console.error);