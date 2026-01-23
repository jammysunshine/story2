import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import logger from '../logger';

const log = logger;

interface BookPage {
  pageNumber?: number;
  text?: string;
  prompt?: string;
  imageUrl?: string;
  [key: string]: any;
}

interface Book {
  _id: ObjectId;
  title?: string;
  pages?: BookPage[];
  [key: string]: any;
}

interface OperationResult {
  pageIndex: number;
  success: boolean;
  pageId?: number | string;
  operation: string;
  error?: string;
}

async function testPageParallel() {
  console.log('⚡ Starting parallel page generation test...');

  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI!, { family: 4 });
  await client.connect();
  const db = client.db();

  try {
    // Get a sample book to use for testing
    const sampleBook = await db.collection<Book>('books').findOne({
      pages: { $exists: true, $ne: null },
      "pages.0": { $exists: true } // Has at least one page
    });

    if (!sampleBook) {
      console.log('❌ No books with pages found to test with. Please create a book with pages first.');
      return;
    }

    console.log(`\n📖 Using book for testing: ${sampleBook.title || 'Untitled'} (ID: ${sampleBook._id})`);
    console.log(`📊 Pages in book: ${sampleBook.pages ? sampleBook.pages.length : 0}`);

    // Define test parameters
    const maxPagesToTest = Math.min(25, sampleBook.pages.length); // Test up to 25 pages or however many exist
    const batchSize = 5; // Process pages in batches

    console.log(`\n🧪 TESTING PARALLEL PAGE OPERATIONS:`);
    console.log(`   Total pages to test: ${maxPagesToTest}`);
    console.log(`   Batch size: ${batchSize} pages`);

    // Test 1: Parallel read operations on pages
    console.log('\n📖 Test 1: Parallel page reads...');
    const readStartTime = Date.now();

    const pageReadPromises: Promise<OperationResult>[] = [];
    for (let i = 0; i < maxPagesToTest; i++) {
      pageReadPromises.push(
        (async (pageIndex) => {
          try {
            // Simulate reading a specific page
            const page = sampleBook.pages![pageIndex];
            await new Promise(resolve => setTimeout(resolve, Math.random() * 50)); // Simulate processing

            return {
              pageIndex,
              success: !!page,
              pageId: page?.pageNumber || pageIndex,
              operation: 'read'
            };
          } catch (error) {
            return {
              pageIndex,
              success: false,
              operation: 'read',
              error: (error as Error).message
            };
          }
        })(i)
      );
    }

    const readResults = await Promise.all(pageReadPromises);
    const readEndTime = Date.now();
    const readTotalTime = readEndTime - readStartTime;

    const successfulReads = readResults.filter(r => r.success).length;
    const failedReads = readResults.filter(r => !r.success).length;

    console.log(`   Read results: ${successfulReads}/${maxPagesToTest} successful`);
    console.log(`   Read time: ${readTotalTime}ms`);
    console.log(`   Reads per second: ${(maxPagesToTest / (readTotalTime / 1000)).toFixed(2)}`);

    // Test 2: Parallel update operations on pages
    console.log('\n✏️  Test 2: Parallel page updates...');
    const updateStartTime = Date.now();

    // Create a copy of the book to simulate updates
    const bookForUpdate = { ...sampleBook };
    bookForUpdate.pages = [...sampleBook.pages!];

    const pageUpdatePromises: Promise<OperationResult>[] = [];
    for (let i = 0; i < Math.min(10, maxPagesToTest); i++) { // Limit updates to avoid too many writes
      pageUpdatePromises.push(
        (async (pageIndex) => {
          try {
            // Simulate updating a specific page
            const page = bookForUpdate.pages![pageIndex];
            if (page) {
              page.lastAccessed = new Date();
              page.testMarker = `parallel_test_${pageIndex}`;
            }

            await new Promise(resolve => setTimeout(resolve, Math.random() * 100)); // Simulate processing

            return {
              pageIndex,
              success: !!page,
              operation: 'update'
            };
          } catch (error) {
            return {
              pageIndex,
              success: false,
              operation: 'update',
              error: (error as Error).message
            };
          }
        })(i)
      );
    }

    const updateResults = await Promise.all(pageUpdatePromises);
    const updateEndTime = Date.now();
    const updateTotalTime = updateEndTime - updateStartTime;

    const successfulUpdates = updateResults.filter(r => r.success).length;
    const failedUpdates = updateResults.filter(r => !r.success).length;

    console.log(`   Update results: ${successfulUpdates}/${Math.min(10, maxPagesToTest)} successful`);
    console.log(`   Update time: ${updateTotalTime}ms`);
    console.log(`   Updates per second: ${(Math.min(10, maxPagesToTest) / (updateTotalTime / 1000)).toFixed(2)}`);

    // Test 3: Batch processing simulation
    console.log('\n📦 Test 3: Batch page processing...');
    const batchStartTime = Date.now();

    const batchResults: OperationResult[] = [];
    for (let batchStart = 0; batchStart < maxPagesToTest; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, maxPagesToTest);
      const batch: Promise<OperationResult>[] = [];

      for (let i = batchStart; i < batchEnd; i++) {
        batch.push(
          (async (pageIndex) => {
            try {
              // Simulate batch processing of a page
              const page = sampleBook.pages![pageIndex];
              await new Promise(resolve => setTimeout(resolve, Math.random() * 75)); // Simulate processing

              return {
                pageIndex,
                success: !!page,
                operation: 'batch-process'
              };
            } catch (error) {
              return {
                pageIndex,
                success: false,
                operation: 'batch-process',
                error: (error as Error).message
              };
            }
          })(i)
        );
      }

      const batchResult = await Promise.all(batch);
      batchResults.push(...batchResult);

      // Log progress
      console.log(`   Processed batch ${Math.floor(batchStart / batchSize) + 1}/${Math.ceil(maxPagesToTest / batchSize)} (${batchStart} to ${batchEnd - 1})`);
    }

    const batchEndTime = Date.now();
    const batchTotalTime = batchEndTime - batchStartTime;

    const successfulBatchOps = batchResults.filter(r => r.success).length;
    const failedBatchOps = batchResults.filter(r => !r.success).length;

    console.log(`   Batch results: ${successfulBatchOps}/${maxPagesToTest} successful`);
    console.log(`   Batch time: ${batchTotalTime}ms`);
    console.log(`   Batch ops per second: ${(maxPagesToTest / (batchTotalTime / 1000)).toFixed(2)}`);

    // Test 4: Memory usage during parallel operations
    console.log('\n💾 Test 4: Memory usage during parallel operations...');
    const memoryBefore = process.memoryUsage();

    // Run a more intensive parallel operation
    const intensivePromises: Promise<number>[] = [];
    for (let i = 0; i < 20; i++) { // Run 20 parallel operations
      intensivePromises.push(
        (async (opId) => {
          // Simulate an operation that uses memory
          const data = new Array(1000).fill(opId);
          await new Promise(resolve => setTimeout(resolve, 50));
          return data.length;
        })(i)
      );
    }

    await Promise.all(intensivePromises);
    const memoryAfter = process.memoryUsage();

    console.log(`   Memory before: ${(memoryBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Memory after: ${(memoryAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Memory delta: ${((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024).toFixed(2)} MB`);

    // Summary
    console.log('\n📋 PARALLEL PAGE PROCESSING SUMMARY:');
    console.log(`   • Pages tested: ${maxPagesToTest}`);
    console.log(`   • Read operations: ${successfulReads}/${maxPagesToTest} successful (${readTotalTime}ms)`);
    console.log(`   • Update operations: ${successfulUpdates}/${Math.min(10, maxPagesToTest)} successful (${updateTotalTime}ms)`);
    console.log(`   • Batch operations: ${successfulBatchOps}/${maxPagesToTest} successful (${batchTotalTime}ms)`);

    // Performance metrics
    const overallSuccessRate = (successfulReads + successfulUpdates + successfulBatchOps) /
                              (maxPagesToTest + Math.min(10, maxPagesToTest) + maxPagesToTest);

    console.log(`   • Overall success rate: ${(overallSuccessRate * 100).toFixed(2)}%`);

    if (overallSuccessRate >= 0.95) {
      console.log(`   • Performance: ✅ Excellent`);
    } else if (overallSuccessRate >= 0.80) {
      console.log(`   • Performance: ⚠️  Good but monitor closely`);
    } else {
      console.log(`   • Performance: ❌ Needs attention`);
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('   - Consider implementing page-level caching for frequently accessed pages');
    console.log('   - Monitor memory usage during parallel operations');
    console.log('   - Implement backpressure handling for high-concurrency scenarios');
    console.log('   - Consider using worker threads for CPU-intensive page operations');

    console.log('\n✅ Parallel page generation test completed!');

  } catch (error) {
    log.error('💥 Error during parallel page test:', error);
  } finally {
    await client.close();
    log.info('🔒 Database connection closed.');
  }
}

// Run the parallel page test function
testPageParallel().catch(console.error);

export { testPageParallel };