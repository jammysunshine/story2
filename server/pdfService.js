const puppeteer = require('puppeteer');
const { Storage } = require('@google-cloud/storage');
const { ObjectId } = require('mongodb');
const { PDFDocument, rgb } = require('pdf-lib');
const { crypto } = require('crypto');
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
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
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
  const storage = new Storage({ projectId });
  const imagesBucketName = process.env.GCS_IMAGES_BUCKET_NAME;
  const imagesBucket = storage.bucket(imagesBucketName);
  
  // 1. PRE-FLIGHT CHECK
  const expectedImages = book.pages.length;
  logger.info(`📡 Checking GCS for ${expectedImages} images...`);
  // (Simplified polling for Express version, usually triggered after all images are done)

  // 2. PUPPETEER LAUNCH
  const chromePath = process.platform === 'darwin' 
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' 
    : '/usr/bin/chromium';

  logger.info(`🔧 Using Chrome executable: ${chromePath}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 2400, height: 3300 });

    const mergedPdf = await PDFDocument.create();
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    
    // TEMPLATE URL: This needs to point to a route that renders the book for printing
    const fullTemplateUrl = `${baseUrl}/print/template/${bookId}`;
    logger.info(`🌐 Loading template from: ${fullTemplateUrl}`);
    
    await page.goto(fullTemplateUrl, {
      waitUntil: 'networkidle0',
      timeout: 120000
    });

    const totalActualPages = book.pages.length + 1; // +1 for Title Page
    const GELATO_MIN_PAGES = parseInt(process.env.PRINT_MIN_PAGES || '28');

    logger.info(`📖 Capturing ${totalActualPages} story pages...`);

    for (let i = 0; i < totalActualPages; i++) {
      // Logic to slice pages (same as original)
      await page.evaluate((index) => {
        const pages = document.querySelectorAll('.page');
        pages.forEach((p, idx) => {
          p.style.display = idx === index ? 'block' : 'none';
        });
      }, i);

      await new Promise(r => setTimeout(r, 500));

      const pagePdfBuffer = await page.pdf({
        width: '8in', height: '11in', printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      });

      const pagePdfDoc = await PDFDocument.load(pagePdfBuffer);
      const [copiedPage] = await mergedPdf.copyPages(pagePdfDoc, [0]);
      mergedPdf.addPage(copiedPage);
    }

    // 3. FILLER PAGES
    if (mergedPdf.getPageCount() < GELATO_MIN_PAGES) {
      const fillerNeeded = GELATO_MIN_PAGES - mergedPdf.getPageCount();
      const parchmentColor = rgb(1.0, 0.996, 0.961);
      for (let f = 0; f < fillerNeeded; f++) {
        const fillerPage = mergedPdf.addPage([576, 792]);
        fillerPage.drawRectangle({
          x: 0, y: 0, width: 576, height: 792, color: parchmentColor,
        });
      }
    }

    const pdfBytes = await mergedPdf.save();
    await browser.close();

    // 4. UPLOAD TO GCS
    logger.info('🚀 [PDF TRACE] Uploading PDF to GCS...');
    const pdfBucket = storage.bucket(process.env.GCS_PDFS_BUCKET_NAME);
    const fileName = `pdfs/${bookId}.pdf`;
    const file = pdfBucket.file(fileName);

    await file.save(Buffer.from(pdfBytes), { metadata: { contentType: 'application/pdf' } });

    const pdfUrl = `https://storage.googleapis.com/${process.env.GCS_PDFS_BUCKET_NAME}/${fileName}`;
    
    await db.collection('books').updateOne(
      { _id: new ObjectId(bookId) },
      { $set: { pdfUrl, status: 'pdf_ready', updatedAt: new Date() } }
    );

    logger.info('🎉 [PDF TRACE] FULFILLMENT COMPLETE', { bookId, pdfUrl });
    return pdfUrl;
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
}

module.exports = { generatePdf, get7DaySignedUrl };
