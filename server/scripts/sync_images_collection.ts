import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
const envPath = path.resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });

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

  const client = new MongoClient(uri!, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  });

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB successfully');

    // Explicitly target story-db
    const db = client.db('story-db');

    console.log('🧪 Diagnostic: Listing collections...');
    const collections = await db.listCollections().toArray();
    console.log('📋 Collections found:', collections.map(c => c.name).join(', '));

    console.log('📡 Fetching first 10 books from "story-db" for verification...');
    const books = await db.collection('books').find({}).limit(10).toArray();
    console.log(`📚 Successfully fetched ${books.length} books.`);

    // If that works, fetch them all
    console.log('📡 Fetching all books...');
    const allBooks = await db.collection('books').find({}).toArray();
    console.log(`📚 Total books to process: ${allBooks.length}`);

    let totalSynced = 0;
    let totalUpdated = 0;
    let processedBooks = 0;

    for (const book of allBooks) {
      processedBooks++;
      if (processedBooks % 10 === 0 || processedBooks === allBooks.length) {
        console.log(`⏳ Progress: ${processedBooks}/${allBooks.length} books checked...`);
      }

      if (!book.pages || !Array.isArray(book.pages)) {
        console.log(`⚠️  Book ${book._id} has no pages or pages is not an array`);
        continue;
      }

      for (const page of book.pages) {
        if (!page.pageNumber) continue;

        const isPlaceholder = !page.imageUrl ||
                             page.imageUrl.includes('placeholder') ||
                             page.imageUrl.includes('Painting+Page');

        let gcsUrl = page.imageUrl || '';
        if (page.imageUrl && page.imageUrl.includes('storage.googleapis.com')) {
          gcsUrl = page.imageUrl.split('?')[0];
        }

        const imageRecord = {
          bookId: book._id,
          pageNumber: page.pageNumber,
          gcsUrl: gcsUrl,
          updatedAt: new Date(),
          model: isPlaceholder ? 'placeholder' : 'recovered_migration'
        };

        const result = await db.collection('images').updateOne(
          { bookId: book._id, pageNumber: page.pageNumber },
          {
            $set: imageRecord,
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );

        if (result.upsertedCount && result.upsertedCount > 0) totalSynced++;
        else if (result.modifiedCount && result.modifiedCount > 0) totalUpdated++;
      }
    }

    console.log(`
🎉 Sync Complete!`);
    console.log(`✨ New Image Records: ${totalSynced}`);
    console.log(`🔄 Updated Image Records: ${totalUpdated}`);

  } catch (error) {
    console.error('💥 Sync failed:', error);
  } finally {
    console.log('🔌 Closing connection...');
    await client.close();
  }
}

syncImages();