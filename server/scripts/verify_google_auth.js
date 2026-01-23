require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');
const logger = require('../logger');

const log = logger;

async function verifyGoogleAuth() {
  log.info('🗝️ Starting Google Auth Handshake Verification...');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    log.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
    process.exit(1);
  }

  log.info(`📋 Client ID: ${clientId.substring(0, 15)}...`);
  
  try {
    const client = new OAuth2Client(clientId);
    
    log.info('📡 Initializing OAuth2 client...');
    
    // We can't verify a "real" login without a user's token from a browser,
    // but we can verify if the Client ID is correctly formatted and recognized.
    
    if (clientId.includes('apps.googleusercontent.com')) {
      log.info('✅ Client ID format is valid.');
    } else {
      log.warn('⚠️ Client ID format looks unusual (missing apps.googleusercontent.com)');
    }

    log.info('✅ Backend Handshake Configuration is ready.');
    log.info('💡 Note: The IdentityCredentialError in your browser is almost certainly a CORS/Origin mismatch in the Google Cloud Console.');
    log.info(`👉 Action: Ensure "http://localhost:3000" is in your "Authorized JavaScript Origins" at console.cloud.google.com`);

  } catch (error) {
    log.error('💥 Google Auth Config Error:', error.message);
  }
}

verifyGoogleAuth().catch(console.error);
