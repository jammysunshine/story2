const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function listAvailableModels() {
  console.log('🔍 Listing Available Gemini Models...\n');
  
  const apiKey = process.env.GOOGLE_API_KEY_P || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('❌ No API key found!');
    return;
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    // Note: The Google Generative AI SDK doesn't have a direct method to list models
    // So we'll test a few known models to see which ones are available
    
    const testModels = [
      'gemini-1.5-pro',
      'gemini-1.5-flash', 
      'gemini-1.0-pro',
      'gemini-2.0-flash-exp',
      'gemini-pro-vision',
      'text-embedding-005',
      'embedding-001',
      'text-bison-32k',
      'chat-bison-32k'
    ];
    
    console.log('Testing model availability...\n');
    
    for (const modelName of testModels) {
      try {
        console.log(`Testing ${modelName}...`);
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            maxOutputTokens: 10,
            temperature: 0.1
          }
        });
        
        const result = await model.generateContent("Say 'test' in 1 word.");
        const response = await result.response;
        const text = response.text();
        console.log(`✅ ${modelName}: AVAILABLE - Response: "${text}"`);
      } catch (error) {
        if (error.message.includes('429')) {
          console.log(`⚠️  ${modelName}: RATE LIMITED - ${error.message}`);
        } else if (error.message.includes('404') || error.message.includes('not found')) {
          console.log(`❌ ${modelName}: NOT FOUND - ${error.message.split('.')[0]}`);
        } else {
          console.log(`❌ ${modelName}: ERROR - ${error.message.split('.')[0]}`);
        }
      }
      
      // Add delay between tests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
  } catch (error) {
    console.error('❌ Error listing models:', error.message);
  }
}

listAvailableModels();