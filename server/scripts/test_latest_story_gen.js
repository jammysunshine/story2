require('dotenv').config();
const { MongoClient } = require('mongodb');
const logger = require('../logger');

const log = logger;

async function testLatestStoryGen() {
  console.log('📚 Testing latest story generation functionality...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Get the most recent books
    const recentBooks = await db.collection('books').find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    console.log(`\n📖 Found ${recentBooks.length} recent books:\n`);

    for (const book of recentBooks) {
      console.log(`📋 Book: ${book.title || 'Untitled'}`);
      console.log(`   ID: ${book._id}`);
      console.log(`   Child: ${book.childName || 'N/A'}`);
      console.log(`   Created: ${book.createdAt ? new Date(book.createdAt).toISOString() : 'N/A'}`);
      console.log(`   Status: ${book.status || 'N/A'}`);
      console.log(`   Pages: ${book.pages ? book.pages.length : 0}`);
      console.log(`   User: ${book.userId || 'Guest'}`);

      // Check story generation completeness
      const hasTitle = !!book.title;
      const hasChildName = !!book.childName;
      const hasPages = book.pages && book.pages.length > 0;
      const hasValidPages = book.pages && book.pages.every(p => p.text && p.prompt);
      const hasBibles = !!book.heroBible && !!book.animalBible;

      console.log(`   \n   🧩 Story Components:`);
      console.log(`     Title: ${hasTitle ? '✅' : '❌'}`);
      console.log(`     Child Name: ${hasChildName ? '✅' : '❌'}`);
      console.log(`     Pages: ${hasPages ? '✅' : '❌'}`);
      console.log(`     Valid Page Content: ${hasValidPages ? '✅' : '❌'}`);
      console.log(`     Character Bibles: ${hasBibles ? '✅' : '❌'}`);

      // Check image generation status
      if (book.pages) {
        const totalPages = book.pages.length;
        const pagesWithImages = book.pages.filter(p => p.imageUrl && !p.imageUrl.includes('placeholder')).length;
        const imageProgress = totalPages > 0 ? Math.round((pagesWithImages / totalPages) * 100) : 0;

        console.log(`   \n   🖼️  Image Generation:`);
        console.log(`     Progress: ${pagesWithImages}/${totalPages} (${imageProgress}%)`);
        console.log(`     Status: ${imageProgress === 100 ? '✅ Complete' : imageProgress > 0 ? '🔄 In Progress' : '⏳ Pending'}`);
      }

      // Check PDF generation status
      console.log(`   \n   📄 PDF Generation:`);
      console.log(`     Status: ${book.pdfUrl ? '✅ Ready' : '⏳ Pending'}`);
      console.log(`     URL: ${book.pdfUrl ? 'Available' : 'Not generated'}`);

      // Check for potential issues
      console.log(`   \n   ⚠️  Potential Issues:`);
      const issues = [];

      if (!book.title) issues.push('Missing title');
      if (!book.childName) issues.push('Missing child name');
      if (!book.heroBible || !book.animalBible) issues.push('Missing character bibles');
      if (book.pages && book.pages.length === 0) issues.push('No pages generated');
      if (book.pages && book.pages.some(p => !p.text)) issues.push('Pages missing text');
      if (book.pages && book.pages.some(p => !p.prompt)) issues.push('Pages missing prompts');
      if (book.status === 'failed') issues.push('Book marked as failed');

      if (issues.length > 0) {
        issues.forEach(issue => console.log(`     • ${issue}`));
      } else {
        console.log(`     • None detected`);
      }

      console.log(`\n   ${'─'.repeat(50)}\n`);
    }

    // Summary statistics
    console.log(`📊 SUMMARY STATISTICS:`);
    
    // Status distribution
    const statusCounts = {};
    recentBooks.forEach(book => {
      const status = book.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log(`\n   Status Distribution:`);
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`     ${status}: ${count}`);
    }

    // Average pages per book
    const avgPages = recentBooks.reduce((sum, book) => sum + (book.pages ? book.pages.length : 0), 0) / recentBooks.length;
    console.log(`\n   Average pages per book: ${avgPages.toFixed(1)}`);

    // Books with PDFs
    const booksWithPdfs = recentBooks.filter(book => book.pdfUrl).length;
    const pdfPercentage = recentBooks.length > 0 ? Math.round((booksWithPdfs / recentBooks.length) * 100) : 0;
    console.log(`   Books with PDFs: ${booksWithPdfs}/${recentBooks.length} (${pdfPercentage}%)`);

    // Books with images
    const booksWithImages = recentBooks.filter(book => 
      book.pages && book.pages.some(p => p.imageUrl && !p.imageUrl.includes('placeholder'))
    ).length;
    const imagePercentage = recentBooks.length > 0 ? Math.round((booksWithImages / recentBooks.length) * 100) : 0;
    console.log(`   Books with images: ${booksWithImages}/${recentBooks.length} (${imagePercentage}%)`);

    // Test environment configuration
    console.log(`\n🔧 Environment Configuration Check:`);
    const requiredEnvVars = [
      'GOOGLE_API_KEY',
      'STORY_PAGES_COUNT',
      'STORY_TEASER_PAGES_COUNT'
    ];
    
    for (const varName of requiredEnvVars) {
      const isSet = !!process.env[varName];
      console.log(`   ${varName}: ${isSet ? '✅ Set' : '❌ Missing'}`);
      if (process.env[varName]) {
        console.log(`     Value: ${process.env[varName]}`);
      }
    }

    console.log('\n✅ Latest story generation test completed!');
    console.log('\n💡 Notes:');
    console.log('  - Monitor the status field to track story generation progress');
    console.log('  - Check for failed books that may need regeneration');
    console.log('  - Verify that all required components are present for complete stories');

  } catch (error) {
    console.error('💥 Error testing latest story generation:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the test function
testLatestStoryGen().catch(console.error);