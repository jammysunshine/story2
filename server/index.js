const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const puppeteer = require('puppeteer');
const { MongoClient, ObjectId } = require('mongodb');
const Stripe = require('stripe');
const axios = require('axios');
const { Storage } = require('@google-cloud/storage');
const { OAuth2Client } = require('google-auth-library');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

dotenv.config();
// ... (existing code)

// --- UPLOAD ENDPOINT ---
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('No file uploaded');
    const fileName = `uploads/${Date.now()}_${req.file.originalname}`;
    const url = await uploadToGCS(req.file.buffer, fileName, req.file.mimetype);
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const app = express();
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhook') next();
  else express.json()(req, res, next);
});
app.use(cors());

const port = process.env.PORT || 3001;

// Initialize Services
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const bucket = storage.bucket(process.env.GCS_IMAGES_BUCKET_NAME);
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
let db;

async function connectDB() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db('story-db-v2');
  console.log('✅ Connected to MongoDB');
}

// --- PORTED CORE LOGIC ---

async function uploadToGCS(buffer, fileName, contentType) {
  const file = bucket.file(fileName);
  await file.save(buffer, { metadata: { contentType, cacheControl: 'public, max-age=31536000' } });
  return `https://storage.googleapis.com/${process.env.GCS_IMAGES_BUCKET_NAME}/${fileName}`;
}

/**
 * MEGA-RACE: Parallel image generation attempts
 */
async function generateImageRace(prompt, bookId, pageNumber, style) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });
  const RACE_CONCURRENCY = 3;
  const timeoutMs = 120000;

  console.log(`🚀 [Page ${pageNumber}] Starting Race (${RACE_CONCURRENCY} runners)...`);

  const runners = Array.from({ length: RACE_CONCURRENCY }).map(async (_, idx) => {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (imagePart?.inlineData?.data) return imagePart.inlineData.data;
      throw new Error("No image data");
    } catch (e) {
      throw e;
    }
  });

  try {
    const firstSuccessBase64 = await Promise.any(runners);
    const buffer = Buffer.from(firstSuccessBase64, 'base64');
    const fileName = `books/${bookId}/page_${pageNumber}.png`;
    return await uploadToGCS(buffer, fileName, 'image/png');
  } catch (e) {
    console.error(`❌ [Page ${pageNumber}] Race failed:`, e.message);
    return null;
  }
}

// --- API ENDPOINTS ---

app.post('/api/generate-story', async (req, res) => {
  try {
    const { childName, age, animal, characterStyle, location, lesson, occasion, language, email } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `You are a specialist children's book author. Write a 23-page story for ${childName} and their ${animal} friend. Style: ${characterStyle}. language: ${language || 'English'}. Return JSON: { "title", "heroBible", "animalBible", "pages": [{ "pageNumber", "text", "prompt" }] }`;
    
    const result = await model.generateContent(prompt);
    const storyData = JSON.parse((await result.response).text().replace(/```json/g, '').replace(/```/g, ''));
    
    const bookResult = await db.collection('books').insertOne({
      ...storyData, childName, age, animal, characterStyle, email, status: 'draft', createdAt: new Date()
    });
    res.json({ success: true, bookId: bookResult.insertedId, ...storyData });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/generate-images', async (req, res) => {
  const { bookId } = req.body;
  try {
    const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
    const updatedPages = [...book.pages];
    
    // 1. Generate Reference Images (Hero & Animal)
    const heroRef = await generateImageRace(`${book.heroBible}. Style: ${book.characterStyle}. Reference portrait.`, bookId, 'hero_ref', book.characterStyle);
    const animalRef = await generateImageRace(`${book.animalBible}. Style: ${book.characterStyle}. Reference portrait.`, bookId, 'animal_ref', book.characterStyle);

    // 2. Generate Story Pages
    for (let i = 0; i < updatedPages.length; i++) {
      const reinforcedPrompt = `Style: ${book.characterStyle}. ${book.heroBible}. ${book.animalBible}. Scene: ${updatedPages[i].prompt}`;
      const url = await generateImageRace(reinforcedPrompt, bookId, i + 1, book.characterStyle);
      if (url) {
        updatedPages[i].imageUrl = url;
        await db.collection('books').updateOne({ _id: new ObjectId(bookId) }, { $set: { [`pages.${i}.imageUrl`]: url } });
      }
    }
    res.json({ success: true, pages: updatedPages });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- THE MASTER PDF GENERATOR (PORTED FROM V1) ---
app.post('/api/generate-pdf', async (req, res) => {
  const { bookId } = req.body;
  let browser;
  try {
    const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
    browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    const htmlContent = `
      <html>
        <head>
          <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;800&display=swap" rel="stylesheet">
          <style>
            @page { size: 8in 11in; margin: 0; }
            body { margin: 0; padding: 0; font-family: 'EB Garamond', serif; background: white; width: 8in; }
            .page { width: 8in; height: 11in; position: relative; overflow: hidden; padding: 0.5in; page-break-after: always; background-color: #FFFEF5; }
            .page::before { content: ""; position: absolute; top: 0.4in; left: 0.4in; right: 0.4in; bottom: 0.3in; border: 1px solid #E5E7EB; border-radius: 0.25in; z-index: 1; }
            .title-page-content { height: 9.5in; width: 7in; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border: 4px double #E5E7EB; border-radius: 1in; z-index: 10; position: relative; }
            .story-page-text-area { height: 3.0in; width: 7in; display: flex; align-items: center; justify-content: center; text-align: center; padding: 0.2in; border: 1px solid #E5E7EB; border-radius: 1.5rem; z-index: 10; position: relative; margin-bottom: 0.1in; }
            .story-page-image-area { width: 7in; height: 7in; border-radius: 1.5rem; overflow: hidden; border: 10px solid white; box-shadow: 0 10px 30px rgba(0,0,0,0.1); z-index: 10; position: relative; }
            .inner-image { width: 100%; height: 100%; object-fit: cover; }
            .story-text { font-size: 36pt; line-height: 1.1; color: #111827; font-weight: 500; }
            .main-title { font-size: 60pt; font-weight: 900; margin-bottom: 0.5in; }
            .child-name-pop { color: #4F46E5; font-size: 48pt; font-weight: 900; }
            .footer-area { position: absolute; bottom: 0.12in; left: 0; right: 0; text-align: center; font-size: 8pt; color: #9CA3AF; z-index: 100; letter-spacing: 0.2em; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="title-page-content">
              <h1 class="main-title">${book.title}</h1>
              <p style="text-transform: uppercase; letter-spacing: 0.3em; color: #9CA3AF; font-size: 18pt;">Created for</p>
              <p class="child-name-pop">${book.childName}</p>
            </div>
            <div class="footer-area">TITLE PAGE</div>
          </div>
          ${book.pages.map(p => `
            <div class="page">
              <div class="story-page-text-area"><p class="story-text">${p.text}</p></div>
              <div class="story-page-image-area"><img src="${p.imageUrl}" class="inner-image" /></div>
              <div class="footer-area">PAGE ${p.pageNumber}</div>
            </div>
          `).join('')}
        </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    
    const pdfUrl = await uploadToGCS(pdfBuffer, `books/${bookId}/story.pdf`, 'application/pdf');
    await db.collection('books').updateOne({ _id: new ObjectId(bookId) }, { $set: { pdfUrl } });
    
    res.json({ success: true, pdfUrl });
  } catch (error) { res.status(500).json({ error: error.message }); }
  finally { if (browser) await browser.close(); }
});

app.listen(port, () => {
  console.log(`🚀 Master Engine running at http://localhost:${port}`);
  connectDB().catch(console.error);
});