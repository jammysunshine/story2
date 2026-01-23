// check_users.ts
import { MongoClient } from 'mongodb';
import 'dotenv/config';

async function checkUsers() {
  console.log('👥 Checking user data integrity...');

  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db();

  try {
    // Get user statistics
    const userCount = await db.collection('users').countDocuments();
    console.log(`📊 Total users: ${userCount}`);

    // Check for duplicate emails
    const duplicateEmails = await db.collection('users').aggregate([
      {
        $group: {
          _id: "$email",
          count: { $sum: 1 },
          docs: { $push: "$_id" }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();

    console.log(`⚠️  Users with duplicate emails: ${duplicateEmails.length}`);
    if (duplicateEmails.length > 0) {
      console.log('Duplicate email samples:', duplicateEmails.slice(0, 5).map(d => d._id));
    }

    // Check user data completeness
    const usersWithoutCredits = await db.collection('users').countDocuments({ credits: { $exists: false } });
    console.log(`⚠️  Users without credits field: ${usersWithoutCredits}`);

    const usersWithoutStats = await db.collection('users').countDocuments({
      $or: [
        { storiesCount: { $exists: false } },
        { imagesCount: { $exists: false } },
        { pdfsCount: { $exists: false } }
      ]
    });
    console.log(`⚠️  Users without stats: ${usersWithoutStats}`);

    // Check recent activity
    const recentRegistrations = await db.collection('users').countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });
    console.log(`🆕 Users registered in last 7 days: ${recentRegistrations}`);

    // Check for users with negative credits
    const usersWithNegativeCredits = await db.collection('users').countDocuments({ credits: { $lt: 0 } });
    console.log(`❌ Users with negative credits: ${usersWithNegativeCredits}`);

    console.log('✅ User data integrity check completed');
  } catch (error) {
    console.error('❌ User check failed:', error);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  checkUsers().catch(console.error);
}

export { checkUsers };