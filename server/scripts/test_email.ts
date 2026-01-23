// test_email.ts
import nodemailer from 'nodemailer';
import 'dotenv/config';

async function testEmail() {
  console.log('📧 Testing email functionality...');

  // Create transporter
  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection successful');

    // Send test email
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    const mailOptions = {
      from: `"AI StoryTime" <${process.env.SMTP_USER}>`,
      to: testEmail,
      subject: 'Test Email from AI StoryTime',
      html: `
        <h2>Test Email</h2>
        <p>This is a test email from the AI StoryTime system.</p>
        <p>If you received this, email functionality is working correctly!</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully');
    console.log(`📧 Message ID: ${info.messageId}`);
    console.log(`📧 Sent to: ${testEmail}`);
    
    return true;
  } catch (error) {
    console.error('❌ Email test failed:', error);
    return false;
  }
}

if (require.main === module) {
  testEmail().catch(console.error);
}

export { testEmail };