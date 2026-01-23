require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('../logger');

async function testStripeIntegration() {
  logger.info('💳 Starting Stripe Integration Test...');

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    logger.error('❌ Missing STRIPE_SECRET_KEY in .env');
    process.exit(1);
  }

  logger.info(`📋 Stripe Key found (Starts with: ${stripeKey.substring(0, 7)}...)`);

  try {
    logger.info('📡 Attempting to create a real Stripe Checkout Session...');
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: process.env.BASE_CURRENCY || 'aud',
          product_data: {
            name: 'STRIPE_TEST_BOOK',
          },
          unit_amount: 2500, // $25.00
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'http://localhost:3000/success?bookId=test_id',
      cancel_url: 'http://localhost:3000/',
      metadata: { bookId: 'test_id' }
    });

    logger.info('✅ SUCCESS! Stripe Session Created.');
    logger.info(`🔗 Test Checkout URL: ${session.url}`);
    logger.info('💡 Note: You can click the link above to verify the hosted checkout page loads correctly.');

  } catch (error) {
    logger.error('💥 Stripe API Error:', error.message);
    if (error.message.includes('Invalid API Key')) {
      logger.error('👉 Action: Your STRIPE_SECRET_KEY is invalid. Please check your Stripe Dashboard.');
    }
  }
}

testStripeIntegration().catch(console.error);
