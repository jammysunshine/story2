// assign_to_nidhi.ts
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';

async function assignToNidhi() {
  console.log('🔄 Assigning books to Nidhi...');

  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db();

  try {
    // Example: Update books to assign to a specific user
    const result = await db.collection('books').updateMany(
      { assignedTo: { $exists: false } }, // Books not yet assigned
      { 
        $set: { 
          assignedTo: 'nidhi@example.com',
          assignedAt: new Date(),
          status: 'assigned'
        }
      }
    );

    console.log(`✅ Assigned ${result.modifiedCount} books to Nidhi`);
  } catch (error) {
    console.error('❌ Error assigning books to Nidhi:', error);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  assignToNidhi().catch(console.error);
}

export { assignToNidhi };