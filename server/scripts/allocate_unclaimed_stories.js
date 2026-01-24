const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const TARGET_EMAIL = 'paavni.mendiratta@gmail.com';

async function findUnclaimedStories() {
  console.log('🔍 Finding unclaimed stories (teasers with no userId)...');

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable not set');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI, {
    family: 4,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 60000
  });

  try {
    console.log('📡 Connecting to MongoDB...');
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'story-db');
    console.log('✅ Connected to MongoDB');

    // Find unclaimed stories
    const unclaimedStories = await db.collection('books').find({
      userId: null,
      status: 'teaser'
    }).sort({ createdAt: -1 }).toArray();

    console.log(`\n📊 Found ${unclaimedStories.length} unclaimed stories:\n`);

    unclaimedStories.forEach((story, index) => {
      console.log(`${index + 1}. ID: ${story._id.toString()}`);
      console.log(`   Title: "${story.title}"`);
      console.log(`   Child: ${story.childName} (${story.age}yo ${story.gender})`);
      console.log(`   Created: ${story.createdAt.toISOString()}`);
      console.log(`   Pages: ${story.pages?.length || 0}`);
      console.log(`   Has Images: ${story.pages?.some(p => p.imageUrl && !p.imageUrl.includes('placeholder')) ? 'Yes' : 'No'}`);
      console.log('');
    });

    if (unclaimedStories.length === 0) {
      console.log('🎉 No unclaimed stories found!');
      return;
    }

    // Check if --allocate flag is passed
    const shouldAllocate = process.argv.includes('--allocate');

    if (!shouldAllocate) {
      console.log('💡 To allocate these stories to paavni.mendiratta@gmail.com, run this script with --allocate flag');
      console.log('   Example: node allocate_unclaimed_stories.js --allocate');
      return;
    }

    console.log(`\n🚀 Allocating ${unclaimedStories.length} stories to ${TARGET_EMAIL}...`);

    let allocated = 0;
    let errors = 0;

    for (const story of unclaimedStories) {
      try {
        console.log(`   📝 Processing: "${story.title}"`);

        // Update the book
        const updateResult = await db.collection('books').updateOne(
          { _id: story._id },
          {
            $set: {
              userId: TARGET_EMAIL,
              status: 'preview',
              isDigitalUnlocked: true,
              updatedAt: new Date()
            }
          }
        );

        if (updateResult.modifiedCount !== 1) {
          throw new Error('Failed to update book');
        }

        // Create recent book entry
        const recentBookEntry = {
          id: story._id.toString(),
          title: story.title,
          thumbnailUrl: story.pages?.[0]?.imageUrl || '',
          status: 'preview',
          isDigitalUnlocked: true,
          createdAt: story.createdAt
        };

        // Update user's recent books and increment count
        await db.collection('users').updateOne(
          { email: TARGET_EMAIL.toLowerCase() },
          {
            $inc: { storiesCount: 1 },
            $push: {
              recentBooks: {
                $each: [recentBookEntry],
                $position: 0,
                $slice: 10 // Keep last 10
              }
            },
            $set: { updatedAt: new Date() }
          },
          { upsert: true }
        );

        console.log(`   ✅ Allocated: "${story.title}"`);
        allocated++;
      } catch (error) {
        console.error(`   ❌ Error allocating "${story.title}":`, error.message);
        errors++;
      }
    }

    console.log(`\n🎉 Allocation completed!`);
    console.log(`   ✅ Successfully allocated: ${allocated} stories`);
    console.log(`   ❌ Errors: ${errors} stories`);
    console.log(`   📧 Allocated to: ${TARGET_EMAIL}`);

  } catch (error) {
    console.error('💥 Error:', error.message);
    console.error(error.stack);
  } finally {
    console.log('🔌 Closing MongoDB connection...');
    await client.close();
    console.log('🔒 Database connection closed.');
  }
}

// Run the script
if (require.main === module) {
  findUnclaimedStories().catch(console.error);
}

module.exports = { findUnclaimedStories };