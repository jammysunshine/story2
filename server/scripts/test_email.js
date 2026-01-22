require('dotenv').config();
const { sendStoryEmail, getPdfReadyTemplate } = require('../mail');

async function testEmailSystem() {
  console.log('🧪 Testing Email System...');

  const testEmail = process.env.TEST_EMAIL || 'test@example.com';
  const testBookTitle = 'Test Book - Email System Verification';
  const testPdfUrl = 'https://example.com/test-book.pdf';
  const libraryUrl = process.env.APP_URL || 'http://localhost:3000';

  console.log(`📧 Sending test email to: ${testEmail}`);
  console.log(`📚 Book title: ${testBookTitle}`);
  console.log(`📄 PDF URL: ${testPdfUrl}`);

  try {
    // Test the PDF ready template directly
    console.log('\n📝 Testing PDF ready template...');
    const html = getPdfReadyTemplate(
      testEmail.split('@')[0], // Use email prefix as customer name
      testBookTitle,
      testPdfUrl,
      libraryUrl
    );

    console.log('✅ PDF ready template generated successfully');
    console.log('HTML length:', html.length, 'characters');

    // Send the actual email
    console.log('\n📤 Sending test email...');
    await sendStoryEmail(testEmail, testBookTitle, testPdfUrl);

    console.log('✅ Test email sent! Check your inbox (including Spam folder).');
    console.log('📋 Note: If using Gmail, make sure "Less secure app access" is enabled or use App Passwords.');
  } catch (error) {
    console.error('💥 Error testing email system:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test function
testEmailSystem().catch(console.error);