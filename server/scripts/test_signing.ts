import 'dotenv/config';
import { Storage } from '@google-cloud/storage';
import logger from '../logger';

const log = logger;

async function testSigning() {
  console.log('🔐 Testing GCS signing functionality...');

  try {
    // Initialize GCS client
    const storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    // Check required environment variables
    console.log('🔧 Environment Configuration Check:');
    const requiredEnvVars = [
      'GCP_PROJECT_ID',
      'GCS_IMAGES_BUCKET_NAME',
      'GCS_PDFS_BUCKET_NAME',
      'GOOGLE_APPLICATION_CREDENTIALS'
    ];

    for (const varName of requiredEnvVars) {
      const isSet = !!process.env[varName];
      console.log(`  ${varName}: ${isSet ? '✅ Set' : '❌ Missing'}`);
    }

    if (!process.env.GCP_PROJECT_ID || !process.env.GCS_PDFS_BUCKET_NAME) {
      console.error('\n❌ Required environment variables are missing. Please set GCP_PROJECT_ID and GCS_PDFS_BUCKET_NAME.');
      return;
    }

    // Test PDF bucket signing
    const pdfBucketName = process.env.GCS_PDFS_BUCKET_NAME;
    console.log(`\n📄 Testing PDF bucket: ${pdfBucketName}`);

    const pdfBucket = storage.bucket(pdfBucketName);

    // Create a test file to sign
    const testFileName = `test-signing-${Date.now()}.txt`;
    const testFile = pdfBucket.file(testFileName);

    console.log('🔄 Creating test file...');
    await testFile.save('Test content for signing functionality', {
      metadata: { contentType: 'text/plain' }
    });
    console.log('✅ Test file created successfully');

    // Test signing URL
    console.log('🔐 Testing signed URL generation...');
    try {
      const [signedUrl] = await testFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      });

      console.log('✅ Signed URL generated successfully');
      console.log(`🔗 Signed URL preview: ${signedUrl.substring(0, 80)}...`);

      // Test if the signed URL is accessible
      console.log('🌐 Testing signed URL accessibility...');
      const response = await fetch(signedUrl);
      if (response.ok) {
        console.log('✅ Signed URL is accessible');
      } else {
        console.log(`❌ Signed URL returned status: ${response.status}`);
      }
    } catch (signError) {
      console.error(`❌ Failed to generate signed URL: ${(signError as Error).message}`);
    }

    // Test different expiration times
    console.log('\n⏰ Testing different expiration times...');
    const expirationTests = [
      { name: '1 minute', minutes: 1 },
      { name: '1 hour', minutes: 60 },
      { name: '1 day', minutes: 24 * 60 },
      { name: '7 days', minutes: 7 * 24 * 60 }
    ];

    for (const test of expirationTests) {
      try {
        const [expUrl] = await testFile.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + test.minutes * 60 * 1000,
        });
        console.log(`  ${test.name}: ✅ Generated`);
      } catch (expError) {
        console.log(`  ${test.name}: ❌ Failed - ${(expError as Error).message}`);
      }
    }

    // Test Images bucket signing
    if (process.env.GCS_IMAGES_BUCKET_NAME) {
      const imagesBucketName = process.env.GCS_IMAGES_BUCKET_NAME;
      console.log(`\n🖼️  Testing Images bucket: ${imagesBucketName}`);

      const imagesBucket = storage.bucket(imagesBucketName);
      const testImageFile = imagesBucket.file(testFileName);

      try {
        // Copy the test file to images bucket
        await testFile.move(imagesBucket.file(testFileName));
        console.log('✅ Test file copied to images bucket');

        // Test signing in images bucket
        const [imageSignedUrl] = await testImageFile.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 5 * 60 * 1000, // 5 minutes
        });

        console.log('✅ Images bucket signed URL generated successfully');
      } catch (imageError) {
        console.error(`❌ Failed to work with images bucket: ${(imageError as Error).message}`);
      }
    }

    // Test signing with different options
    console.log('\n⚙️  Testing different signing options...');

    // Test with content-disposition header
    try {
      const [dispositionUrl] = await testFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 5 * 60 * 1000,
        contentDisposition: 'attachment; filename="test-signed-file.txt"'
      });
      console.log('  Content-Disposition header: ✅ Working');
    } catch (dispError) {
      console.log(`  Content-Disposition header: ❌ Failed - ${(dispError as Error).message}`);
    }

    // Test with response-content-type header
    try {
      const [contentTypeUrl] = await testFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 5 * 60 * 1000,
        contentType: 'text/plain'
      });
      console.log('  Content-Type override: ✅ Working');
    } catch (typeError) {
      console.log(`  Content-Type override: ❌ Failed - ${(typeError as Error).message}`);
    }

    // Clean up test file
    try {
      await testFile.delete();
      console.log('\n✅ Test file cleaned up successfully');
    } catch (cleanupError) {
      console.error(`\n⚠️  Warning: Failed to clean up test file: ${(cleanupError as Error).message}`);
    }

    // Test common signing patterns used in the application
    console.log('\n🔍 Testing common application signing patterns...');

    // Pattern 1: PDF signing (7-day expiry as used in mail)
    try {
      await testFile.save('Test PDF content', { metadata: { contentType: 'application/pdf' } });
      const [pdfSignedUrl] = await testFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      console.log('  PDF 7-day signing (for emails): ✅ Working');
    } catch (pdfSignError) {
      console.log(`  PDF 7-day signing: ❌ Failed - ${(pdfSignError as Error).message}`);
    }

    // Pattern 2: Image signing (15-minute expiry as used in templates)
    try {
      const [imageSignedUrl] = await testFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      });
      console.log('  Image 15-min signing (for templates): ✅ Working');
    } catch (imageSignError) {
      console.log(`  Image 15-min signing: ❌ Failed - ${(imageSignError as Error).message}`);
    }

    console.log('\n✅ GCS signing functionality test completed!');
    console.log('\n💡 Notes:');
    console.log('  - Ensure your service account has proper permissions for signing URLs');
    console.log('  - Check that GOOGLE_APPLICATION_CREDENTIALS points to a valid key file');
    console.log('  - Verify that your GCS buckets exist and are accessible');

  } catch (error) {
    console.error('💥 Error testing GCS signing:', (error as Error).message);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }

    if ((error as Error).message.includes('Could not load the default credentials')) {
      console.log('\n💡 Hint: Set GOOGLE_APPLICATION_CREDENTIALS environment variable to point to your service account key file');
    }
  }
}

// Run the test function
testSigning().catch(console.error);

export { testSigning };