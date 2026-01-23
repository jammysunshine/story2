import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import logger from '../logger';

const log = logger;

interface Book {
  _id: ObjectId;
  title?: string;
  pages?: any[];
  [key: string]: any;
}

interface OperationResult {
  iteration: number;
  bookIndex: number;
  bookId: string;
  success: boolean;
  operation: string;
  error?: string;
  time: number;
}

async function testFullBookParallel() {
  console.log('📚 Starting full book parallel processing test...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI!, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Get multiple sample books to use for parallel testing
    const sampleBooks = await db.collection<Book>('books').find({}).limit(10).toArray();

    if (sampleBooks.length === 0) {
      console.log('❌ No books found to test with. Please create some books first.');
      return;
    }

    console.log(`\n📖 Testing with ${sampleBooks.length} books:`);
    for (const book of sampleBooks) {
      console.log(`   • ${book.title || 'Untitled'} (ID: ${book._id}, Pages: ${book.pages ? book.pages.length : 0})`);
    }

    // Define test parameters
    const maxBooksToTest = Math.min(5, sampleBooks.length); // Test up to 5 books in parallel
    const testIterations = 3; // Number of times to repeat the test

    console.log(`\n🧪 TESTING PARALLEL BOOK OPERATIONS:`);
    console.log(`   Books to test: ${maxBooksToTest}`);
    console.log(`   Test iterations: ${testIterations}`);

    // Test 1: Parallel book reads
    console.log('\n📖 Test 1: Parallel book reads...');
    const readResults: OperationResult[] = [];

    for (let iteration = 0; iteration < testIterations; iteration++) {
      console.log(`   Iteration ${iteration + 1}/${testIterations}...`);

      const iterationStartTime = Date.now();
      const bookReadPromises: Promise<OperationResult>[] = [];

      for (let i = 0; i < maxBooksToTest; i++) {
        const book = sampleBooks[i % sampleBooks.length]; // Cycle through available books

        bookReadPromises.push(
          (async (bookIndex, iteration) => {
            try {
              // Simulate reading a book
              const result = await db.collection<Book>('books').findOne({ _id: book._id });
              await new Promise(resolve => setTimeout(resolve, Math.random() * 100)); // Simulate processing time

              return {
                iteration,
                bookIndex,
                bookId: book._id.toString(),
                success: !!result,
                operation: 'read',
                time: Date.now() - iterationStartTime
              };
            } catch (error) {
              return {
                iteration,
                bookIndex,
                bookId: book._id.toString(),
                success: false,
                operation: 'read',
                error: (error as Error).message,
                time: Date.now() - iterationStartTime
              };
            }
          })(i, iteration)
        );
      }

      const iterationResults = await Promise.all(bookReadPromises);
      const iterationTime = Date.now() - iterationStartTime;

      console.log(`     Iteration ${iteration + 1} completed in ${iterationTime}ms`);
      readResults.push(...iterationResults);
    }

    const successfulReads = readResults.filter(r => r.success).length;
    const failedReads = readResults.filter(r => !r.success).length;
    const totalReadTime = readResults.length > 0 ? Math.max(...readResults.map(r => r.time)) : 0;

    console.log(`   Read results: ${successfulReads}/${readResults.length} successful`);
    console.log(`   Total read time: ${totalReadTime}ms`);
    console.log(`   Reads per second: ${(successfulReads / (totalReadTime / 1000)).toFixed(2)}`);

    // Test 2: Parallel book updates
    console.log('\n✏️  Test 2: Parallel book updates...');
    const updateResults: OperationResult[] = [];

    for (let iteration = 0; iteration < testIterations; iteration++) {
      console.log(`   Iteration ${iteration + 1}/${testIterations}...`);

      const iterationStartTime = Date.now();
      const bookUpdatePromises: Promise<OperationResult>[] = [];

      for (let i = 0; i < Math.min(3, maxBooksToTest); i++) { // Limit updates to avoid too many writes
        const book = sampleBooks[i % sampleBooks.length];

        bookUpdatePromises.push(
          (async (bookIndex, iteration) => {
            try {
              // Simulate updating a book
              const result = await db.collection<Book>('books').updateOne(
                { _id: book._id },
                { $set: {
                  lastAccessed: new Date(),
                  testMarker: `parallel_test_${iteration}_${bookIndex}`,
                  testTimestamp: Date.now()
                }}
              );

              await new Promise(resolve => setTimeout(resolve, Math.random() * 150)); // Simulate processing time

              return {
                iteration,
                bookIndex,
                bookId: book._id.toString(),
                success: result.matchedCount > 0,
                operation: 'update',
                time: Date.now() - iterationStartTime
              };
            } catch (error) {
              return {
                iteration,
                bookIndex,
                bookId: book._id.toString(),
                success: false,
                operation: 'update',
                error: (error as Error).message,
                time: Date.now() - iterationStartTime
              };
            }
          })(i, iteration)
        );
      }

      const iterationResults = await Promise.all(bookUpdatePromises);
      const iterationTime = Date.now() - iterationStartTime;

      console.log(`     Iteration ${iteration + 1} completed in ${iterationTime}ms`);
      updateResults.push(...iterationResults);
    }

    const successfulUpdates = updateResults.filter(r => r.success).length;
    const failedUpdates = updateResults.filter(r => !r.success).length;
    const totalUpdateTime = updateResults.length > 0 ? Math.max(...updateResults.map(r => r.time)) : 0;

    console.log(`   Update results: ${successfulUpdates}/${updateResults.length} successful`);
    console.log(`   Total update time: ${totalUpdateTime}ms`);
    console.log(`   Updates per second: ${(successfulUpdates / (totalUpdateTime / 1000)).toFixed(2)}`);

    // Test 3: Mixed operations (read and update in parallel)
    console.log('\n🔄 Test 3: Mixed parallel operations...');
    const mixedResults: OperationResult[] = [];

    for (let iteration = 0; iteration < testIterations; iteration++) {
      console.log(`   Iteration ${iteration + 1}/${testIterations}...`);

      const iterationStartTime = Date.now();
      const mixedPromises: Promise<OperationResult>[] = [];

      // Alternate between read and update operations
      for (let i = 0; i < maxBooksToTest; i++) {
        const book = sampleBooks[i % sampleBooks.length];

        if (i % 2 === 0) {
          // Read operation
          mixedPromises.push(
            (async (bookIndex, iteration) => {
              try {
                const result = await db.collection<Book>('books').findOne({ _id: book._id });
                await new Promise(resolve => setTimeout(resolve, Math.random() * 80));

                return {
                  iteration,
                  bookIndex,
                  bookId: book._id.toString(),
                  success: !!result,
                  operation: 'mixed-read',
                  time: Date.now() - iterationStartTime
                };
              } catch (error) {
                return {
                  iteration,
                  bookIndex,
                  bookId: book._id.toString(),
                  success: false,
                  operation: 'mixed-read',
                  error: (error as Error).message,
                  time: Date.now() - iterationStartTime
                };
              }
            })(i, iteration)
          );
        } else {
          // Update operation
          mixedPromises.push(
            (async (bookIndex, iteration) => {
              try {
                const result = await db.collection<Book>('books').updateOne(
                  { _id: book._id },
                  { $set: {
                    lastMixedAccess: new Date(),
                    mixedTestMarker: `mixed_test_${iteration}_${bookIndex}`
                  }}
                );
                await new Promise(resolve => setTimeout(resolve, Math.random() * 120));

                return {
                  iteration,
                  bookIndex,
                  bookId: book._id.toString(),
                  success: result.matchedCount > 0,
                  operation: 'mixed-update',
                  time: Date.now() - iterationStartTime
                };
              } catch (error) {
                return {
                  iteration,
                  bookIndex,
                  bookId: book._id.toString(),
                  success: false,
                  operation: 'mixed-update',
                  error: (error as Error).message,
                  time: Date.now() - iterationStartTime
                };
              }
            })(i, iteration)
          );
        }
      }

      const iterationResults = await Promise.all(mixedPromises);
      const iterationTime = Date.now() - iterationStartTime;

      console.log(`     Iteration ${iteration + 1} completed in ${iterationTime}ms`);
      mixedResults.push(...iterationResults);
    }

    const successfulMixed = mixedResults.filter(r => r.success).length;
    const failedMixed = mixedResults.filter(r => !r.success).length;
    const totalMixedTime = mixedResults.length > 0 ? Math.max(...mixedResults.map(r => r.time)) : 0;

    console.log(`   Mixed results: ${successfulMixed}/${mixedResults.length} successful`);
    console.log(`   Total mixed time: ${totalMixedTime}ms`);
    console.log(`   Mixed ops per second: ${(successfulMixed / (totalMixedTime / 1000)).toFixed(2)}`);

    // Memory and performance metrics
    console.log('\n📊 PERFORMANCE METRICS:');
    const memoryUsage = process.memoryUsage();
    console.log(`   Current heap usage: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Peak heap usage: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);

    // Summary
    console.log('\n📋 PARALLEL BOOK PROCESSING SUMMARY:');
    console.log(`   • Total operations: ${readResults.length + updateResults.length + mixedResults.length}`);
    console.log(`   • Successful operations: ${successfulReads + successfulUpdates + successfulMixed}`);
    console.log(`   • Failed operations: ${failedReads + failedUpdates + failedMixed}`);
    console.log(`   • Success rate: ${((successfulReads + successfulUpdates + successfulMixed) / (readResults.length + updateResults.length + mixedResults.length) * 100).toFixed(2)}%`);

    // Operation breakdown
    console.log(`\n   OPERATION BREAKDOWN:`);
    console.log(`   • Reads: ${successfulReads}/${readResults.length} (${(successfulReads/readResults.length*100).toFixed(1)}%)`);
    console.log(`   • Updates: ${successfulUpdates}/${updateResults.length} (${(successfulUpdates/updateResults.length*100).toFixed(1)}%)`);
    console.log(`   • Mixed: ${successfulMixed}/${mixedResults.length} (${(successfulMixed/mixedResults.length*100).toFixed(1)}%)`);

    // Performance assessment
    const overallSuccessRate = (successfulReads + successfulUpdates + successfulMixed) /
                              (readResults.length + updateResults.length + mixedResults.length);

    if (overallSuccessRate >= 0.95) {
      console.log(`\n   📈 Performance: ✅ Excellent - System handles parallel operations well`);
    } else if (overallSuccessRate >= 0.80) {
      console.log(`\n   📈 Performance: ⚠️  Good - Monitor under higher loads`);
    } else {
      console.log(`\n   📈 Performance: ❌ Needs attention - Investigate bottlenecks`);
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('   - Monitor database connection pool under parallel load');
    console.log('   - Consider implementing circuit breakers for API endpoints');
    console.log('   - Evaluate caching strategies for frequently accessed books');
    console.log('   - Monitor memory usage during peak parallel operations');
    console.log('   - Consider rate limiting for API endpoints');

    console.log('\n✅ Full book parallel processing test completed!');

  } catch (error) {
    log.error('💥 Error during full book parallel test:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the full book parallel test function
testFullBookParallel().catch(console.error);

export { testFullBookParallel };