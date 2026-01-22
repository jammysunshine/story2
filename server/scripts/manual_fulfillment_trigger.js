require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const { triggerGelatoFulfillment } = require('../fulfillmentService');

async function manualFulfillmentTrigger() {
  console.log('🚀 MANUALLY TRIGGERING FULFILLMENT...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Find a specific book to trigger fulfillment for (most recent unpaid book with PDF)
    const book = await db.collection('books').findOne({
      pdfUrl: { $exists: true, $ne: null },
      status: { $in: ['paid', 'pdf_ready'] }  // Books that are paid but not yet printing
    }, { sort: { createdAt: -1 } });

    if (!book) {
      console.error('❌ No suitable book found for manual fulfillment.');
      console.log('💡 Tip: Make sure you have a book with status "paid" or "pdf_ready" and a valid pdfUrl');
      return;
    }

    console.log(`📖 Selected book for fulfillment: ${book.title}`);
    console.log(`🆔 Book ID: ${book._id}`);
    console.log(`📄 PDF URL: ${book.pdfUrl}`);
    console.log(`📊 Current Status: ${book.status}`);

    // Use a default shipping address for testing
    const defaultShippingAddress = {
      firstName: "Test",
      lastName: "Customer",
      addressLine1: "123 Sample Street",
      addressLine2: "Unit 1",
      city: "Sample City",
      state: "Sample State",
      postCode: "12345",
      country: "US",
      email: process.env.TEST_EMAIL || "test@example.com"
    };

    // Get the actual shipping address if available
    let shippingAddress = defaultShippingAddress;
    if (book.shippingDetails) {
      shippingAddress = {
        firstName: book.shippingDetails.name?.split(' ')[0] || 'Test',
        lastName: book.shippingDetails.name?.split(' ').slice(1).join(' ') || 'Customer',
        addressLine1: book.shippingDetails.address?.line1 || '123 Sample Street',
        addressLine2: book.shippingDetails.address?.line2 || '',
        city: book.shippingDetails.address?.city || 'Sample City',
        state: book.shippingDetails.address?.state || 'Sample State',
        postCode: book.shippingDetails.address?.postal_code || '12345',
        country: book.shippingDetails.address?.country || 'US',
        email: book.customerEmail || process.env.TEST_EMAIL || "test@example.com"
      };
    }

    console.log('📦 Shipping Address:', shippingAddress);

    // Trigger Gelato fulfillment manually
    const result = await triggerGelatoFulfillment({
      bookId: book._id.toString(),
      pdfUrl: book.pdfUrl,
      shippingAddress: shippingAddress,
      db: db,
      orderReferenceId: `${book._id.toString()}-manual-${Date.now()}`,
      currency: 'USD'
    });

    console.log('✅ Manual fulfillment triggered successfully!');
    console.log('📋 Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('💥 Error in manual fulfillment:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await client.close();
    console.log('🔒 Database connection closed.');
  }
}

// Run the function
manualFulfillmentTrigger().catch(console.error);