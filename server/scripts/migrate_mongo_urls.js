require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const logger = require('../logger');

const log = logger;

async function migrateMongoUrls() {
  log.info('🔄 Starting MongoDB URL migration...');

  // Define old and new bucket names
  const OLD_IMAGES_BUCKET = process.env.OLD_GCS_IMAGES_BUCKET_NAME || 'storytime-images-jammy';
  const NEW_IMAGES_BUCKET = process.env.NEW_GCS_IMAGES_BUCKET_NAME || 'storytime-images-1768';
  const OLD_PDFS_BUCKET = process.env.OLD_GCS_PDFS_BUCKET_NAME || 'storytime-pdfs-jammy';
  const NEW_PDFS_BUCKET = process.env.NEW_GCS_PDFS_BUCKET_NAME || 'storytime-pdfs-1768';

  log.info(`Replacing ${OLD_IMAGES_BUCKET} -> ${NEW_IMAGES_BUCKET}`);
  log.info(`Replacing ${OLD_PDFS_BUCKET} -> ${NEW_PDFS_BUCKET}`);

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // 1. Update Books collection (pages.imageUrl and pdfUrl)
    log.info('📖 Updating Books collection...');
    
    // Find books with old URLs
    const books = await db.collection('books').find({
      $or: [
        { 'pages.imageUrl': { $regex: OLD_IMAGES_BUCKET } },
        { 'pdfUrl': { $regex: OLD_PDFS_BUCKET } }
      ]
    }).toArray();

    log.info(`Found ${books.length} books with URLs to update`);

    for (const book of books) {
      let updatedPages = [...book.pages];
      let updatedPdfUrl = book.pdfUrl;
      let hasChanges = false;

      // Update page image URLs
      if (book.pages) {
        updatedPages = book.pages.map(page => {
          let updatedPage = { ...page };
          
          if (page.imageUrl && page.imageUrl.includes(OLD_IMAGES_BUCKET)) {
            updatedPage.imageUrl = page.imageUrl.replace(OLD_IMAGES_BUCKET, NEW_IMAGES_BUCKET);
            hasChanges = true;
          }
          
          if (page.url && page.url.includes(OLD_IMAGES_BUCKET)) {
            updatedPage.url = page.url.replace(OLD_IMAGES_BUCKET, NEW_IMAGES_BUCKET);
            hasChanges = true;
          }
          
          return updatedPage;
        });
      }

      // Update PDF URL
      if (book.pdfUrl && book.pdfUrl.includes(OLD_PDFS_BUCKET)) {
        updatedPdfUrl = book.pdfUrl.replace(OLD_PDFS_BUCKET, NEW_PDFS_BUCKET);
        hasChanges = true;
      }

      if (hasChanges) {
        await db.collection('books').updateOne(
          { _id: new ObjectId(book._id) },
          {
            $set: {
              pages: updatedPages,
              pdfUrl: updatedPdfUrl,
              updatedAt: new Date()
            }
          }
        );
        log.info(`Updated book: ${book.title || book._id.toString()}`);
      }
    }

    // 2. Update any other collections that might have URLs
    log.info('🔍 Checking other collections for URLs...');
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      
      // Skip system collections and the ones we already handled
      if (collectionName.startsWith('system.') || collectionName === 'books') {
        continue;
      }
      
      // Check if this collection has any documents with URLs
      const sampleDoc = await db.collection(collectionName).findOne({});
      if (!sampleDoc) continue;
      
      // Look for URL fields in the sample document
      const urlFields = findUrlFields(sampleDoc, OLD_IMAGES_BUCKET, OLD_PDFS_BUCKET);
      
      if (urlFields.length > 0) {
        log.info(`Found URL fields in ${collectionName}: ${urlFields.join(', ')}`);
        
        // Update all documents in this collection that have old URLs
        const docsToUpdate = await db.collection(collectionName).find({
          $or: urlFields.map(field => ({
            [field]: { $regex: `(?:${OLD_IMAGES_BUCKET}|${OLD_PDFS_BUCKET})` }
          }))
        }).toArray();
        
        log.info(`Updating ${docsToUpdate.length} documents in ${collectionName}...`);
        
        for (const doc of docsToUpdate) {
          let updatedDoc = { ...doc };
          let docHasChanges = false;
          
          // Update all URL fields in this document
          for (const field of urlFields) {
            if (typeof doc[field] === 'string') {
              const oldValue = doc[field];
              const newValue = oldValue
                .replace(OLD_IMAGES_BUCKET, NEW_IMAGES_BUCKET)
                .replace(OLD_PDFS_BUCKET, NEW_PDFS_BUCKET);
                
              if (oldValue !== newValue) {
                updatedDoc[field] = newValue;
                docHasChanges = true;
              }
            } else if (Array.isArray(doc[field])) {
              // Handle array of URLs
              const oldArray = doc[field];
              const newArray = oldArray.map(item => {
                if (typeof item === 'string') {
                  return item
                    .replace(OLD_IMAGES_BUCKET, NEW_IMAGES_BUCKET)
                    .replace(OLD_PDFS_BUCKET, NEW_PDFS_BUCKET);
                } else if (typeof item === 'object' && item !== null) {
                  // Handle array of objects with URL fields
                  return updateNestedUrls(item, OLD_IMAGES_BUCKET, NEW_IMAGES_BUCKET, OLD_PDFS_BUCKET, NEW_PDFS_BUCKET);
                }
                return item;
              });
              
              if (JSON.stringify(oldArray) !== JSON.stringify(newArray)) {
                updatedDoc[field] = newArray;
                docHasChanges = true;
              }
            } else if (typeof doc[field] === 'object' && doc[field] !== null) {
              // Handle nested objects with URL fields
              const oldObj = doc[field];
              const newObj = updateNestedUrls(oldObj, OLD_IMAGES_BUCKET, NEW_IMAGES_BUCKET, OLD_PDFS_BUCKET, NEW_PDFS_BUCKET);
              
              if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
                updatedDoc[field] = newObj;
                docHasChanges = true;
              }
            }
          }
          
          if (docHasChanges) {
            await db.collection(collectionName).updateOne(
              { _id: doc._id },
              { $set: updatedDoc }
            );
          }
        }
      }
    }

    log.info('MongoDB URL Migration complete!');
    log.info('📋 Summary:');
    log.info(`  - ${books.length} books updated`);
    log.info(`  - Replaced ${OLD_IMAGES_BUCKET} with ${NEW_IMAGES_BUCKET}`);
    log.info(`  - Replaced ${OLD_PDFS_BUCKET} with ${NEW_PDFS_BUCKET}`);

  } catch (error) {
    log.error(`Migration failed: ${error.message}`);
    log.error(error.stack);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Helper function to find URL fields in an object
function findUrlFields(obj, oldImageBucket, oldPdfBucket, visited = new Set()) {
  if (obj === null || typeof obj !== 'object') return [];
  if (visited.has(obj)) return []; // Prevent circular references
  visited.add(obj);
  
  const fields = [];
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && (value.includes(oldImageBucket) || value.includes(oldPdfBucket))) {
      fields.push(key);
    } else if (typeof value === 'object' && value !== null) {
      // Check nested objects
      const nestedFields = findUrlFields(value, oldImageBucket, oldPdfBucket, visited);
      if (nestedFields.length > 0) {
        fields.push(key);
      }
    } else if (Array.isArray(value)) {
      // Check arrays for objects with URLs
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          const nestedFields = findUrlFields(item, oldImageBucket, oldPdfBucket, visited);
          if (nestedFields.length > 0) {
            fields.push(key);
            break; // Just add the array field name once
          }
        }
      }
    }
  }
  
  return [...new Set(fields)]; // Remove duplicates
}

// Helper function to update nested URLs in an object
function updateNestedUrls(obj, oldImageBucket, newImageBucket, oldPdfBucket, newPdfBucket) {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => updateNestedUrls(item, oldImageBucket, newImageBucket, oldPdfBucket, newPdfBucket));
  }
  
  const updatedObj = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      updatedObj[key] = value
        .replace(oldImageBucket, newImageBucket)
        .replace(oldPdfBucket, newPdfBucket);
    } else if (typeof value === 'object' && value !== null) {
      updatedObj[key] = updateNestedUrls(value, oldImageBucket, newImageBucket, oldPdfBucket, newPdfBucket);
    } else {
      updatedObj[key] = value;
    }
  }
  
  return updatedObj;
}

// Run the migration function
migrateMongoUrls().catch(console.error);