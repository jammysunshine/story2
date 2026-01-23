require('dotenv').config({ path: 'server/.env' });
const { MongoClient, ObjectId } = require('mongodb');
const { Storage } = require('@google-cloud/storage');
const { generatePdf } = require('../pdfService');

async function runDefinitiveAudit() {
  console.log('\n========================================================');
  console.log('🕵️  DEFINITIVE STORAGE & DATABASE AUDIT');
  console.log('========================================================\n');

  const client = new MongoClient(process.env.MONGODB_URI, { 
    serverSelectionTimeoutMS: 90000,
    connectTimeoutMS: 90000
  });

  try {
    await client.connect();
    const db = client.db('story-db');
    console.log('✅ STEP 1: Connected to MongoDB (story-db)');

    const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
    const bucket = storage.bucket(process.env.GCS_IMAGES_BUCKET_NAME);
    const userEmail = 'nidhi.cambridge@gmail.com';

    console.log(`✅ STEP 2: Fetching books for ${userEmail}...\n`);
    const books = await db.collection('books')
      .find({ userId: { $regex: new RegExp(userEmail, 'i') } })
      .sort({ createdAt: -1 })
      .toArray();

    console.log(`📊 Found ${books.length} books. Starting deep audit...\n`);

    for (const book of books) {
      const bookId = book._id.toString();
      console.log(`--------------------------------------------------------`);
      console.log(`📖 AUDITING: "${book.title}"`);
      console.log(`🆔 ID: ${bookId}`);
      console.log(`--------------------------------------------------------`);
      
      let missingCount = 0;
      let missingPages = [];

      // We audit based on the ACTUAL pages array in the book
      for (const page of book.pages) {
        const pNum = page.pageNumber;
        let fileName = `page_${pNum}.png`;
        if (pNum === 2) fileName = `hero_reference.png`;
        if (pNum === 3) fileName = `animal_reference.png`;

        const primaryPath = `books/${bookId}/${fileName}`;
        const backupPath = `images/${bookId}/${fileName}`;

        // 1. Check GCS Storage (Primary)
        const [existsPrimary] = await bucket.file(primaryPath).exists();
        // 2. Check GCS Storage (Backup)
        const [existsBackup] = await bucket.file(backupPath).exists();
        // 3. Check MongoDB 'images' collection
        const dbImage = await db.collection('images').findOne({ 
          bookId: new ObjectId(bookId), 
          pageNumber: pNum 
        });

        const isFound = existsPrimary || existsBackup;
        const statusIcon = isFound ? '✅' : '❌';
        const dbIcon = dbImage ? '✅' : '❌';

        console.log(`[Page ${String(pNum).padStart(2, ' ')}] Storage: ${statusIcon} | DB Meta: ${dbIcon} | Path: ${isFound ? (existsPrimary ? primaryPath : backupPath) : primaryPath}`);

        if (!isFound) {
          missingCount++;
          missingPages.push(pNum);
        }
      }

      console.log(`\n📈 Audit Result: ${book.pages.length - missingCount}/${book.pages.length} images found.`);

      if (missingCount === 0 && book.pages.length >= 27) {
        console.log(`\n🏆 PERFECT MATCH! Book is complete.`);
        console.log(`🚀 TRIGGERING PDF ENGINE...`);
        const pdfUrl = await generatePdf(db, bookId);
        console.log(`\n✅ PDF READY: ${pdfUrl}`);
        process.exit(0);
      } else {
        console.log(`⚠️  SKIPPING: Missing ${missingCount} images (${missingPages.join(', ')}).`);
      }
    }

    console.log('\n❌ AUDIT FINISHED: No 100% complete books found.');

  } catch (error) {
    console.error('\n💥 SCRIPT ERROR:', error.message);
  } finally {
    await client.close();
  }
}

runDefinitiveAudit().catch(console.error);
