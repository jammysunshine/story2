require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const { generatePdf } = require('../pdfService');

async function testPdfScript() {
  const bookId = "69709cf3e829dfa9cc00609a";
  console.log(`\n--- 🕵️ EXPLICIT TRACE FOR BOOK: ${bookId} ---`);

  const client = new MongoClient(process.env.MONGODB_URI, { 
    serverSelectionTimeoutMS: 90000,
    connectTimeoutMS: 90000
  });
  
  try {
    await client.connect();
    const db = client.db('story-db');
    console.log('✅ STEP 1: DB Connected');

    const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
    if (!book) {
      console.error('❌ STEP 2: CRITICAL - Book ID NOT FOUND in story-db.');
      return;
    }
    console.log(`✅ STEP 2: Book "${book.title}" loaded from DB.`);

    console.log('STEP 3: Granular Image Audit (Storage Level)');
    const { Storage } = require('@google-cloud/storage');
    const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
    const bucket = storage.bucket(process.env.GCS_IMAGES_BUCKET_NAME);
    
    for (let i = 0; i < book.pages.length; i++) {
      const page = book.pages[i];
      // Check the EXACT paths the PDF engine looks for
      const pathsToTry = [
        `books/${bookId}/page_${page.pageNumber}.png`,
        `books/${bookId}/hero_reference.png`,
        `books/${bookId}/animal_reference.png`
      ];
      
      let found = false;
      for (const path of pathsToTry) {
        const [exists] = await bucket.file(path).exists();
        if (exists) {
          console.log(`  [P${page.pageNumber}] ✅ FOUND: gs://${process.env.GCS_IMAGES_BUCKET_NAME}/${path}`);
          found = true;
          break;
        }
      }
      if (!found) console.log(`  [P${page.pageNumber}] ❌ MISSING ALL EXPECTED PATHS`);
    }

    console.log('\nSTEP 4: Triggering PDF Engine');
    const pdfUrl = await generatePdf(db, bookId);
    console.log('\n✅ STEP 5: FINAL PDF URL: ' + pdfUrl);

  } catch (error) {
    console.error('\n💥 ERROR:', error.message);
  } finally {
    await client.close();
  }
}

testPdfScript().catch(console.error);