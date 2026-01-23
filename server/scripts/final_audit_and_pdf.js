require('dotenv').config({ path: 'server/.env' });
const { MongoClient, ObjectId } = require('mongodb');
const { Storage } = require('@google-cloud/storage');
const { generatePdf } = require('../pdfService');

async function runFastAudit() {
  console.log('\n========================================================');
  console.log('🚀 LIVE PROGRESS AUDIT ENGINE');
  console.log('========================================================\n');

  const client = new MongoClient(process.env.MONGODB_URI, { 
    serverSelectionTimeoutMS: 90000,
    connectTimeoutMS: 90000
  });

  try {
    console.log('📡 STEP 1: Connecting to MongoDB...');
    await client.connect();
    const db = client.db('story-db');
    console.log('✅ Connected.');

    const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
    const bucket = storage.bucket(process.env.GCS_IMAGES_BUCKET_NAME);
    const userEmail = 'nidhi.cambridge@gmail.com';

    console.log(`📡 STEP 2: Fetching book list for ${userEmail}...`);
    // Use regex for case-insensitivity just in case
    const books = await db.collection('books')
      .find({ userId: { $regex: new RegExp(userEmail, 'i') } })
      .project({ _id: 1, title: 1, pages: 1 })
      .sort({ createdAt: -1 })
      .toArray();

    if (books.length === 0) {
      console.error('❌ No books found for this user.');
      return;
    }

    console.log(`✅ Found ${books.length} books. Starting granular audit...\n`);

    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      const bookId = book._id.toString();
      
      // LOG IMMEDIATELY
      process.stdout.write(`[${i + 1}/${books.length}] Auditing: "${book.title}"... `);
      
      const pathsToCheck = [];
      pathsToCheck.push({ pg: 2, path: `books/${bookId}/hero_reference.png` });
      pathsToCheck.push({ pg: 3, path: `books/${bookId}/animal_reference.png` });
      
      // We check up to 28 pages
      for (let p = 1; p <= 28; p++) {
        if (p !== 2 && p !== 3) {
          pathsToCheck.push({ pg: p, path: `books/${bookId}/page_${p}.png` });
        }
      }

      // Parallel GCS check for THIS book
      const results = await Promise.all(pathsToCheck.map(async (item) => {
        try {
          const [exists] = await bucket.file(item.path).exists();
          if (exists) return true;
          // Check alternate location
          const [existsAlt] = await bucket.file(item.path.replace('books/', 'images/')).exists();
          return existsAlt;
        } catch (e) {
          return false;
        }
      }));

      const foundCount = results.filter(Boolean).length;
      console.log(`${foundCount}/27 images.`);

      if (foundCount >= 27) {
        console.log(`\n🏆 FOUND COMPLETE BOOK!`);
        console.log(`📖 Title: ${book.title}`);
        console.log(`🆔 ID: ${bookId}`);
        console.log(`🚀 STARTING PDF ENGINE NOW...`);
        console.log('--------------------------------------------------------');
        
        const pdfUrl = await generatePdf(db, bookId);
        
        console.log('\n✅ SUCCESS!');
        console.log('🔗 URL: ' + pdfUrl);
        console.log('========================================================\n');
        process.exit(0);
      }
    }

    console.log('\n❌ AUDIT FINISHED: No 100% complete books found.');

  } catch (error) {
    console.error('\n💥 ERROR:', error.message);
  } finally {
    await client.close();
  }
}

runFastAudit().catch(console.error);