// test_25_concurrency.ts
import { MongoClient } from 'mongodb';
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

async function testConcurrency() {
  console.log('🧪 Testing 25 concurrent image generations...');

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = "A beautiful landscape with mountains and a lake, digital art, highly detailed";
  
  const promises = Array.from({ length: 25 }, async (_, i) => {
    try {
      console.log(`🚀 Starting request ${i + 1}/25`);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      console.log(`✅ Request ${i + 1} completed successfully`);
      return response;
    } catch (error) {
      console.error(`❌ Request ${i + 1} failed:`, error);
      return null;
    }
  });

  const results = await Promise.all(promises);
  const successful = results.filter(r => r !== null).length;
  
  console.log(`\n📊 Results: ${successful}/25 requests succeeded`);
}

if (require.main === module) {
  testConcurrency().catch(console.error);
}

export { testConcurrency };