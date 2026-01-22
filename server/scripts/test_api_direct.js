require('dotenv').config();
const logger = require('../logger');

const log = logger;

async function testApiDirect() {
  console.log('📡 Testing API endpoints directly...');

  const baseUrl = process.env.APP_URL || 'http://localhost:3001';
  console.log(`🌐 Testing against: ${baseUrl}`);

  // Test endpoints to check
  const endpoints = [
    { method: 'GET', path: '/api/orders', desc: 'Get user orders' },
    { method: 'GET', path: '/api/book-status', desc: 'Get book status', params: '?bookId=123' },
    { method: 'POST', path: '/api/generate-story', desc: 'Generate story' },
    { method: 'POST', path: '/api/generate-images', desc: 'Generate images' },
    { method: 'POST', path: '/api/generate-pdf', desc: 'Generate PDF' },
    { method: 'POST', path: '/api/create-checkout', desc: 'Create checkout session' },
    { method: 'POST', path: '/api/upload', desc: 'Upload file' },
    { method: 'POST', path: '/api/auth/social', desc: 'Social auth' }
  ];

  console.log('\n🔍 Testing API endpoints...\n');

  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint.path}${endpoint.params || ''}`;
    console.log(`🧪 Testing: ${endpoint.method} ${endpoint.path} - ${endpoint.desc}`);

    try {
      // Prepare request options based on method
      const options = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      // For POST requests, add minimal body
      if (endpoint.method === 'POST') {
        if (endpoint.path === '/api/generate-story') {
          options.body = JSON.stringify({
            childName: "Test",
            age: "5",
            gender: "Boy",
            animal: "Lion",
            characterStyle: "Disney-inspired 3D render"
          });
        } else if (endpoint.path === '/api/generate-images' || endpoint.path === '/api/generate-pdf') {
          options.body = JSON.stringify({ bookId: "123456789012345678901234" }); // Invalid ID for test
        } else if (endpoint.path === '/api/create-checkout') {
          options.body = JSON.stringify({ bookId: "123", bookTitle: "Test Book" });
        } else if (endpoint.path === '/api/auth/social') {
          options.body = JSON.stringify({ token: "fake-token", provider: "google" });
        } else {
          options.body = JSON.stringify({}); // Empty body for other POSTs
        }
      }

      const startTime = Date.now();
      const response = await fetch(url, options);
      const responseTime = Date.now() - startTime;
      const responseBody = await response.text();

      console.log(`   Status: ${response.status} ${response.statusText} (${responseTime}ms)`);
      
      // Check if it's a success or error
      if (response.ok) {
        console.log(`   Result: ✅ Success`);
      } else {
        console.log(`   Result: ❌ Error (${response.status})`);
      }
      
      // Show a snippet of the response
      const responseSnippet = responseBody.length > 100 ? 
        responseBody.substring(0, 100) + '...' : responseBody;
      console.log(`   Response: ${responseSnippet}`);
      
    } catch (error) {
      console.log(`   Result: ❌ Network Error - ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
  }

  // Test webhook endpoint separately (requires raw body)
  console.log(`🧪 Testing: POST /api/webhook - Stripe webhook`);
  try {
    const startTime = Date.now();
    // This will likely fail without proper signature, but that's expected
    const response = await fetch(`${baseUrl}/api/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'fake-signature'
      },
      body: JSON.stringify({ test: true })
    });
    const responseTime = Date.now() - startTime;
    
    console.log(`   Status: ${response.status} ${response.statusText} (${responseTime}ms)`);
    const responseBody = await response.text();
    const responseSnippet = responseBody.length > 100 ? 
      responseBody.substring(0, 100) + '...' : responseBody;
    console.log(`   Response: ${responseSnippet}`);
  } catch (error) {
    console.log(`   Result: ❌ Network Error - ${error.message}`);
  }

  // Test environment configuration
  console.log('\n🔧 Environment Configuration Check:');
  const requiredEnvVars = [
    'APP_URL',
    'MONGODB_URI',
    'GOOGLE_API_KEY',
    'STRIPE_SECRET_KEY',
    'GCS_IMAGES_BUCKET_NAME',
    'GCS_PDFS_BUCKET_NAME',
    'SMTP_USER',
    'SMTP_PASSWORD'
  ];
  
  for (const varName of requiredEnvVars) {
    const isSet = !!process.env[varName];
    console.log(`  ${varName}: ${isSet ? '✅ Set' : '❌ Missing'}`);
  }

  console.log('\n✅ Direct API testing completed!');
  console.log('\n💡 Notes:');
  console.log('  - Many endpoints will return errors with invalid data - this is expected');
  console.log('  - Focus on HTTP status codes and general connectivity');
  console.log('  - Check that CORS is properly configured for your domain');
}

// Run the test function
testApiDirect().catch(console.error);