require('dotenv').config();
const { Storage } = require('@google-cloud/storage');
const logger = require('../logger');

const log = logger;

async function testPdfPermissions() {
  console.log('🔐 Testing GCS PDF permissions...');

  try {
    // Initialize GCS client
    const storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    // Test the PDF bucket permissions
    const pdfBucketName = process.env.GCS_PDFS_BUCKET_NAME;
    if (!pdfBucketName) {
      console.error('❌ Error: GCS_PDFS_BUCKET_NAME is not set in environment variables');
      return;
    }

    console.log(`📂 Testing PDF Bucket: ${pdfBucketName}`);
    const pdfBucket = storage.bucket(pdfBucketName);

    // Create a test file
    const testFileName = `test-permission-check-${Date.now()}.txt`;
    const testFile = pdfBucket.file(testFileName);
    
    console.log('🔄 Attempting to save test file to PDF bucket...');
    await testFile.save('Permission test content', {
      metadata: { contentType: 'text/plain' }
    });
    console.log('✅ Successfully saved test file to PDF bucket');

    // Test reading the file
    console.log('🔄 Attempting to read test file from PDF bucket...');
    const [fileExists] = await testFile.exists();
    if (fileExists) {
      console.log('✅ Successfully verified test file exists in PDF bucket');
    } else {
      console.error('❌ Test file does not exist in PDF bucket');
    }

    // Test downloading the file content
    try {
      const [downloadedContent] = await testFile.download();
      console.log('✅ Successfully downloaded test file content from PDF bucket');
    } catch (downloadError) {
      console.error('❌ Failed to download test file content:', downloadError.message);
    }

    // Test creating signed URL (critical for PDF delivery)
    console.log('🔄 Testing signed URL creation for PDF bucket...');
    try {
      const [signedUrl] = await testFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 5 * 60 * 1000, // 5 minutes
      });
      console.log('✅ Successfully created signed URL for PDF bucket');
      console.log(`🔗 Signed URL preview: ${signedUrl.substring(0, 80)}...`);
    } catch (signError) {
      console.error('❌ Failed to create signed URL for PDF bucket:', signError.message);
    }

    // Clean up test file
    try {
      await testFile.delete();
      console.log('✅ Successfully cleaned up test file from PDF bucket');
    } catch (cleanupError) {
      console.error('⚠️ Warning: Failed to clean up test file:', cleanupError.message);
    }

    // Test Images bucket as well (for completeness)
    const imagesBucketName = process.env.GCS_IMAGES_BUCKET_NAME;
    if (imagesBucketName) {
      console.log(`\n🖼️ Testing Images Bucket: ${imagesBucketName}`);
      const imagesBucket = storage.bucket(imagesBucketName);

      const testImageFileName = `test-image-permission-check-${Date.now()}.txt`;
      const testImageFile = imagesBucket.file(testImageFileName);
      
      try {
        await testImageFile.save('Image permission test content', {
          metadata: { contentType: 'text/plain' }
        });
        console.log('✅ Successfully saved test file to Images bucket');

        // Clean up
        await testImageFile.delete();
        console.log('✅ Successfully cleaned up test file from Images bucket');
      } catch (imageError) {
        console.error('❌ Failed to access Images bucket:', imageError.message);
      }
    } else {
      console.log('\n🖼️ Skipping Images bucket test - GCS_IMAGES_BUCKET_NAME not set');
    }

    // Test environment configuration
    console.log('\n🔧 Environment Configuration Check:');
    const requiredEnvVars = [
      'GCP_PROJECT_ID',
      'GCS_PDFS_BUCKET_NAME',
      'GCS_IMAGES_BUCKET_NAME',
      'GOOGLE_APPLICATION_CREDENTIALS'
    ];
    
    for (const varName of requiredEnvVars) {
      const isSet = !!process.env[varName];
      console.log(`  ${varName}: ${isSet ? '✅ Set' : '❌ Missing'}`);
    }

    console.log('\n✅ GCS PDF permissions test completed!');
    console.log('\n💡 Notes:');
    console.log('  - Ensure service account has Storage Admin or Storage Object Admin role');
    console.log('  - Verify the GOOGLE_APPLICATION_CREDENTIALS points to a valid key file');
    console.log('  - Check that buckets exist and are accessible from your deployment environment');

  } catch (error) {
    console.error('💥 Error testing GCS permissions:', error.message);
    console.error('Stack trace:', error.stack);
    
    if (error.message.includes('Could not load the default credentials')) {
      console.log('\n💡 Hint: Set GOOGLE_APPLICATION_CREDENTIALS environment variable to point to your service account key file');
    }
  }
}

// Run the test function
testPdfPermissions().catch(console.error);