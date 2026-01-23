const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function diagnoseRateLimiting() {
  console.log('🔍 Diagnosing Gemini API Rate Limiting Issues...\n');
  
  // Check environment variables
  console.log('📋 Environment Variables Check:');
  console.log(`GOOGLE_API_KEY set: ${!!process.env.GOOGLE_API_KEY}`);
  console.log(`GOOGLE_API_KEY_P set: ${!!process.env.GOOGLE_API_KEY_P}`);
  console.log(`GOOGLE_API_KEY length: ${process.env.GOOGLE_API_KEY ? process.env.GOOGLE_API_KEY.length : 'N/A'}`);
  console.log(`GOOGLE_API_KEY_P length: ${process.env.GOOGLE_API_KEY_P ? process.env.GOOGLE_API_KEY_P.length : 'N/A'}`);
  console.log('');
  
  // Use the same key that story generation uses
  const apiKey = process.env.GOOGLE_API_KEY_P || process.env.GOOGLE_API_KEY;
  console.log(`🔑 Using API Key: ${apiKey ? apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4) : 'NOT SET'}`);
  console.log('');
  
  if (!apiKey) {
    console.error('❌ ERROR: No API key found! Please set either GOOGLE_API_KEY or GOOGLE_API_KEY_P in your .env file.');
    return;
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    generationConfig: {
      maxOutputTokens: 100, // Small response for testing
      temperature: 0.1,
      topP: 0.95,
    },
  });
  
  console.log('🧪 Running diagnostic tests...\n');
  
  // Test 1: Simple API call to check basic connectivity
  console.log('Test 1: Basic API Connectivity Test');
  try {
    const testPrompt = "Say 'API Test Successful' in 2 words.";
    const result = await model.generateContent(testPrompt);
    const response = await result.response;
    const text = response.text();
    console.log(`✅ Basic API Test: SUCCESS - Response: "${text}"`);
  } catch (error) {
    console.log(`❌ Basic API Test: FAILED - ${error.message}`);
    if (error.message.includes('429') || error.message.toLowerCase().includes('rate')) {
      console.log(`   Rate Limit Error Details: Status Code ${error.status || 'Unknown'}`);
    }
  }
  console.log('');
  
  // Test 2: Check if it's specifically the model that's rate limited
  console.log('Test 2: Model Availability Check');
  try {
    const models = genAI.getGenerativeModel({ model: "gemini-pro" });
    const testPrompt = "Respond with 'Model OK' in 2 words.";
    const result = await models.generateContent(testPrompt);
    const response = await result.response;
    const text = response.text();
    console.log(`✅ Model Availability Test: SUCCESS - Response: "${text}"`);
  } catch (error) {
    console.log(`❌ Model Availability Test: FAILED - ${error.message}`);
  }
  console.log('');
  
  // Test 3: Check headers for rate limit info
  console.log('Test 3: Detailed Response Headers Check');
  try {
    const testPrompt = "Respond with 'Headers Test' in 2 words.";
    const result = await model.generateContent(testPrompt);
    const response = result.response;
    
    console.log('Response Headers:');
    if (response.headers) {
      for (const [key, value] of Object.entries(response.headers)) {
        if (key.toLowerCase().includes('rate') || key.toLowerCase().includes('limit')) {
          console.log(`  🚨 RATE LIMIT HEADER: ${key} = ${value}`);
        } else {
          console.log(`  ${key} = ${value}`);
        }
      }
    } else {
      console.log('  No headers available in response');
    }
  } catch (error) {
    console.log(`❌ Headers Check: FAILED - ${error.message}`);
  }
  console.log('');
  
  // Test 4: Simulate story generation prompt structure (but simplified)
  console.log('Test 4: Story Generation Simulation');
  try {
    const storyPrompt = `Create a simple JSON response with a title and one page. 
    Return as JSON: {"title": "Test", "pages": [{"pageNumber": 1, "text": "Test page"}]}`;
    
    const result = await model.generateContent(storyPrompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean the response
    text = text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const jsonData = JSON.parse(text);
    
    console.log(`✅ Story Generation Simulation: SUCCESS - Parsed JSON with title: "${jsonData.title}"`);
  } catch (error) {
    console.log(`❌ Story Generation Simulation: FAILED - ${error.message}`);
    if (error.message.includes('429')) {
      console.log('   This confirms the rate limiting issue occurs during story generation');
    }
  }
  console.log('');
  
  // Test 5: Check if concurrent requests cause issues
  console.log('Test 5: Concurrency Stress Test (2 simultaneous requests)');
  try {
    const promises = [
      model.generateContent("Say 'Concurrent 1'"),
      model.generateContent("Say 'Concurrent 2'")
    ];
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`✅ Concurrency Test: ${successful} succeeded, ${failed} failed`);
    if (failed > 0) {
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.log(`   Request ${i+1} failed: ${r.reason.message}`);
        }
      });
    }
  } catch (error) {
    console.log(`❌ Concurrency Test: Unexpected error - ${error.message}`);
  }
  
  console.log('\n📋 Diagnostic Summary:');
  console.log('- Check if your API key has sufficient quota in Google Cloud Console');
  console.log('- Verify billing is enabled for your Google Cloud project');
  console.log('- Consider increasing delays between requests if hitting rate limits');
  console.log('- The rate limiting might be temporary; try again after a few minutes');
}

// Run the diagnostic
diagnoseRateLimiting().catch(console.error);