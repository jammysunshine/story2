require('dotenv').config();
const { MongoClient } = require('mongodb');
const logger = require('../logger');

const log = logger;

async function cleanupBinaryData() {
  console.log('🗑️ Starting binary data cleanup operations...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    console.log('\n🔍 ANALYZING BINARY DATA IN DATABASE:\n');

    // 1. Check for any binary data stored directly in MongoDB
    console.log('📋 Checking for binary data in collections...');

    const collections = await db.collections();
    for (const collection of collections) {
      const collectionName = collection.collectionName;
      
      // Skip system collections
      if (collectionName.startsWith('system.')) continue;
      
      console.log(`\n📖 Analyzing collection: ${collectionName}`);
      
      // Sample documents to check for binary data
      const sampleDocs = await collection.find({}).limit(5).toArray();
      
      let binaryFieldsFound = 0;
      let binarySizeTotal = 0;
      
      for (const doc of sampleDocs) {
        const fields = findBinaryFields(doc);
        if (fields.length > 0) {
          binaryFieldsFound += fields.length;
          for (const field of fields) {
            const size = estimateBinarySize(doc, field.path);
            binarySizeTotal += size;
          }
        }
      }
      
      if (binaryFieldsFound > 0) {
        console.log(`   ⚠️  Found ${binaryFieldsFound} potential binary fields in samples`);
        console.log(`   📏 Estimated binary data size in samples: ${formatBytes(binarySizeTotal)}`);
      } else {
        console.log(`   ✅ No obvious binary data found in samples`);
      }
    }

    // 2. Check for embedded base64 images in books
    console.log('\n🖼️  Checking for base64 encoded images in books...');
    
    const booksWithBase64 = await db.collection('books').countDocuments({
      $or: [
        { "pages.imageUrl": { $regex: /^data:image/ } },
        { "pages.imageUrl": { $regex: /base64/ } },
        { "pages.url": { $regex: /^data:image/ } },
        { "photoUrl": { $regex: /^data:image/ } }
      ]
    });

    console.log(`📋 Books with potential base64 images: ${booksWithBase64}`);

    if (booksWithBase64 > 0) {
      console.log('⚠️  Base64 encoded images found in database. These should be migrated to GCS.');
      console.log('💡 Consider running a migration script to upload these to GCS and update references.');
    }

    // 3. Check for large text fields that might contain binary representations
    console.log('\n📝 Checking for oversized text fields...');
    
    // Check for any field that might be storing binary data as strings
    const largeTextFields = await db.collection('books').countDocuments({
      $or: [
        { "pages.imageUrl": { $regex: /.{1000,}/ } }, // Very long image URLs might be base64
        { "pages.prompt": { $regex: /.{5000,}/ } },   // Very long prompts might contain binary data
        { "heroBible": { $regex: /.{5000,}/ } },      // Very long bibles might contain binary data
        { "animalBible": { $regex: /.{5000,}/ } }    // Very long bibles might contain binary data
      ]
    });

    console.log(`📋 Books with oversized text fields: ${largeTextFields}`);

    // 4. Check for any binary data in users collection
    console.log('\n👥 Checking users collection for binary data...');
    
    const usersWithBinary = await db.collection('users').countDocuments({
      $or: [
        { avatar: { $regex: /^data:image/ } },
        { profilePicture: { $regex: /^data:image/ } },
        { photo: { $regex: /^data:image/ } }
      ]
    });

    console.log(`📋 Users with potential binary data: ${usersWithBinary}`);

    // 5. Check for any binary data in orders collection
    console.log('\n📦 Checking orders collection for binary data...');
    
    const ordersWithBinary = await db.collection('orders').countDocuments({
      $or: [
        { receipt: { $regex: /^data:image/ } },
        { invoice: { $regex: /^data:image/ } },
        { proofOfPayment: { $regex: /^data:image/ } }
      ]
    });

    console.log(`📋 Orders with potential binary data: ${ordersWithBinary}`);

    // 6. Calculate approximate storage usage
    console.log('\n💾 ESTIMATING STORAGE USAGE:');
    
    const dbStats = await db.stats();
    console.log(`   Total database size: ${formatBytes(dbStats.dataSize)}`);
    console.log(`   Total storage size: ${formatBytes(dbStats.storageSize)}`);
    console.log(`   Average object size: ${formatBytes(dbStats.avgObjSize)}`);

    // 7. Recommendations
    console.log('\n📋 RECOMMENDATIONS:');
    console.log('   1. Store binary data in GCS rather than MongoDB');
    console.log('   2. Use references (URLs) to GCS objects in MongoDB');
    console.log('   3. Implement proper cleanup of unused GCS objects');
    console.log('   4. Monitor database size growth regularly');
    console.log('   5. Consider using GridFS for large binary objects if needed');

    // 8. Cleanup options
    console.log('\n🔧 AVAILABLE CLEANUP OPTIONS:');
    console.log('   - Migrate base64 images to GCS (not performed by this script)');
    console.log('   - Remove temporary binary data fields (if any exist)');
    console.log('   - Clean up unused references to external resources');

    console.log('\n✅ Binary data cleanup analysis completed!');

  } catch (error) {
    log.error('💥 Error during binary data cleanup:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Helper function to find potential binary fields in a document
function findBinaryFields(obj, prefix = '', results = []) {
  if (obj === null || typeof obj !== 'object') return results;
  
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'string') {
      // Check if this looks like base64 encoded binary data
      if (value.startsWith('data:image/') || 
          value.startsWith('data:application/') || 
          (value.length > 1000 && isBase64Like(value))) {
        results.push({ path, type: 'potential-binary', length: value.length });
      }
    } else if (typeof value === 'object' && value !== null) {
      // Recursively check nested objects
      findBinaryFields(value, path, results);
    } else if (Array.isArray(value)) {
      // Check arrays
      for (let i = 0; i < value.length; i++) {
        findBinaryFields(value[i], `${path}[${i}]`, results);
      }
    }
  }
  
  return results;
}

// Helper function to estimate binary size
function estimateBinarySize(obj, path) {
  // Navigate to the field using the path
  const pathParts = path.split('.');
  let current = obj;
  
  for (const part of pathParts) {
    if (part.endsWith(']')) {
      // Handle array notation like "pages[0]"
      const [arrayName, indexStr] = part.split('[');
      const index = parseInt(indexStr.replace(']', ''));
      current = current[arrayName][index];
    } else {
      current = current[part];
    }
  }
  
  // If it's a string that looks like base64, estimate the decoded size
  if (typeof current === 'string' && isBase64Like(current)) {
    // Base64 encoded data is roughly 4/3 the size of original binary data
    return Math.floor((current.length * 3) / 4);
  }
  
  return 0;
}

// Helper function to check if a string looks like base64
function isBase64Like(str) {
  // Basic check: contains only valid base64 characters and proper padding
  if (typeof str !== 'string') return false;
  
  // Check if it's a data URL
  if (str.startsWith('data:')) return true;
  
  // Check if it's a long string of base64-like characters
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return str.length > 100 && base64Regex.test(str.replace(/\s/g, ''));
}

// Helper function to format bytes in human-readable form
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the cleanup function
cleanupBinaryData().catch(console.error);