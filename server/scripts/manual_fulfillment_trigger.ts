// manual_fulfillment_trigger.ts
import { MongoClient, ObjectId } from 'mongodb';
import { triggerGelatoFulfillment } from '../fulfillmentService'; // Adjust path as needed
import 'dotenv/config';

async function manualFulfillmentTrigger(bookId: string) {
  if (!bookId) {
    console.error('❌ Book ID is required. Usage: ts-node manual_fulfillment_trigger.ts <bookId>');
    return;
  }

  console.log(`🔄 Manually triggering fulfillment for book: ${bookId}`);

  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db();

  try {
    const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
    
    if (!book) {
      console.error('❌ Book not found');
      return;
    }

    if (!book.pdfUrl) {
      console.error('❌ PDF URL not available for this book');
      return;
    }

    // Get shipping address from order or user
    const order = await db.collection('orders').findOne({ bookId: new ObjectId(bookId) });
    const shippingAddress = order?.shippingAddress || (book as any).shippingAddress;

    if (!shippingAddress) {
      console.error('❌ Shipping address not found');
      return;
    }

    // Trigger fulfillment
    await triggerGelatoFulfillment({
      bookId,
      pdfUrl: book.pdfUrl,
      shippingAddress,
      db,
      orderReferenceId: `${bookId}-manual-trigger`,
      currency: (order as any)?.currency || 'USD'
    });

    console.log('✅ Manual fulfillment triggered successfully');
  } catch (error) {
    console.error('❌ Error triggering manual fulfillment:', error);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  const bookId = process.argv[2];
  manualFulfillmentTrigger(bookId!).catch(console.error);
}

export { manualFulfillmentTrigger };