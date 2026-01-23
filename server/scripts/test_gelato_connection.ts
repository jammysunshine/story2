import 'dotenv/config';
import logger from '../logger';

const log = logger;

interface GelatoPayload {
  orderType: string;
  orderReferenceId: string;
  customerReferenceId: string;
  currency: string;
  items: Array<{
    itemReferenceId: string;
    productUid: string;
    files: Array<{ type: string; url: string }>;
    quantity: number;
    pageCount: number;
  }>;
  shipmentMethodUid: string;
  shippingAddress: {
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    postCode: string;
    state: string;
    country: string;
    email: string;
  };
}

interface GelatoResponse {
  id?: string;
  fulfillmentStatus?: string;
  [key: string]: any;
}

async function testGelatoV4() {
  console.log('🧪 Testing Gelato API Connection (DRAFT MODE FOR SAFETY)...');

  const apiKey = process.env.GELATO_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: GELATO_API_KEY is missing in .env');
    return;
  }

  // Test payload for Gelato API v4 (using draft mode to avoid charges)
  const gelatoPayload: GelatoPayload = {
    orderType: "draft", // Using draft mode for testing
    orderReferenceId: `test-${Date.now()}`,
    customerReferenceId: 'test@example.com',
    currency: 'USD',
    items: [
      {
        itemReferenceId: "item-1",
        productUid: "photobooks-hardcover_pf_210x280-mm-8x11-inch_pt_170-gsm-65lb-coated-silk_cl_4-4_ccl_4-4_bt_glued-left_ct_matt-lamination_prt_1-0_cpt_130-gsm-65-lb-cover-coated-silk_ver",
        files: [{ type: "default", url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" }],
        quantity: 1,
        pageCount: 28
      }
    ],

    shipmentMethodUid: "standard",
    shippingAddress: {
      firstName: "Test",
      lastName: "User",
      addressLine1: "123 Test Street",
      addressLine2: "",
      city: "Test City",
      postCode: "12345",
      state: "TS",
      country: "US",
      email: "test@example.com"
    }
  };

  console.log('📦 Gelato Payload prepared for testing:', JSON.stringify(gelatoPayload, null, 2));

  try {
    const endpoint = 'https://order.gelatoapis.com/v4/orders';
    console.log(`📡 Sending request to: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify(gelatoPayload),
    });

    const result: GelatoResponse = await response.json();
    console.log('📥 Gelato API Response:', JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('✅ SUCCESS: Gelato created a safe DRAFT order!');
      console.log('Gelato Draft ID:', result.id);
      console.log('Fulfillment Status:', result.fulfillmentStatus);
      console.log('⚠️ Note: This was a DRAFT order (no charges applied)');
    } else {
      console.error('❌ FAILURE: Gelato rejected the request');
      console.error('Status:', response.status);
      console.error('Error details:', result);
    }
  } catch (error) {
    console.error('💥 Error connecting to Gelato API:', (error as Error).message);
    log.error('Gelato connection test error:', error);
  }
}

// Run the test function
testGelatoV4().catch(console.error);

export { testGelatoV4 };