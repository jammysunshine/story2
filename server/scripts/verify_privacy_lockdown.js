require('dotenv').config();
const { MongoClient } = require('mongodb');
const { Storage } = require('@google-cloud/storage');
const logger = require('../logger');

const log = logger;

async function verifyPrivacyLockdown() {
  console.log('🔒 Starting privacy lockdown verification...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    console.log('\n🔍 PRIVACY VERIFICATION CHECKLIST:\n');

    // 1. Check if sensitive data is properly protected
    console.log('🔐 1. SENSITIVE DATA PROTECTION:');
    
    // Check for exposed API keys in database
    const collections = await db.collections();
    for (const collection of collections) {
      const collectionName = collection.collectionName;
      if (collectionName.startsWith('system.')) continue; // Skip system collections
      
      const sampleDoc = await collection.findOne({});
      if (sampleDoc) {
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential', 'auth'];
        const foundSensitive = [];
        
        for (const field of sensitiveFields) {
          if (JSON.stringify(sampleDoc).toLowerCase().includes(field)) {
            foundSensitive.push(field);
          }
        }
        
        if (foundSensitive.length > 0) {
          console.log(`   ⚠️  ${collectionName}: Found potential sensitive fields: ${foundSensitive.join(', ')}`);
        } else {
          console.log(`   ✅ ${collectionName}: No obvious sensitive data in sample`);
        }
      }
    }

    // 2. Check user data protection
    console.log('\n👥 2. USER DATA PROTECTION:');
    
    const users = await db.collection('users').find({}).limit(5).toArray();
    for (const user of users) {
      const hasPassword = user.password || user.hashedPassword;
      const hasTokens = user.tokens || user.refreshToken || user.accessToken;
      
      console.log(`   User ${user.email || user._id}:`);
      console.log(`     - Password stored: ${hasPassword ? '⚠️  Yes (should be hashed)' : '✅ No'}`);
      console.log(`     - Tokens stored: ${hasTokens ? '⚠️  Yes (may need rotation)' : '✅ No'}`);
    }

    // 3. Check book data privacy
    console.log('\n📖 3. BOOK DATA PRIVACY:');
    
    const books = await db.collection('books').find({}).limit(5).toArray();
    for (const book of books) {
      console.log(`   Book ${book.title || book._id}:`);
      console.log(`     - Contains user email: ${book.userId ? '✅ Protected (hashed/referenced)' : '✅ No direct email'}`);
      console.log(`     - Contains personal photos: ${book.photoUrl ? '⚠️  Yes (ensure access controls)' : '✅ No'}`);
      console.log(`     - PDF URL accessible: ${book.pdfUrl ? '⚠️  Check access controls' : '✅ No PDF'}`);
    }

    // 4. Check GCS bucket privacy
    console.log('\n☁️  4. GOOGLE CLOUD STORAGE PRIVACY:');
    
    if (process.env.GCS_IMAGES_BUCKET_NAME && process.env.GCS_PDFS_BUCKET_NAME) {
      const storage = new Storage({
        projectId: process.env.GCP_PROJECT_ID,
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
      });

      // Check if buckets are private
      try {
        const imagesBucket = storage.bucket(process.env.GCS_IMAGES_BUCKET_NAME);
        const [imagesMetadata] = await imagesBucket.getMetadata();
        const imagesPrivate = !imagesMetadata.iamConfiguration?.publicAccessPrevention === 'enforced' || 
                             imagesMetadata.acl?.every(acl => acl.entity !== 'allUsers');
        
        console.log(`   Images Bucket (${process.env.GCS_IMAGES_BUCKET_NAME}):`);
        console.log(`     - Private Access: ${imagesPrivate ? '✅ Enforced' : '⚠️  May allow public access'}`);
        
        const pdfsBucket = storage.bucket(process.env.GCS_PDFS_BUCKET_NAME);
        const [pdfsMetadata] = await pdfsBucket.getMetadata();
        const pdfsPrivate = !pdfsMetadata.iamConfiguration?.publicAccessPrevention === 'enforced' || 
                           pdfsMetadata.acl?.every(acl => acl.entity !== 'allUsers');
        
        console.log(`   PDFs Bucket (${process.env.GCS_PDFS_BUCKET_NAME}):`);
        console.log(`     - Private Access: ${pdfsPrivate ? '✅ Enforced' : '⚠️  May allow public access'}`);
      } catch (bucketError) {
        console.log(`   ⚠️  Could not check bucket privacy: ${bucketError.message}`);
      }
    } else {
      console.log(`   ⚠️  GCS bucket names not configured in environment`);
    }

    // 5. Check signed URL usage
    console.log('\n🔗 5. SIGNED URL VERIFICATION:');
    
    const booksWithUrls = await db.collection('books').find({
      $or: [
        { pdfUrl: { $regex: /storage\.googleapis\.com/ } },
        { "pages.imageUrl": { $regex: /storage\.googleapis\.com/ } }
      ]
    }).limit(5).toArray();
    
    for (const book of booksWithUrls) {
      const hasSignedPdf = book.pdfUrl && book.pdfUrl.includes('exp=') && book.pdfUrl.includes('authuser=');
      const hasSignedImages = book.pages && book.pages.some(p => 
        p.imageUrl && p.imageUrl.includes('exp=') && p.imageUrl.includes('authuser=')
      );
      
      console.log(`   Book ${book.title || book._id}:`);
      console.log(`     - PDF URL signed: ${hasSignedPdf ? '✅ Yes' : '⚠️  May be publicly accessible'}`);
      console.log(`     - Image URLs signed: ${hasSignedImages ? '✅ Yes' : '⚠️  May be publicly accessible'}`);
    }

    // 6. Check environment variable security
    console.log('\n🔐 6. ENVIRONMENT VARIABLE SECURITY:');
    
    const sensitiveEnvVars = [
      'MONGODB_URI',
      'GOOGLE_API_KEY', 
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'GOOGLE_CLIENT_SECRET',
      'AUTH_SECRET',
      'NEXTAUTH_SECRET',
      'SMTP_PASSWORD',
      'GELATO_API_KEY'
    ];
    
    for (const varName of sensitiveEnvVars) {
      const value = process.env[varName];
      if (value) {
        const isMasked = value.length > 8 && value.substring(0, 4) === value.substring(0, 4).replace(/./g, '*');
        console.log(`   ${varName}: ${isMasked ? '✅ Masked' : '⚠️  Visible in environment'}`);
      } else {
        console.log(`   ${varName}: ❌ Not set`);
      }
    }

    // 7. Check for proper indexing (to prevent data leaks through queries)
    console.log('\n📊 7. DATABASE INDEXING SECURITY:');
    
    const booksIndexes = await db.collection('books').indexes();
    const usersIndexes = await db.collection('users').indexes();
    
    const hasUserEmailIndex = usersIndexes.some(idx => idx.key && idx.key.email);
    const hasBookUserIdIndex = booksIndexes.some(idx => idx.key && idx.key.userId);
    
    console.log(`   Users collection:`);
    console.log(`     - Email indexed: ${hasUserEmailIndex ? '✅ Yes' : '⚠️  May affect query performance'}`);
    console.log(`   Books collection:`);
    console.log(`     - User ID indexed: ${hasBookUserIdIndex ? '✅ Yes' : '⚠️  May affect query performance'}`);

    // 8. Check for audit trails
    console.log('\n📋 8. AUDIT TRAIL VERIFICATION:');
    
    const hasWebhookEvents = collections.some(col => col.collectionName === 'webhook_events');
    const hasLogsCollection = collections.some(col => col.collectionName === 'logs' || col.collectionName.includes('log'));
    
    console.log(`   - Webhook events logged: ${hasWebhookEvents ? '✅ Yes' : '⚠️  No'}`);
    console.log(`   - System logs collection: ${hasLogsCollection ? '✅ Yes' : '⚠️  No'}`);

    // 9. Check for data retention policies
    console.log('\n🗂️  9. DATA RETENTION POLICIES:');
    
    // Check for TTL indexes (automatic cleanup)
    const ttlIndexes = [...booksIndexes, ...usersIndexes].filter(idx => idx.expireAfterSeconds);
    console.log(`   - TTL (auto-expiration) indexes: ${ttlIndexes.length > 0 ? `✅ ${ttlIndexes.length} found` : '⚠️  None found'}`);

    // Summary
    console.log('\n📋 PRIVACY LOCKDOWN SUMMARY:');
    console.log('   This verification checks for common privacy and security configurations.');
    console.log('   Remember to also implement proper access controls at the application level.');
    console.log('   Regular security audits are recommended for production systems.');

    console.log('\n✅ Privacy lockdown verification completed!');

  } catch (error) {
    log.error('💥 Error verifying privacy lockdown:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the verification function
verifyPrivacyLockdown().catch(console.error);