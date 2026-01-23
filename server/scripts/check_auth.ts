import 'dotenv/config';
import { MongoClient } from 'mongodb';
import logger from '../logger';

const log = logger;

interface User {
  _id: any;
  email?: string;
  name?: string;
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

async function checkAuthSystem() {
  log.info('🔐 Starting authentication system check...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI!, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Check if users collection exists and has records
    const userCount = await db.collection<User>('users').countDocuments();
    log.info(`👥 Users collection: ${userCount} users found`);

    if (userCount > 0) {
      // Get a sample user to check auth fields
      const sampleUser = await db.collection<User>('users').findOne({});
      log.info('📋 Sample user fields:', Object.keys(sampleUser || {}).filter(key =>
        !['_id', 'createdAt', 'updatedAt', 'lastLogin'].includes(key)
      ));

      // Check for required auth fields
      const hasEmail = !!sampleUser?.email;
      const hasName = !!sampleUser?.name;
      const hasLastLogin = !!sampleUser?.lastLogin;

      console.log('\n📋 Authentication System Status:');
      console.log(`  • Email field: ${hasEmail ? '✅ Available' : '❌ Missing'}`);
      console.log(`  • Name field: ${hasName ? '✅ Available' : '❌ Missing'}`);
      console.log(`  • Last login tracking: ${hasLastLogin ? '✅ Available' : '❌ Missing'}`);

      // Check for recent activity
      const recentUsers = await db.collection<User>('users').countDocuments({
        lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      });
      console.log(`  • Active users (last 30 days): ${recentUsers}`);
    } else {
      console.log('📭 No users found in the system');
    }

    // Check if auth environment variables are set
    console.log('\n🔐 Authentication Environment Variables:');
    const authVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'AUTH_SECRET',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL'
    ];

    for (const varName of authVars) {
      const isSet = !!process.env[varName];
      console.log(`  • ${varName}: ${isSet ? '✅ Set' : '❌ Missing'}`);
    }

    // Check for auth-related collections
    const collections = await db.collections();
    const collectionNames = collections.map(col => col.collectionName);

    console.log('\n🗄️ Authentication Collections:');
    console.log(`  • users: ${collectionNames.includes('users') ? '✅ Exists' : '❌ Missing'}`);

    // Check for any auth-related indexes
    const userIndexes = await db.collection<User>('users').indexes();
    const hasEmailIndex = userIndexes.some(idx => idx.key && idx.key.email);
    console.log(`  • Email index: ${hasEmailIndex ? '✅ Exists' : '❌ Missing'}`);

    console.log('\n✅ Authentication system check completed successfully!');
  } catch (error) {
    log.error('💥 Error checking authentication system:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the check function
checkAuthSystem().catch(console.error);

export { checkAuthSystem };