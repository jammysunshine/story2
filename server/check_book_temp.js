const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

async function checkBook() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'story-db');
    const book = await db.collection('books').findOne({ _id: new ObjectId('6975a64e155cb8f6de93c2bd') });
    console.log(JSON.stringify(book, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
checkBook();
