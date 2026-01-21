const puppeteer = require('puppeteer');
const { Storage } = require('@google-cloud/storage');
const { ObjectId } = require('mongodb');
const { PDFDocument, rgb } = require('pdf-lib');
const crypto = require('crypto');
const logger = require('./logger');

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function get7DaySignedUrl(pdfUrl) {
  if (!pdfUrl || !pdfUrl.includes('storage.googleapis.com')) return pdfUrl;
  try {
    const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
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

  const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
  if (!book) throw new Error('Book not found');

  const projectId = process.env.GCP_PROJECT_ID;
  const imagesBucketName = process.env.GCS_IMAGES_BUCKET_NAME;
  const storage = new Storage({ projectId });
  const imagesBucket = storage.bucket(imagesBucketName);
  
  // 1. GCS PRE-FLIGHT CHECK (Line-for-line from story1)
  const expectedImages = book.pages.length;
  let allImagesReady = false;
  const maxWaitTime = (expectedImages / 10) * 120000; 
  const pollInterval = 30000;
  let waited = 0;

  while (waited < maxWaitTime) {
    let readyCount = 0;
    logger.info(`📡 Checking GCS for ${expectedImages} images (Waited ${waited/1000}s)...`);

    for (const page of book.pages) {
      let fileName = `books/${bookId}/page_${page.pageNumber}.png`;
      
      if (page.type === 'photo' || page.pageNumber === 1) {
        const photoUrl = page.url || page.imageUrl || '';
        if (photoUrl.includes('storage.googleapis.com')) {
          const parts = photoUrl.split('storage.googleapis.com/')[1];
          let internalPath = parts ? parts.split('?')[0] : '';
          if (internalPath.startsWith(`${imagesBucketName}/`)) {
            fileName = internalPath.replace(`${imagesBucketName}/`, '');
          } else {
            fileName = internalPath;
          }
        }
      } else if (page.pageNumber === 2 || page.pageNumber === 3) {
        const refType = page.pageNumber === 2 ? 'hero' : 'animal';
        fileName = `books/${bookId}/${refType}_reference.png`;
      }

      const [exists] = await imagesBucket.file(fileName).exists();
      if (exists) readyCount++;
      else logger.debug(`⏳ [PDF TRACE] Missing image for P${page.pageNumber}: ${fileName}`);
    }

    if (readyCount === expectedImages) {
      logger.info('✅ ALL IMAGES VERIFIED IN GCS. Proceeding to PDF generation.');
      allImagesReady = true;
      break;
    }

    logger.warn(`⏳ Only ${readyCount}/${expectedImages} images ready. Sleeping...`);
    await sleep(pollInterval);
    waited += pollInterval;
  }

  // 2. PUPPETEER LAUNCH
  const chromePath = process.platform === 'darwin' 
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' 
    : '/usr/bin/chromium';

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
    const page = await browser.newPage();
    
    // Exact diagnostic listeners
    page.on('requestfailed', request => logger.warn(`❌ [PDF RESOURCE FAIL] ${request.url()} - ${request.failure()?.errorText}`));
    page.on('response', response => { if (response.status() >= 400) logger.warn(`❌ [PDF RESOURCE 404] ${response.status()} - ${response.url()}`); });
    page.on('console', msg => logger.info('PAGE CONSOLE:', msg.text()));

    await page.setViewport({ width: 2400, height: 3300, deviceScaleFactor: 1 });

    const mergedPdf = await PDFDocument.create();
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const fullTemplateUrl = `${baseUrl}/print/template/${bookId}`;
    
    await page.goto(fullTemplateUrl, { waitUntil: 'networkidle0', timeout: 120000 });

    // Wait for all images to load
    await page.evaluate(async () => {
      const images = Array.from(document.querySelectorAll('img'));
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
      }));
    });

    const totalActualPages = book.pages.length + 1;
    const GELATO_MIN_PAGES = parseInt(process.env.PRINT_MIN_PAGES || '28');

    for (let i = 0; i < totalActualPages; i++) {
      logger.info(`📄 Slicing page ${i + 1}/${totalActualPages}...`);
      
      const pageInfo = await page.evaluate(async (index) => {
        const pages = document.querySelectorAll('.page');
        let currentImgInfo = { src: 'none', decoded: false };
        for (let idx = 0; idx < pages.length; idx++) {
          const p = pages[idx];
          if (idx === index) {
            p.style.display = 'block';
            const img = p.querySelector('img');
            if (img && img.src && img.src !== 'none') {
                try { await img.decode(); currentImgInfo.decoded = true; } catch (e) {}
                currentImgInfo.src = img.src.substring(0, 100);
            }
          } else {
            p.style.display = 'none';
          }
        }
        return { img: currentImgInfo };
      }, i);

      logger.info(`🎯 Slice ${i+1} Diagnostic:`, pageInfo);
      await sleep(500);

      const pagePdfBuffer = await page.pdf({
        width: '8in', height: '11in', printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      });

      const pagePdfDoc = await PDFDocument.load(pagePdfBuffer);
      const [copiedPage] = await mergedPdf.copyPages(pagePdfDoc, [0]);
      mergedPdf.addPage(copiedPage);
    }

    // Filler logic
    if (mergedPdf.getPageCount() < GELATO_MIN_PAGES) {
      const fillerNeeded = GELATO_MIN_PAGES - mergedPdf.getPageCount();
      const parchmentColor = rgb(1.0, 0.996, 0.961);
      for (let f = 0; f < fillerNeeded; f++) {
        const fillerPage = mergedPdf.addPage([576, 792]);
        fillerPage.drawRectangle({ x: 0, y: 0, width: 576, height: 792, color: parchmentColor });
      }
    }

    const finalPageCount = mergedPdf.getPageCount();
    const pdfBytes = await mergedPdf.save();
    await browser.close();

    const pdfBucket = storage.bucket(process.env.GCS_PDFS_BUCKET_NAME);
    const fileName = `pdfs/${bookId}.pdf`;
    await pdfBucket.file(fileName).save(Buffer.from(pdfBytes), { metadata: { contentType: 'application/pdf' } });

    const pdfUrl = `https://storage.googleapis.com/${process.env.GCS_PDFS_BUCKET_NAME}/${fileName}`;
    await db.collection('books').updateOne({ _id: new ObjectId(bookId) }, { $set: { finalPageCount, pdfUrl, status: 'pdf_ready', updatedAt: new Date() } });

    logger.info('🎉 [PDF TRACE] FULFILLMENT COMPLETE', { bookId, pdfUrl, finalPageCount });
    return pdfUrl;
  } catch (error) {
    if (browser) await browser.close();
    logger.error('❌ [PDF TRACE] FATAL ERROR:', error);
    throw error;
  }
}

module.exports = { generatePdf, get7DaySignedUrl };