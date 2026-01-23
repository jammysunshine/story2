const puppeteer = require('puppeteer');
const { Storage } = require('@google-cloud/storage');
const { ObjectId } = require('mongodb');
const { PDFDocument, rgb } = require('pdf-lib');
const crypto = require('crypto');
const logger = require('./logger');

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
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
        logger.error(`❌ [PDF TRACE] MISSING IMAGE: P${page.pageNumber} at path: ${fileName}`);
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

  const chromePath = process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/chromium';

  logger.info(`🔧 Using Chrome executable: ${chromePath}`);
  logger.info(`🔧 Platform detected: ${process.platform}`);

  logger.info('🚀 [PDF TRACE] Attempting to launch Chromium browser...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--no-zygote', '--single-process', '--no-first-run',
      '--disable-extensions', '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
      '--disable-web-security', `--user-data-dir=/tmp/chrome-${crypto.randomUUID()}`,
    ],
  });

  try {
    logger.info('✅ [PDF TRACE] Browser launched successfully');
    const page = await browser.newPage();

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
    const baseUrl = process.env.APP_URL || 'http://localhost:5173';
    const storyPageCount = book.pages.length;
    const totalActualPages = storyPageCount + 1; // +1 for the Title Page rendered first in PrintTemplate.tsx
    const GELATO_MIN_PAGES = parseInt(process.env.PRINT_MIN_PAGES || '28');

    logger.info('🚀 [PDF TRACE] Loading full template (Single DB Hit)...');
    const fullTemplateUrl = `${baseUrl}/print/template/${bookId}`;

    await page.goto(fullTemplateUrl, {
      waitUntil: 'networkidle0',
      timeout: 120000
    });

    // WAIT FOR REACT TO RENDER DATA
    await page.waitForSelector('.page', { timeout: 60000 });

    logger.info('⏳ Waiting for all images to load in browser...');
    const imageStatus = await page.evaluate(async () => {
      const images = Array.from(document.querySelectorAll('img'));
      const results = await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve({ src: img.src, status: 'already_complete' });
        return new Promise(resolve => {
          img.onload = () => resolve({ src: img.src, status: 'loaded' });
          img.onerror = () => resolve({ src: img.src, status: 'error' });
        });
      }));
      return results;
    });

    const failedImages = imageStatus.filter((s) => s.status === 'error');
    if (failedImages.length > 0) {
      logger.warn(`⚠️ ${failedImages.length} images failed to load in Puppeteer!`);
    } else {
      logger.info('✅ All images loaded successfully in browser.');
    }

    logger.info(`📖 Capturing ${totalActualPages} total pages (Title + ${storyPageCount} story parts)...`);

    for (let i = 0; i < totalActualPages; i++) {
      logger.info(`📄 Slicing page ${i + 1}/${totalActualPages}...`);

      const pageInfo = await page.evaluate(async (index) => {
        const pages = document.querySelectorAll('.page');
        let currentImgInfo = { src: 'none', visible: false, complete: false, decoded: false, width: 0 };

        for (let idx = 0; idx < pages.length; idx++) {
          const p = pages[idx];
          if (idx === index) {
            p.style.display = 'block';
            const img = p.querySelector('img');
            if (img) {
              try {
                if (img.src && img.src !== 'none') {
                  // WAIT FOR IMAGE TO FINISH DECODING PIXELS
                  await img.decode();
                  currentImgInfo.decoded = true;
                }
              } catch (e) {
                currentImgInfo.decoded = false;
                console.error(`IMAGE DECODE FAILED for ${img.src}:`, e.message);
              }
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

      await sleep(500);

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
    logger.error('❌ [PDF TRACE] FATAL ERROR:', error);
    throw error;
  }
}

module.exports = { generatePdf, get7DaySignedUrl };
