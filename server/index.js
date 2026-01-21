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
const { sendStoryEmail } = require('./mail');
const { generateImages } = require('./imageService');
const { generatePdf, get7DaySignedUrl } = require('./pdfService');
const logger = require('./logger');

dotenv.config();

const app = express();
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhook') next();
  else express.json({ limit: '10mb' })(req, res, next);
});
app.use(cors());

const port = process.env.PORT || 3001;
const TEASER_LIMIT = 7;

// Initialize Services
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const bucket = storage.bucket(process.env.GCS_IMAGES_BUCKET_NAME);
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
let db;

async function connectDB() {
  const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
  await client.connect();
  db = client.db('story-db-v2');
  logger.info('✅ Connected to MongoDB');
}

// --- SECURITY: SIGNED URLS ---

async function getSignedUrl(gcsPath) {
  if (!gcsPath) return null;
  const filePath = gcsPath.replace(`https://storage.googleapis.com/${process.env.GCS_IMAGES_BUCKET_NAME}/`, '');
  try {
    const [url] = await bucket.file(filePath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    });
    return url;
  } catch (e) {
    logger.error({ msg: 'Sign error', error: e.message });
    return gcsPath;
  }
}

async function uploadToGCS(buffer, fileName, contentType) {
  const file = bucket.file(fileName);
  await file.save(buffer, { metadata: { contentType, cacheControl: 'private, max-age=0' } });
  return `https://storage.googleapis.com/${process.env.GCS_IMAGES_BUCKET_NAME}/${fileName}`;
}

async function generateImageRace(prompt, bookId, pageNumber) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });
  try {
    logger.info(`🎨 Painting Page ${pageNumber} for Book ${bookId}`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!imagePart?.inlineData?.data) throw new Error("No image");
    
    const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const fileName = `books/${bookId}/page_${pageNumber}.png`;
    return await uploadToGCS(buffer, fileName, 'image/png');
  } catch (e) {
    logger.error(`❌ Page ${pageNumber} failed: ${e.message}`);
    return null;
  }
}

// --- API ENDPOINTS ---

app.post('/api/auth/social', async (req, res) => {
  const { token, provider } = req.body;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const user = await db.collection('users').findOneAndUpdate(
      { email: payload.email },
      { $set: { name: payload.name, lastLogin: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );
    logger.info(`👤 User Logged In: ${payload.email}`);
    res.json({ success: true, user: user.value || user });
  } catch (err) { 
    logger.error('Auth failure');
    res.status(401).json({ error: 'Auth failed' }); 
  }
});

app.post('/api/generate-story', async (req, res) => {
  try {
    const { childName, age, gender, skinTone, hairStyle, hairColor, animal, characterStyle, location, lesson, occasion, language, email } = req.body;
    
    logger.info('🎨 ========== STORY GENERATION STYLE OPTIONS ==========');
    logger.info(`👤 Child/Hero Name: ${childName}`);
    logger.info(`🚻 Gender: ${gender}`);
    logger.info(`🌍 Language: ${language || 'English'}`);
    logger.info(`🐾 Animal: ${animal}`);
    logger.info(`📚 Lesson: ${lesson || 'None'}`);
    logger.info(`🎉 Occasion: ${occasion || 'None'}`);
    logger.info(`📍 Location: ${location || 'None'}`);
    logger.info(`🎨 Character Style: ${characterStyle}`);
    logger.info('🎨 ====================================================');

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `Write a 23-page story for ${childName} and ${animal}. Style: ${characterStyle}. Return JSON { "title", "heroBible", "animalBible", "pages": [{ "pageNumber", "text", "prompt" }] }`;
    
    logger.info(`📖 Generating story with 23 pages`);
    logger.info('🌐 ========== GEMINI STORY PROMPT AUDIT ==========');
    logger.info(`📜 FULL PROMPT: ${prompt}`);
    logger.info('🌐 ===============================================');

    logger.info('Starting real Gemini API call for story generation');
    const result = await model.generateContent(prompt);
    logger.info('Gemini API response received');
    
    const responseText = (await result.response).text();
    const storyData = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, ''));
    
    logger.info('✅ ========== STORY GENERATED SUCCESSFULLY ==========');
    logger.info(`👶 Hero Bible: ${storyData.heroBible}`);
    logger.info(`🐾 Animal Bible: ${storyData.animalBible}`);
    
    storyData.pages?.forEach((page, index) => {
      logger.info(`📄 Page ${index + 1}: ${page.text.substring(0, 50)}...`);
      logger.info(`🎨 Prompt ${index + 1}: ${page.prompt.substring(0, 50)}...`);
    });

    const bookResult = await db.collection('books').insertOne({ ...storyData, childName, email, status: 'draft', createdAt: new Date() });
    logger.info('✅ Story generated and saved to database', { bookId: bookResult.insertedId });
    res.json({ success: true, bookId: bookResult.insertedId, ...storyData });
  } catch (error) { 
    logger.error({ msg: 'Story gen failed', error: error.message });
    res.status(500).json({ error: error.message }); 
  }
});

app.post('/api/generate-images', async (req, res) => {
  const { bookId } = req.body;
  res.json({ success: true, message: 'Painting started' });
  generateImages(db, bookId).catch(err => logger.error('Image gen failed:', err.message));
});

app.get('/api/orders', async (req, res) => {
  const { email } = req.query;
  try {
    const orders = await db.collection('orders').find({ email }).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, orders });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/book-status', async (req, res) => {
  const { bookId } = req.query;
  const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
  const securedPages = await Promise.all(book.pages.map(async p => ({ ...p, imageUrl: await getSignedUrl(p.imageUrl) })));
  res.json({ status: book.status, pages: securedPages, pdfUrl: await get7DaySignedUrl(book.pdfUrl) });
});

app.post('/api/generate-pdf', async (req, res) => {
  const { bookId } = req.body;
  try {
    const pdfUrl = await generatePdf(db, bookId);
    const signedUrl = await get7DaySignedUrl(pdfUrl);
    res.json({ success: true, pdfUrl: signedUrl });
  } catch (error) {
    logger.error('PDF generation failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookId = session.metadata.bookId;
    const email = session.customer_details.email;

    logger.info(`💰 Payment Received for Book ${bookId} from ${email}`);

    // 1. Create Order Record
    await db.collection('orders').insertOne({
      bookId: new ObjectId(bookId),
      email,
      amount: session.amount_total / 100,
      currency: session.currency,
      status: 'Printing',
      shippingAddress: session.shipping_details?.address || {},
      createdAt: new Date()
    });

    // 2. Update Book Status
    await db.collection('books').updateOne({ _id: new ObjectId(bookId) }, { $set: { status: 'paid' } });
    
    // 3. Trigger Background Tasks (Painting + PDF + Gelato)
    // ... logic would go here
  }
  res.json({ received: true });
});

app.post('/api/create-checkout', async (req, res) => {
  try {
    const { bookId, bookTitle } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      shipping_address_collection: { allowed_countries: ['AU', 'US', 'CA', 'GB'] },
      line_items: [{ price_data: { currency: 'aud', product_data: { name: `Hardcover: ${bookTitle}` }, unit_amount: 2500 }, quantity: 1 }],
      mode: 'payment',
      success_url: `${process.env.APP_URL}/success?bookId=${bookId}`,
      cancel_url: `${process.env.APP_URL}/`,
      metadata: { bookId }
    });
    res.json({ url: session.url });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(port, () => {
  logger.info(`🚀 Engine Server running at http://localhost:${port}`);
  connectDB().catch(console.error);
});
