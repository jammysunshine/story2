const puppeteer = require('puppeteer');
const { Storage } = require('@google-cloud/storage');
const { ObjectId } = require('mongodb');
const { PDFDocument, rgb } = require('pdf-lib');
const crypto = require('crypto');
const logger = require('./logger');

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  ...(process.env.GOOGLE_APPLICATION_CREDENTIALS ? { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS } : {})
});
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function get7DaySignedUrl(pdfUrl) {
  if (!pdfUrl || !pdfUrl.includes('storage.googleapis.com')) return pdfUrl;
  try {
    const bucketName = process.env.GCS_PDFS_BUCKET_NAME;
    const url = new URL(pdfUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts[0] === bucketName) pathParts.shift();
    const filePath = pathParts.join('/');

    const [signedUrl] = await storage.bucket(bucketName).file(filePath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    return signedUrl;
  } catch (e) {
    return pdfUrl;
  }
}

async function generatePdf(db, bookId) {
  logger.info('🚀 [PDF TRACE] Starting generation process', { bookId });

  logger.info('🚀 [PDF TRACE] Connected to DB, fetching book details');
  const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });

  if (!book) {
    throw new Error('Book not found');
  }

  const projectId = process.env.GCP_PROJECT_ID;
  logger.info(`🔍 [PDF_GEN_DEBUG] Project ID: "${projectId}"`);
  const imagesBucketName = process.env.GCS_IMAGES_BUCKET_NAME;
  const imagesBucket = storage.bucket(imagesBucketName);

  const expectedImages = book.pages.length;
  let allImagesReady = false;
  const maxWaitTime = (expectedImages / 2) * 120000; // Allow 1 min per image on average
  const pollInterval = 30000;
  let waited = 0;

  while (waited < maxWaitTime) {
    let readyCount = 0;
    logger.info(`📡 Checking GCS for ${expectedImages} images (Waited ${waited / 1000}s)...`);

    for (const page of book.pages) {
      // DYNAMIC PATH RESOLUTION
      let fileName = '';
      const photoUrl = page.imageUrl || page.url || '';

      if (photoUrl.includes('storage.googleapis.com')) {
        const parts = photoUrl.split('storage.googleapis.com/')[1];
        let internalPath = parts ? parts.split('?')[0] : '';
        if (internalPath.startsWith(`${imagesBucketName}/`)) {
          fileName = internalPath.replace(`${imagesBucketName}/`, '');
        } else {
          fileName = internalPath;
        }
      }

      if (!fileName) {
        // Fallback for newly initiated books without URLs yet
        if (page.pageNumber === 2) {
          // P2 is always Hero Photo/Ref
          fileName = page.type === 'photo' ? `books/${bookId}/hero_photo.png` : `books/${bookId}/hero_reference.png`;
        } else if (page.pageNumber === 3) {
          // P3 is always Hero Intro (uses hero ref)
          fileName = `books/${bookId}/hero_reference.png`;
        } else if (page.pageNumber === 4) {
          // P4 is always Animal Friend
          fileName = `books/${bookId}/animal_reference.png`;
        } else {
          // P5+ are standard story pages
          fileName = `books/${bookId}/page_${page.pageNumber}.png`;
        }
      }

      const [exists] = await imagesBucket.file(fileName).exists();
      if (exists) {
        readyCount++;
      } else {
        logger.error({ bookId, pageNumber: page.pageNumber, fileName }, '❌ [PDF TRACE] MISSING IMAGE');
      }
    }

    if (readyCount === expectedImages) {
      logger.info('✅ ALL IMAGES VERIFIED IN GCS. Proceeding to PDF generation.');
      allImagesReady = true;
      break;
    }

    logger.warn(`⏳ Only ${readyCount}/${expectedImages} images ready. Sleeping 30s...`);
    await sleep(pollInterval);
    waited += pollInterval;
  }

  if (!allImagesReady) {
    throw new Error('PDF Generation Aborted: Not all images were ready in time.');
  }

  const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/chromium');

  logger.info(`🔧 Using Chrome executable: ${chromePath}`);
  logger.info(`🔧 Platform detected: ${process.platform}`);

  // 10-second cooldown to let the server settle after image verification/webhook processing
  logger.info('⏳ [PDF TRACE] Pre-launch cooldown (10s)...');
  await sleep(10000);

  let browser;
  let launchAttempts = 0;
  const MAX_LAUNCH_ATTEMPTS = 3;

  while (launchAttempts < MAX_LAUNCH_ATTEMPTS) {
    try {
      launchAttempts++;
      logger.info(`🚀 [PDF TRACE] Attempting to launch Chromium browser (Attempt ${launchAttempts}/${MAX_LAUNCH_ATTEMPTS})...`);
      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: 'new',
        timeout: 120000,
        dumpio: true,
        args: [
          '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
          '--disable-gpu', '--no-zygote', '--no-first-run',
          '--disable-crash-reporter',
          '--disable-dbus',
          '--disable-dev-conflicts',
          '--disable-speech-api',
          '--disable-sync',
          '--disable-extensions', '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
          '--disable-web-security', `--user-data-dir=/tmp/chrome-${crypto.randomUUID()}`,
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-ipc-flooding-protection',
          '--disable-background-networking',
          '--disable-gcm',
          '--disable-variations-service',
          '--disable-default-apps',
          '--disable-sync',
          '--metrics-recording-only',
          '--password-store=basic',
          '--use-mock-keychain',
          '--mute-audio',
          '--disable-background-timer-throttling',
          '--disable-client-side-phishing-detection',
          '--disable-component-extensions-with-background-pages',
          '--disable-hang-monitor',
          '--js-flags="--max-old-space-size=512"'
        ],
      });
      break; // Success!
    } catch (launchError) {
      logger.error({ err: launchError, attempt: launchAttempts }, '❌ [PDF TRACE] Browser launch failed');
      if (launchAttempts >= MAX_LAUNCH_ATTEMPTS) throw launchError;
      logger.info(`⏳ Waiting 5s before retrying launch...`);
      await sleep(5000);
    }
  }

  try {
    logger.info('✅ [PDF TRACE] Browser launched successfully');
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000);

    page.on('requestfailed', request => {
      logger.warn(`❌ [PDF RESOURCE FAIL] ${request.url()} - ${request.failure()?.errorText}`);
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        logger.warn(`❌ [PDF RESOURCE 404] ${response.status()} - ${response.url()}`);
      }
    });

    page.on('console', (msg) => logger.info('PAGE CONSOLE:', msg.text()));

    await page.setViewport({ width: 2400, height: 3300, deviceScaleFactor: 1 });

    const mergedPdf = await PDFDocument.create();
    
    // CONSISTENCY FIX: Use External Path (APP_URL) in GCloud to avoid loopback hangs.
    // We detect GCloud using the built-in K_SERVICE variable.
    const baseUrl = process.env.K_SERVICE 
      ? process.env.APP_URL 
      : `http://127.0.0.1:${process.env.PORT || 3001}`;
    
    logger.info(`🎯 [PDF_DEBUG] Using base URL for PDF generation: ${baseUrl} (Detected env: ${process.env.K_SERVICE ? 'GCloud' : 'Local'})`);

    const storyPageCount = book.pages.length;
    const totalActualPages = storyPageCount + 1; // +1 for the Title Page rendered first in PrintTemplate.tsx
    const GELATO_MIN_PAGES = parseInt(process.env.PRINT_MIN_PAGES || '28');

    const fullTemplateUrl = `${baseUrl}/print/template/${bookId}`;
    logger.info(`🎯 [PDF_DEBUG] Full template URL: ${fullTemplateUrl}`);
    logger.info('🚀 [PDF TRACE] Loading full template (Single DB Hit)...');

    logger.info(`🎯 [PDF_DEBUG] Attempting to navigate to: ${fullTemplateUrl}`);
    const response = await page.goto(fullTemplateUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });
    logger.info(`🎯 [PDF_DEBUG] Navigation completed, URL is now: ${page.url()}`);
    logger.info(`🎯 [PDF_DEBUG] HTTP Status: ${response.status()}, Status Text: ${response.statusText()}`);

    // Check if the page loaded correctly
    const htmlContent = await page.content();
    logger.info(`🎯 [PDF_DEBUG] Page HTML length: ${htmlContent.length}`);

    // Check if the element exists in the DOM
    const elementExists = await page.evaluate(() => {
      return document.querySelector('.page') !== null;
    });
    logger.info(`🎯 [PDF_DEBUG] Does .page element exist in DOM: ${elementExists}`);

    // WAIT FOR REACT TO RENDER DATA
    logger.info(`🎯 [PDF_DEBUG] Waiting for .page selector...`);
    await page.waitForSelector('.page', { timeout: 60000 });
    logger.info(`🎯 [PDF_DEBUG] Found .page selector successfully`);

    logger.info('⏳ Waiting for images to decode (15s limit per image)...');
    const bulkDecodeStatus = await page.evaluate(async () => {
      const images = Array.from(document.querySelectorAll('img'));
      const timeout = (ms) => new Promise(res => setTimeout(() => res('timed_out'), ms));
      
      const results = await Promise.allSettled(images.map(async img => {
        if (!img.src || img.src === 'none') return 'skipped';
        try {
          // Race the decode against a 15s timer
          const result = await Promise.race([
            img.decode(),
            timeout(15000)
          ]);
          return result === 'timed_out' ? 'timed_out' : 'decoded';
        } catch (e) {
          return 'failed';
        }
      }));
      return results.map(r => r.status === 'fulfilled' ? r.value : 'error');
    });

    const decodedCount = bulkDecodeStatus.filter(s => s === 'decoded').length;
    const timedOutCount = bulkDecodeStatus.filter(s => s === 'timed_out').length;
    const failedCount = bulkDecodeStatus.filter(s => s === 'failed' || s === 'error').length;
    
    logger.info(`📊 Image Decode Stats: Decoded=${decodedCount}, TimedOut=${timedOutCount}, Failed=${failedCount}`);
    
    if (timedOutCount > 0 || failedCount > 0) {
      logger.warn(`⚠️ Some images failed to decode in time, proceeding anyway...`);
    } else {
      logger.info('✅ All images decoded successfully.');
    }

    logger.info(`📖 Capturing ${totalActualPages} total pages (Title + ${storyPageCount} story parts)...`);

    for (let i = 0; i < totalActualPages; i++) {
      logger.info(`📄 Slicing page ${i + 1}/${totalActualPages}...`);

      const pageInfo = await page.evaluate(async (index) => {
        const pages = document.querySelectorAll('.page');
        let currentImgInfo = { src: 'none', visible: false, complete: false, decoded: true, width: 0 };

        for (let idx = 0; idx < pages.length; idx++) {
          const p = pages[idx];
          if (idx === index) {
            p.style.display = 'block';
            const img = p.querySelector('img');
            if (img) {
              currentImgInfo.src = img.src.substring(0, 100) + '...';
              currentImgInfo.visible = img.offsetParent !== null;
              currentImgInfo.complete = img.complete;
              currentImgInfo.width = img.naturalWidth;
            }
          } else {
            p.style.display = 'none';
          }
        }
        return { totalInDom: pages.length, img: currentImgInfo };
      }, i);

      logger.info(`🎯 Slice ${i + 1} Diagnostic:`, pageInfo);

      // images are pre-decoded
      await sleep(50);

      const pagePdfBuffer = await page.pdf({
        width: '8in', height: '11in', printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      });

      const pagePdfDoc = await PDFDocument.load(pagePdfBuffer);
      const [copiedPage] = await mergedPdf.copyPages(pagePdfDoc, [0]);
      mergedPdf.addPage(copiedPage);
    }

    if (mergedPdf.getPageCount() < GELATO_MIN_PAGES) {
      const fillerNeeded = GELATO_MIN_PAGES - mergedPdf.getPageCount();
      logger.info(`补充 [PDF TRACE] Adding ${fillerNeeded} filler pages to meet Gelato 28-page minimum.`);

      const parchmentColor = rgb(1.0, 0.996, 0.961); // Matches #FFFEF5

      for (let f = 0; f < fillerNeeded; f++) {
        const fillerPage = mergedPdf.addPage([576, 792]);
        fillerPage.drawRectangle({
          x: 0, y: 0, width: 576, height: 792, color: parchmentColor,
        });
      }
    }
    const finalPageCount = mergedPdf.getPageCount();

    logger.info('🚀 [PDF TRACE] Merging and saving final PDF...', { finalPageCount });
    const pdfBytes = await mergedPdf.save();

    await browser.close();

    logger.info('🚀 [PDF TRACE] Uploading PDF to GCS...');
    const pdfBucket = storage.bucket(process.env.GCS_PDFS_BUCKET_NAME);
    const fileName = `pdfs/${bookId}.pdf`;
    const file = pdfBucket.file(fileName);

    await file.save(Buffer.from(pdfBytes), {
      metadata: { contentType: 'application/pdf' }
    });

    const pdfUrl = `https://storage.googleapis.com/${process.env.GCS_PDFS_BUCKET_NAME}/${fileName}`;

    await db.collection('books').updateOne(
      { _id: new ObjectId(bookId) },
      { $set: { finalPageCount, pdfUrl, status: 'pdf_ready', updatedAt: new Date() } }
    );

    logger.info('🎉 [PDF TRACE] FULFILLMENT COMPLETE', { bookId, pdfUrl, finalPageCount });

    return pdfUrl;
  } catch (error) {
    if (browser) await browser.close();
    logger.error({ err: error, bookId }, '❌ [PDF TRACE] FATAL ERROR');
    throw error;
  }
}

module.exports = { generatePdf, get7DaySignedUrl };
