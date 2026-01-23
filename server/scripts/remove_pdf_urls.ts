// remove_pdf_urls.ts
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';

async function removePdfUrls() {
  console.log('🗑️ Removing PDF URLs from all books...');

  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db();

  try {
    const result = await db.collection('books').updateMany(
      { pdfUrl: { $exists: true } },
      { $unset: { pdfUrl: "" }, $set: { updatedAt: new Date() } }
    );

    console.log(`✅ Removed PDF URLs from ${result.modifiedCount} books`);
  } catch (error) {
    console.error('❌ Error removing PDF URLs:', error);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  removePdfUrls().catch(console.error);
}

export { removePdfUrls };