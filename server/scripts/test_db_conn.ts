import 'dotenv/config';
import { MongoClient } from 'mongodb';
import logger from '../logger';

const log = logger;

interface ServerStatus {
  version: string;
  host: string;
  connections?: {
    current: number;
  };
  [key: string]: any;
}

interface CollectionInfo {
  name: string;
  [key: string]: any;
}

async function testDbConnection() {
  console.log('🔌 Testing MongoDB connection...');

  // Test connection string
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ Error: MONGODB_URI is not set in environment variables');
    return;
  }

  console.log(`🔗 Connection string: ${mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`); // Mask credentials

  let client: MongoClient | undefined;
  try {
    // Test basic connection
    console.log('\n🔍 Testing basic connection...');
    client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 5000, // 5 second timeout
      family: 4 // Use IPv4
    });

    const startTime = Date.now();
    await client.connect();
    const connectTime = Date.now() - startTime;
    console.log(`✅ Connected successfully in ${connectTime}ms`);

    // Test database access
    console.log('\n📊 Testing database access...');
    const db = client.db();
    const dbName = db.databaseName || 'default';
    console.log(`📋 Connected to database: ${dbName}`);

    // Test collection access
    console.log('\n🗄️ Testing collection access...');
    const collections: CollectionInfo[] = await db.listCollections().toArray();
    console.log(`📋 Found ${collections.length} collections: ${collections.map(c => c.name).join(', ')}`);

    // Test basic operations
    console.log('\n🔧 Testing basic operations...');

    // Test read operation
    const booksCount = await db.collection('books').estimatedDocumentCount();
    console.log(`📖 Books collection: ${booksCount} documents`);

    const usersCount = await db.collection('users').estimatedDocumentCount();
    console.log(`👥 Users collection: ${usersCount} documents`);

    const ordersCount = await db.collection('orders').estimatedDocumentCount();
    console.log(`📦 Orders collection: ${ordersCount} documents`);

    // Test write operation (in a temporary collection)
    console.log('\n📝 Testing write operations...');
    const testCollection = db.collection('connection_test');
    const testData = {
      timestamp: new Date(),
      testId: `conn-test-${Date.now()}`,
      message: 'Connection test successful'
    };

    const insertStartTime = Date.now();
    const insertResult = await testCollection.insertOne(testData);
    const insertTime = Date.now() - insertStartTime;
    console.log(`✅ Inserted test document in ${insertTime}ms, ID: ${insertResult.insertedId}`);

    // Test read back the inserted document
    const readStartTime = Date.now();
    const foundDoc = await testCollection.findOne({ _id: insertResult.insertedId });
    const readTime = Date.now() - readStartTime;
    console.log(`✅ Read test document in ${readTime}ms, Timestamp: ${foundDoc?.timestamp}`);

    // Clean up test document
    await testCollection.deleteOne({ _id: insertResult.insertedId });
    console.log(`✅ Cleaned up test document`);

    // Test index access
    console.log('\n🔍 Testing index access...');
    const bookIndexes = await db.collection('books').indexes();
    console.log(`📋 Books collection has ${bookIndexes.length} indexes`);

    const userIndexes = await db.collection('users').indexes();
    console.log(`📋 Users collection has ${userIndexes.length} indexes`);

    // Test ping command
    console.log('\n🏓 Testing ping command...');
    const pingStartTime = Date.now();
    const pingResult = await db.admin().ping();
    const pingTime = Date.now() - pingStartTime;
    console.log(`✅ Ping successful in ${pingTime}ms`);

    // Test server status
    console.log('\n🖥️ Testing server status...');
    try {
      const serverStatus: ServerStatus = await db.admin().serverStatus();
      console.log(`📊 MongoDB version: ${serverStatus.version}`);
      console.log(`📊 Host: ${serverStatus.host}`);
      console.log(`📊 Connections: ${serverStatus.connections?.current || 'N/A'} current`);
    } catch (statusError) {
      console.log(`⚠️ Could not retrieve server status: ${(statusError as Error).message}`);
    }

    console.log('\n✅ MongoDB connection test completed successfully!');
    console.log('\n💡 Connection Metrics:');
    console.log(`  - Total connection time: ${connectTime}ms`);
    console.log(`  - Average operation time: ${Math.round((insertTime + readTime + pingTime) / 3)}ms`);
    console.log(`  - Database: ${dbName}`);
    console.log(`  - Collections: ${collections.length}`);

  } catch (error) {
    console.error('💥 MongoDB connection test failed:', (error as Error).message);

    if ((error as Error).message.includes('ECONNREFUSED')) {
      console.log('💡 Hint: Check if MongoDB is running and accessible at the provided URI');
    } else if ((error as Error).message.includes('Authentication failed')) {
      console.log('💡 Hint: Check your MongoDB username and password');
    } else if ((error as Error).message.includes('getaddrinfo ENOTFOUND')) {
      console.log('💡 Hint: Check if the MongoDB hostname is correct and reachable');
    } else if ((error as Error).message.includes('Server selection timed out')) {
      console.log('💡 Hint: Check network connectivity and firewall settings');
    }
  } finally {
    if (client) {
      await client.close();
      log.info('🔒 Database connection closed.');
    }
  }
}

// Run the test function
testDbConnection().catch(console.error);

export { testDbConnection };