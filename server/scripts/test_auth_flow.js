require('dotenv').config();
const axios = require('axios');
const logger = require('../logger');

const log = logger;
const API_URL = 'http://localhost:3001/api';

async function testAuthFlow() {
  log.info('🧪 Starting Auth Flow Simulation...');

  // TEST 1: Check if the backend is even alive
  try {
    const health = await axios.get(`${API_URL.replace('/api', '')}/health`);
    log.info('✅ Backend is alive and healthy.');
  } catch (e) {
    log.error('❌ Backend is not responding. Did you run "node index.js"?');
    process.exit(1);
  }

  // TEST 2: Simulate a social login attempt
  // Note: We can't use a real token without a browser, 
  // but we can test if the endpoint is reachable and guarded.
  log.info('📡 Testing social auth endpoint accessibility...');
  try {
    const res = await axios.post(`${API_URL}/auth/social`, {
      token: 'mock_invalid_token',
      provider: 'google'
    });
    log.info('📥 Received response:', res.data);
  } catch (err) {
    if (err.response?.status === 500) {
      log.info('✅ Endpoint is reachable (Failed with 500 as expected because the token is fake).');
    } else {
      log.error('❌ Endpoint unreachable:', err.message);
    }
  }

  log.info('\n💡 Manual Verification Required:');
  log.info('1. Open your browser to http://localhost:3000');
  log.info('2. Open DevTools (F12)');
  log.info('3. Click "Login" or "Order"');
  log.info('4. Look for "🗝️ Attempting Google Sign-In (Web Engine)" in the logs.');
}

testAuthFlow().catch(console.error);
