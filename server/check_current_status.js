const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function checkBooksWithPDFLinks() {
  const client = new MongoClient(process.env.MONGODB_URI, {
    family: 4,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000
  });

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'story-db');
    
    // List of book IDs that we identified as having all images but no PDF
    const bookIds = [
      '697457b968550d2148a86bce',  // "Luna and Riff's Thankful Playdate"
      '6971bbe2774789616977097a',  // "Olivia and Pipsqueak's Jungle Kindness"
      '696e2083ac9e4f18294320aa',  // "Luna and Ellie's Birthday Surprise"
      '69730269d19d72eb53e10955'   // "Sophia and Ollie's Rainy Day Rescue"
    ];
    
    console.log('🔍 Checking current PDF status for identified books...\n');
    
    for (const bookId of bookIds) {
      const book = await db.collection('books').findOne({ 
        _id: new ObjectId(bookId) 
      });
      
      console.log(`📘 Book ID: ${bookId}`);
      console.log(`   Title: "${book?.title || 'Untitled'}"`);
      console.log(`   Status: ${book?.status || 'unknown'}`);
      console.log(`   PDF URL: ${book?.pdfUrl ? book.pdfUrl : 'No PDF URL in database'}`);
      console.log(`   Needs Regeneration: ${book?.needsPDFRegeneration ? 'Yes' : 'No'}`);
      
      if (book?.pdfUrl) {
        console.log(`   📄 Available PDF Link: ${book.pdfUrl}`);
      } else {
        console.log(`   🔄 Marked for regeneration: ${book?.needsPDFRegeneration ? 'Yes' : 'No'}`);
      }
      
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error checking books:', error);
  } finally {
    await client.close();
  }
}

// Run the check
checkBooksWithPDFLinks().then(() => {
  console.log('✅ Check completed!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});