require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const { Storage } = require('@google-cloud/storage');
const logger = require('../logger');

const log = logger;

async function migrateGCSData() {
  log.info('🔄 Starting GCS data migration...');

  // Validate environment variables
  const OLD_PROJECT_ID = process.env.OLD_GCP_PROJECT_ID;
  const NEW_PROJECT_ID = process.env.NEW_GCP_PROJECT_ID;
  const OLD_IMAGES_BUCKET = process.env.OLD_GCS_IMAGES_BUCKET_NAME;
  const NEW_IMAGES_BUCKET = process.env.NEW_GCS_IMAGES_BUCKET_NAME;
  const OLD_PDFS_BUCKET = process.env.OLD_GCS_PDFS_BUCKET_NAME;
  const NEW_PDFS_BUCKET = process.env.NEW_GCS_PDFS_BUCKET_NAME;

  if (!OLD_PROJECT_ID || !NEW_PROJECT_ID || !OLD_IMAGES_BUCKET || !NEW_IMAGES_BUCKET || !OLD_PDFS_BUCKET || !NEW_PDFS_BUCKET) {
    console.error('❌ Error: Missing required environment variables for migration');
    console.log('📋 Required variables:');
    console.log('  OLD_GCP_PROJECT_ID, NEW_GCP_PROJECT_ID');
    console.log('  OLD_GCS_IMAGES_BUCKET_NAME, NEW_GCS_IMAGES_BUCKET_NAME');
    console.log('  OLD_GCS_PDFS_BUCKET_NAME, NEW_GCS_PDFS_BUCKET_NAME');
    return;
  }

  log.info('Starting GCS Migration...');
  log.info(`From: ${OLD_PROJECT_ID} (${OLD_IMAGES_BUCKET}, ${OLD_PDFS_BUCKET})`);
  log.info(`To: ${NEW_PROJECT_ID} (${NEW_IMAGES_BUCKET}, ${NEW_PDFS_BUCKET})`);

  // Initialize GCS clients
  const oldStorage = new Storage({
    projectId: OLD_PROJECT_ID,
    keyFilename: process.env.OLD_GOOGLE_APPLICATION_CREDENTIALS
  });

  const newStorage = new Storage({
    projectId: NEW_PROJECT_ID,
    keyFilename: process.env.NEW_GOOGLE_APPLICATION_CREDENTIALS
  });

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // 1. Copy Images
    log.info('🖼️  Starting image migration...');
    await copyBucket(oldStorage.bucket(OLD_IMAGES_BUCKET), newStorage.bucket(NEW_IMAGES_BUCKET));
    
    // 2. Copy PDFs
    log.info('📄 Starting PDF migration...');
    await copyBucket(oldStorage.bucket(OLD_PDFS_BUCKET), newStorage.bucket(NEW_PDFS_BUCKET));

    // 3. Update MongoDB records
    log.info('🗄️  Updating MongoDB records...');
    
    // Update books collection (pages.imageUrl and pdfUrl)
    const booksToUpdate = await db.collection('books').find({
      $or: [
        { 'pages.imageUrl': { $regex: OLD_IMAGES_BUCKET } },
        { 'pdfUrl': { $regex: OLD_PDFS_BUCKET } }
      ]
    }).toArray();

    log.info(`Found ${booksToUpdate.length} books with URLs to update`);

    for (const book of booksToUpdate) {
      let updated = false;
      let updatedBook = { ...book };

      // Update page image URLs
      if (updatedBook.pages) {
        updatedBook.pages = updatedBook.pages.map(page => {
          let updatedPage = { ...page };
          if (page.imageUrl && page.imageUrl.includes(OLD_IMAGES_BUCKET)) {
            updatedPage.imageUrl = page.imageUrl.replace(OLD_IMAGES_BUCKET, NEW_IMAGES_BUCKET);
            updated = true;
          }
          if (page.url && page.url.includes(OLD_IMAGES_BUCKET)) {
            updatedPage.url = page.url.replace(OLD_IMAGES_BUCKET, NEW_IMAGES_BUCKET);
            updated = true;
          }
          return updatedPage;
        });
      }

      // Update PDF URL
      let newPdfUrl = book.pdfUrl;
      if (book.pdfUrl && book.pdfUrl.includes(OLD_PDFS_BUCKET)) {
        newPdfUrl = book.pdfUrl.replace(OLD_PDFS_BUCKET, NEW_PDFS_BUCKET);
        updated = true;
      }

      if (updated) {
        await db.collection('books').updateOne(
          { _id: new ObjectId(book._id) },
          {
            $set: {
              pages: updatedBook.pages,
              pdfUrl: newPdfUrl,
              updatedAt: new Date()
            }
          }
        );
        log.info(`Updated book: ${book.title || book._id.toString()}`);
      }
    }

    log.info('Migration complete!');
    log.info('📋 Summary:');
    log.info(`  - Images copied from ${OLD_IMAGES_BUCKET} to ${NEW_IMAGES_BUCKET}`);
    log.info(`  - PDFs copied from ${OLD_PDFS_BUCKET} to ${NEW_PDFS_BUCKET}`);
    log.info(`  - ${booksToUpdate.length} books updated in database`);

  } catch (error) {
    log.error(`Migration failed: ${error.message}`);
    log.error(error.stack);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Helper function to copy all files from one bucket to another
async function copyBucket(sourceBucket, destBucket) {
  log.info(`Copying files from ${sourceBucket.name} to ${destBucket.name}...`);

  const [files] = await sourceBucket.getFiles();
  log.info(`Found ${files.length} files to copy`);

  let copiedCount = 0;
  for (const file of files) {
    try {
      // Copy file to destination bucket
      await file.copy(destBucket);
      copiedCount++;
      
      if (copiedCount % 10 === 0) {
        log.info(`Copied ${copiedCount}/${files.length} files...`);
      }
    } catch (copyError) {
      log.error(`Failed to copy ${file.name}: ${copyError.message}`);
    }
  }

  log.info(`Successfully copied ${copiedCount} files`);
}

// Run the migration function
migrateGCSData().catch(console.error);