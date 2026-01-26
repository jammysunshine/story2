const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Verify configuration on boot
if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
  console.warn('⚠️ WARNING: SMTP credentials missing. PDF emails will fail to send.');
}

async function sendStoryEmail(email, bookTitle, pdfUrl) {
  // Use the PDF ready template for consistency with story1
  const html = getPdfReadyTemplate(
    email.split('@')[0], // Use email prefix as customer name
    bookTitle,
    pdfUrl,
    process.env.APP_URL || 'http://localhost:3000'
  );

  const mailOptions = {
    from: `"WonderStories AI" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `✨ Your Story is Ready: ${bookTitle}`,
    html: html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${email}`);
  } catch (error) {
    console.error('❌ Failed to send email:', error);
  }
}

async function sendShippingEmail(email, bookTitle, trackingUrl) {
  const mailOptions = {
    from: `"AI StoryTime" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `📦 Your Book has Shipped: ${bookTitle}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h1>It's on the way!</h1>
        <p>Your physical copy of <strong>${bookTitle}</strong> has been printed and shipped.</p>
        <p>Track your package here:</p>
        <a href="${trackingUrl}" style="padding: 10px 20px; background: #10b981; color: white; text-decoration: none; border-radius: 5px;">Track Package</a>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Shipping email sent to ${email}`);
  } catch (error) {
    console.error('❌ Failed to send shipping email:', error);
  }
}

/**
 * HTML template for when a PDF is ready
 */
function getPdfReadyTemplate(customerName, bookTitle, signedPdfUrl, libraryUrl) {
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 40px;">🎨</span>
        <h1 style="color: #1a1a1a; font-size: 28px; font-weight: 900; margin: 10px 0;">Your Masterpiece is Ready!</h1>
      </div>

      <p style="color: #444; font-size: 16px; line-height: 1.6;">
        Hi ${customerName},<br><br>
        Great news! The digital bindery has finished processing your book: <strong>"${bookTitle}"</strong>. Your high-resolution PDF is now ready for you to view or download.
      </p>

      <div style="text-align: center; margin: 40px 0;">
        <a href="${libraryUrl}" style="background-color: #3b82f6; color: white; padding: 16px 35px; text-decoration: none; font-weight: bold; border-radius: 12px; font-size: 18px; box-shadow: 0 10px 20px rgba(59,130,246,0.3); display: inline-block; margin-bottom: 20px;">
          Go to My Library
        </a>
        <br>
        <a href="${signedPdfUrl}" style="color: #6366f1; text-decoration: none; font-weight: bold; font-size: 14px;">
          Or download directly (Link expires in 7 days)
        </a>
      </div>

      <p style="color: #666; font-size: 14px; text-align: center;">
        If you ordered a physical hardcover, it has now moved to the printing and binding stage. We will notify you once it ships!
      </p>

      <div style="text-align: center; color: #aaa; font-size: 12px; padding-top: 20px; border-top: 1px solid #eee; margin-top: 40px;">
        © 2026 WonderStories AI. All rights reserved.
      </div>
    </div>
  `;
}

module.exports = { sendStoryEmail, sendShippingEmail, getPdfReadyTemplate };
