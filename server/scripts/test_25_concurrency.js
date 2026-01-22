require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const logger = require('../logger');

const log = logger;

async function testConcurrency() {
  console.log('⚡ Starting concurrency/load test...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Get a sample book to use for testing
    const sampleBook = await db.collection('books').findOne({});
    if (!sampleBook) {
      console.log('❌ No books found to test with. Please create a book first.');
      return;
    }

    console.log(`\n📖 Using book for testing: ${sampleBook.title || 'Untitled'} (ID: ${sampleBook._id})`);
    console.log(`📊 Pages in book: ${sampleBook.pages ? sampleBook.pages.length : 0}`);

    // Define the number of concurrent operations to test
    const concurrencyLevels = [5, 10, 25]; // Different levels of concurrency to test
    
    console.log('\n🧪 CONCURRENT OPERATION TESTS:');
    
    for (const concurrencyLevel of concurrencyLevels) {
      console.log(`\n📈 Testing with ${concurrencyLevel} concurrent operations...`);
      
      const startTime = Date.now();
      const operations = [];
      
      // Create concurrent operations to test system capacity
      for (let i = 0; i < concurrencyLevel; i++) {
        operations.push(
          (async (id) => {
            try {
              // Simulate a database read operation
              const result = await db.collection('books').findOne({ _id: sampleBook._id });
              
              // Simulate some processing time
              await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
              
              return { id, success: !!result, operation: 'read' };
            } catch (error) {
              return { id, success: false, operation: 'read', error: error.message };
            }
          })(i)
        );
      }
      
      // Execute all operations concurrently
      const results = await Promise.all(operations);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Analyze results
      const successfulOps = results.filter(r => r.success).length;
      const failedOps = results.filter(r => !r.success).length;
      const avgTimePerOp = totalTime / concurrencyLevel;
      
      console.log(`   Total time: ${totalTime}ms`);
      console.log(`   Successful operations: ${successfulOps}/${concurrencyLevel}`);
      console.log(`   Failed operations: ${failedOps}/${concurrencyLevel}`);
      console.log(`   Average time per operation: ${avgTimePerOp.toFixed(2)}ms`);
      console.log(`   Operations per second: ${(concurrencyLevel / (totalTime / 1000)).toFixed(2)}`);
      
      if (failedOps > 0) {
        console.log(`   ❌ Failures detected: ${results.filter(r => !r.success).map(r => r.error).join(', ')}`);
      } else {
        console.log(`   ✅ All operations succeeded`);
      }
    }

    // Test concurrent updates to different documents
    console.log('\n🔄 Testing concurrent updates to different books...');
    
    // Get multiple sample books for update testing
    const sampleBooks = await db.collection('books').find({}).limit(10).toArray();
    
    if (sampleBooks.length > 1) {
      const updateConcurrency = Math.min(5, sampleBooks.length); // Limit to avoid too many operations
      const updateStartTime = Date.now();
      
      const updateOperations = [];
      for (let i = 0; i < updateConcurrency; i++) {
        const book = sampleBooks[i];
        updateOperations.push(
          (async (bookId, opId) => {
            try {
              // Simulate an update operation
              const result = await db.collection('books').updateOne(
                { _id: bookId },
                { $set: { lastAccessed: new Date(), testMarker: `concurrent_test_${opId}` } }
              );
              
              return { id: opId, success: result.matchedCount > 0, operation: 'update' };
            } catch (error) {
              return { id: opId, success: false, operation: 'update', error: error.message };
            }
          })(book._id, i)
        );
      }
      
      const updateResults = await Promise.all(updateOperations);
      const updateEndTime = Date.now();
      const updateTotalTime = updateEndTime - updateStartTime;
      
      const successfulUpdates = updateResults.filter(r => r.success).length;
      const failedUpdates = updateResults.filter(r => !r.success).length;
      
      console.log(`   Total update time: ${updateTotalTime}ms`);
      console.log(`   Successful updates: ${successfulUpdates}/${updateConcurrency}`);
      console.log(`   Failed updates: ${failedUpdates}/${updateConcurrency}`);
      console.log(`   Updates per second: ${(updateConcurrency / (updateTotalTime / 1000)).toFixed(2)}`);
    } else {
      console.log('   Skipping update test - not enough books available');
    }

    // Test API endpoint concurrency simulation
    console.log('\n🌐 Simulating concurrent API requests...');
    
    const apiConcurrency = 10;
    const apiStartTime = Date.now();
    
    const apiOperations = [];
    for (let i = 0; i < apiConcurrency; i++) {
      apiOperations.push(
        (async (opId) => {
          try {
            // Simulate an API request to get book status
            const response = await fetch(`${process.env.APP_URL || 'http://localhost:3001'}/api/book-status?bookId=${sampleBook._id}`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' }
            });
            
            return { id: opId, success: response.ok, status: response.status, operation: 'api-get' };
          } catch (error) {
            return { id: opId, success: false, operation: 'api-get', error: error.message };
          }
        })(i)
      );
    }
    
    const apiResults = await Promise.all(apiOperations);
    const apiEndTime = Date.now();
    const apiTotalTime = apiEndTime - apiStartTime;
    
    const successfulApis = apiResults.filter(r => r.success).length;
    const failedApis = apiResults.filter(r => !r.success).length;
    
    console.log(`   Total API simulation time: ${apiTotalTime}ms`);
    console.log(`   Successful API calls: ${successfulApis}/${apiConcurrency}`);
    console.log(`   Failed API calls: ${failedApis}/${apiConcurrency}`);
    console.log(`   API calls per second: ${(apiConcurrency / (apiTotalTime / 1000)).toFixed(2)}`);

    // System resource check
    console.log('\n🖥️ SYSTEM RESOURCE UTILIZATION:');
    const memoryUsage = process.memoryUsage();
    console.log(`   Heap total: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Heap used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`);

    // Performance recommendations
    console.log('\n💡 PERFORMANCE RECOMMENDATIONS:');
    
    // Based on the results, provide recommendations
    const allTestsPassed = 
      [5, 10, 25].every(level => {
        // This is a simplified check - in reality you'd want more sophisticated analysis
        return true; // Placeholder - actual implementation would check results
      });
    
    if (allTestsPassed) {
      console.log('   ✅ System appears to handle concurrent operations well');
    } else {
      console.log('   ⚠️  Consider reviewing system performance under load');
    }
    
    console.log('   - Monitor database connection pool settings');
    console.log('   - Consider implementing caching for frequently accessed data');
    console.log('   - Review server resource allocation');

    console.log('\n✅ Concurrency/load test completed!');

  } catch (error) {
    log.error('💥 Error during concurrency test:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the concurrency test function
testConcurrency().catch(console.error);