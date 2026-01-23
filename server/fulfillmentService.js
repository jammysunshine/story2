const { Storage } = require('@google-cloud/storage');
const { ObjectId } = require('mongodb');
const logger = require('./logger');

async function triggerGelatoFulfillment(params) {
  const { bookId, pdfUrl, shippingAddress, db, orderReferenceId, currency = 'AUD' } = params;
  logger.info('🎯 [GELATO_V4] INITIATING FULFILLMENT', { bookId });

  const isTestMode = process.env.GELATO_TEST_MODE !== 'false';

  // FETCH BOOK TO GET PRECISE PAGE COUNT (with fillers)
  const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
  if (!book) throw new Error('Book not found for fulfillment');

  const accuratePageCount = book.finalPageCount || 28; // Fallback to 28 minimum

  // --- PRIVACY VAULT: Generate a 24-hour signed URL for Gelato ---
  let securePdfUrl = pdfUrl;
  if (pdfUrl.includes('storage.googleapis.com')) {
    try {
      const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
      const pdfBucketName = process.env.GCS_PDFS_BUCKET_NAME;

      let filePath = '';
      try {
        const url = new URL(pdfUrl);
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts[0] === pdfBucketName) {
          filePath = pathParts.slice(1).join('/');
        } else {
          filePath = pathParts.join('/');
        }
        filePath = filePath.split('?')[0];
      } catch (e) {
        if (pdfUrl.includes(`/${pdfBucketName}/`)) {
          filePath = pdfUrl.split(`/${pdfBucketName}/`)[1].split('?')[0];
        }
      }

      const [signedUrl] = await storage.bucket(pdfBucketName).file(filePath).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000,
      });
      securePdfUrl = signedUrl;
      logger.info('🔐 Generated 24h Signed URL for Gelato handoff');
    } catch (e) {
      logger.warn('⚠️ Failed to sign PDF URL for Gelato, using original', e.message);
    }
  }

  // --- STATE MAPPING: Convert full names to ISO codes for Gelato ---
  const stateMap = {
    'new south wales': 'NSW', 'victoria': 'VIC', 'queensland': 'QLD', 'western australia': 'WA',
    'south australia': 'SA', 'tasmania': 'TAS', 'australian capital territory': 'ACT', 'northern territory': 'NT',
    'california': 'CA', 'new york': 'NY', 'texas': 'TX', 'florida': 'FL', 'illinois': 'IL', 'pennsylvania': 'PA',
    'ohio': 'OH', 'georgia': 'GA', 'north carolina': 'NC', 'michigan': 'MI', 'ontario': 'ON', 'quebec': 'QC',
    'british columbia': 'BC', 'alberta': 'AB', 'manitoba': 'MB', 'saskatchewan': 'SK'
  };

  const rawState = (shippingAddress.state || '').toLowerCase().trim();
  const normalizedState = stateMap[rawState] || shippingAddress.state;

  const gelatoPayload = {
    orderType: isTestMode ? "draft" : "order",
    orderReferenceId: orderReferenceId || `${bookId}-physical`,
    customerReferenceId: shippingAddress.email,
    currency: currency.toUpperCase(),
    items: [
      {
        itemReferenceId: "item-1",
        productUid: "photobooks-hardcover_pf_210x280-mm-8x11-inch_pt_170-gsm-65lb-coated-silk_cl_4-4_ccl_4-4_bt_glued-left_ct_matt-lamination_prt_1-0_cpt_130-gsm-65-lb-cover-coated-silk_ver",
        files: [{ type: "default", url: securePdfUrl }],
        quantity: 1,
        pageCount: accuratePageCount
      }
    ],
    shipmentMethodUid: "standard",
    shippingAddress: {
      firstName: shippingAddress.firstName || 'Customer',
      lastName: shippingAddress.lastName || 'Recipient',
      addressLine1: shippingAddress.addressLine1 || 'No Address Provided',
      addressLine2: shippingAddress.addressLine2 || '',
      city: shippingAddress.city || 'Unknown City',
      postCode: shippingAddress.postCode || '0000',
      state: normalizedState || '',
      country: shippingAddress.country || 'AU',
      email: shippingAddress.email,
      phone: shippingAddress.phone || '0000000000' // Mandatory for Gelato
    }
  };

  logger.info(`📡 SENDING V4 REQUEST TO GELATO (Mode: ${isTestMode ? 'DRAFT' : 'PRODUCTION'})`, {
    orderRef: gelatoPayload.orderReferenceId
  });
  logger.info('📦 GELATO PAYLOAD AUDIT:', JSON.stringify(gelatoPayload, null, 2));

  try {
    // Log detailed request information before sending
    logger.debug('📤 DETAILED GELATO REQUEST:', {
      url: 'https://order.gelatoapis.com/v4/orders',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.GELATO_API_KEY ? '[HIDDEN]' : '[MISSING]'
      },
      body: JSON.stringify(gelatoPayload, null, 2)
    });

    const response = await fetch('https://order.gelatoapis.com/v4/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.GELATO_API_KEY || '',
      },
      body: JSON.stringify(gelatoPayload),
    });

    const result = await response.json();

    // Log detailed response information
    logger.debug('📥 DETAILED GELATO RESPONSE:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: JSON.stringify(result, null, 2)
    });

    logger.info('📥 GELATO RESPONSE RECEIVED:', JSON.stringify(result, null, 2));

    if (!response.ok) {
      logger.error('❌ GELATO V4 API ERROR:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: JSON.stringify(result)
      });
      throw new Error(`Gelato v4 error: ${response.status} - ${JSON.stringify(result)}`);
    }

    logger.info(`✅ Gelato order created: ${result.id}`);

    await db.collection('books').updateOne(
      { _id: new ObjectId(bookId) },
      {
        $set: {
          gelatoOrderId: result.id,
          gelatoOrderStatus: result.fulfillmentStatus,
          status: 'printing',
          updatedAt: new Date()
        }
      }
    );

    return result;
  } catch (error) {
    logger.error('❌ GELATO V4 FATAL ERROR:', {
      message: error.message,
      stack: error.stack,
      bookId: bookId
    });
    throw error;
  }
}

module.exports = { triggerGelatoFulfillment };
