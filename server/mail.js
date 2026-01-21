const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

async function sendStoryEmail(email, bookTitle, pdfUrl) {
  const mailOptions = {
    from: `"AI StoryTime" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `✨ Your Story is Ready: ${bookTitle}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h1>Your magical adventure is ready!</h1>
        <p>We've finished painting the illustrations for <strong>${bookTitle}</strong>.</p>
        <p>You can download your high-resolution PDF here:</p>
        <a href="${pdfUrl}" style="padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">Download PDF</a>
      </div>
    `,
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

module.exports = { sendStoryEmail, sendShippingEmail };
