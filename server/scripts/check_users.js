require('dotenv').config();
const { MongoClient } = require('mongodb');
const logger = require('../logger');

const log = logger;

async function checkUsers() {
  log.info('👥 Starting user inspection...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Get all users
    const users = await db.collection('users').find({}).toArray();

    console.log(`\n👥 Found ${users.length} users in the database:\n`);

    if (users.length === 0) {
      console.log('📭 No users found in the system.');
      return;
    }

    // Display user information in a table format
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ Email (masked)                    │ Name              │ Stats           │ Last Login        │ Created      │');
    console.log('├───────────────────────────────────┼───────────────────┼─────────────────┼───────────────────┼──────────────┤');

    for (const user of users) {
      // Mask email for privacy
      const email = user.email || 'N/A';
      const maskedEmail = email.length > 10 ? 
        email.substring(0, 3) + '***' + email.substring(email.lastIndexOf('@')) : 
        email;
      
      const name = (user.name || 'N/A').substring(0, 15).padEnd(15);
      const stats = `S:${user.storiesCount || 0} I:${user.imagesCount || 0} P:${user.pdfsCount || 0}`;
      const lastLogin = user.lastLogin ? new Date(user.lastLogin).toISOString().substring(0, 10) : 'Never';
      const created = user.createdAt ? new Date(user.createdAt).toISOString().substring(0, 10) : 'Unknown';

      console.log(`│ ${maskedEmail.padEnd(33)} │ ${name} │ ${stats.padEnd(15)} │ ${lastLogin.padEnd(17)} │ ${created.padEnd(12)} │`);
    }

    console.log('└───────────────────────────────────┴───────────────────┴─────────────────┴───────────────────┴──────────────┘');

    // Summary statistics
    console.log('\n📊 USER STATISTICS:');
    
    // Calculate averages
    const totalStories = users.reduce((sum, user) => sum + (user.storiesCount || 0), 0);
    const totalImages = users.reduce((sum, user) => sum + (user.imagesCount || 0), 0);
    const totalPdfs = users.reduce((sum, user) => sum + (user.pdfsCount || 0), 0);
    
    const avgStories = users.length > 0 ? (totalStories / users.length).toFixed(2) : 0;
    const avgImages = users.length > 0 ? (totalImages / users.length).toFixed(2) : 0;
    const avgPdfs = users.length > 0 ? (totalPdfs / users.length).toFixed(2) : 0;
    
    console.log(`  • Total Users: ${users.length}`);
    console.log(`  • Average Stories per User: ${avgStories}`);
    console.log(`  • Average Images per User: ${avgImages}`);
    console.log(`  • Average PDFs per User: ${avgPdfs}`);

    // Activity analysis
    const recentActivityThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const activeUsers = users.filter(user => user.lastLogin && new Date(user.lastLogin) > recentActivityThreshold);
    const inactiveUsers = users.length - activeUsers.length;
    
    console.log(`\n📈 ACTIVITY ANALYSIS (last 30 days):`);
    console.log(`  • Active Users: ${activeUsers.length} (${users.length > 0 ? Math.round((activeUsers.length / users.length) * 100) : 0}%)`);
    console.log(`  • Inactive Users: ${inactiveUsers} (${users.length > 0 ? Math.round((inactiveUsers / users.length) * 100) : 0}%)`);

    // Top contributors
    if (users.length > 0) {
      console.log('\n🏆 TOP CONTRIBUTORS:');
      
      const topStoryUsers = [...users]
        .sort((a, b) => (b.storiesCount || 0) - (a.storiesCount || 0))
        .slice(0, 3);
      
      console.log('  Stories Created:');
      topStoryUsers.forEach((user, index) => {
        console.log(`    ${index + 1}. ${user.email || 'N/A'}: ${user.storiesCount || 0} stories`);
      });

      const topImageUsers = [...users]
        .sort((a, b) => (b.imagesCount || 0) - (a.imagesCount || 0))
        .slice(0, 3);
      
      console.log('\n  Images Generated:');
      topImageUsers.forEach((user, index) => {
        console.log(`    ${index + 1}. ${user.email || 'N/A'}: ${user.imagesCount || 0} images`);
      });

      const topPdfUsers = [...users]
        .sort((a, b) => (b.pdfsCount || 0) - (a.pdfsCount || 0))
        .slice(0, 3);
      
      console.log('\n  PDFs Generated:');
      topPdfUsers.forEach((user, index) => {
        console.log(`    ${index + 1}. ${user.email || 'N/A'}: ${user.pdfsCount || 0} PDFs`);
      });
    }

    // Check for potential issues
    console.log('\n⚠️  POTENTIAL ISSUES:');
    const usersWithoutEmail = users.filter(user => !user.email);
    const usersWithoutName = users.filter(user => !user.name);
    const usersWithoutCreationDate = users.filter(user => !user.createdAt);
    
    console.log(`  • Users without email: ${usersWithoutEmail.length}`);
    console.log(`  • Users without name: ${usersWithoutName.length}`);
    console.log(`  • Users without creation date: ${usersWithoutCreationDate.length}`);

    // Check for users with unusually high counts (potential data issues)
    const highStoryUsers = users.filter(user => user.storiesCount > 100);
    const highImageUsers = users.filter(user => user.imagesCount > 1000);
    const highPdfUsers = users.filter(user => user.pdfsCount > 50);
    
    if (highStoryUsers.length > 0) {
      console.log(`  • Users with >100 stories: ${highStoryUsers.length}`);
      highStoryUsers.forEach(user => {
        console.log(`    - ${user.email}: ${user.storiesCount} stories`);
      });
    }
    
    if (highImageUsers.length > 0) {
      console.log(`  • Users with >1000 images: ${highImageUsers.length}`);
      highImageUsers.forEach(user => {
        console.log(`    - ${user.email}: ${user.imagesCount} images`);
      });
    }
    
    if (highPdfUsers.length > 0) {
      console.log(`  • Users with >50 PDFs: ${highPdfUsers.length}`);
      highPdfUsers.forEach(user => {
        console.log(`    - ${user.email}: ${user.pdfsCount} PDFs`);
      });
    }

    // Environment configuration check
    console.log('\n🔧 AUTHENTICATION CONFIGURATION:');
    const authVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'AUTH_SECRET',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL'
    ];
    
    for (const varName of authVars) {
      const isSet = !!process.env[varName];
      console.log(`  ${varName}: ${isSet ? '✅ Set' : '❌ Missing'}`);
    }

    console.log('\n✅ User inspection completed!');

  } catch (error) {
    log.error('💥 Error checking users:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the check function
checkUsers().catch(console.error);