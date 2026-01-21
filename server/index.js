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

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));
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
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db('story-db-v2');
  console.log('✅ Connected to MongoDB');
}

// --- SECURITY: SIGNED URLS ---

async function getSignedUrl(gcsPath) {
  if (!gcsPath) return null;
  const filePath = gcsPath.replace(`https://storage.googleapis.com/${process.env.GCS_IMAGES_BUCKET_NAME}/`, '');
  try {
    const [url] = await bucket.file(filePath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });
    return url;
  } catch (e) {
    console.error('Sign error:', e.message);
    return gcsPath;
  }
}

async function uploadToGCS(buffer, fileName, contentType) {
  const file = bucket.file(fileName);
  await file.save(buffer, { metadata: { contentType, cacheControl: 'private, max-age=0' } });
  return `https://storage.googleapis.com/${process.env.GCS_IMAGES_BUCKET_NAME}/${fileName}`;
}

// --- API ENDPOINTS ---

app.post('/api/generate-story', async (req, res) => {
  try {
    const { childName, age, gender, skinTone, hairStyle, hairColor, animal, characterStyle, location, lesson, occasion, language, email, photoUrl } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const prompt = `Write a 23-page children's book. 
    Hero: ${childName}, ${age}yo ${gender}, ${skinTone} skin, ${hairStyle} ${hairColor} hair.
    Companion: ${animal}. Style: ${characterStyle}. Location: ${location}. Lesson: ${lesson}. 
    Return JSON { "title", "heroBible", "animalBible", "pages": [{ "pageNumber", "text", "prompt" }] }`;
    
    const result = await model.generateContent(prompt);
    const storyData = JSON.parse((await result.response).text().replace(/```json/g, '').replace(/```/g, ''));
    
    const bookDoc = {
      ...storyData, childName, age, gender, skinTone, hairStyle, hairColor, animal, characterStyle, location, lesson, occasion, language, email, photoUrl,
      status: 'teaser', createdAt: new Date()
    };

    const bookResult = await db.collection('books').insertOne(bookDoc);
    res.json({ success: true, bookId: bookResult.insertedId, ...storyData });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/generate-images', async (req, res) => {
  const { bookId } = req.body;
  try {
    const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
    const isPaid = book.status === 'paid';
    const limit = isPaid ? book.pages.length : TEASER_LIMIT;

    res.json({ success: true, message: `Painting started (Limit: ${limit})` });

    (async () => {
      const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });
      for (let i = 0; i < limit; i++) {
        const result = await model.generateContent(`Style: ${book.characterStyle}. ${book.heroBible}. ${book.animalBible}. Scene: ${book.pages[i].prompt}`);
        const imgData = (await result.response).candidates[0].content.parts.find(p => p.inlineData).inlineData.data;
        const url = await uploadToGCS(Buffer.from(imgData, 'base64'), `books/${bookId}/page_${i+1}.png`, 'image/png');
        await db.collection('books').updateOne({ _id: new ObjectId(bookId) }, { $set: { [`pages.${i}.imageUrl`]: url } });
      }
      await db.collection('books').updateOne({ _id: new ObjectId(bookId) }, { $set: { status: isPaid ? 'illustrated' : 'teaser_ready' } });
    })();
  } catch (error) { console.error(error); }
});

app.get('/api/book-status', async (req, res) => {
  const { bookId } = req.query;
  const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
  
  // SECURE: Sign all page URLs before sending to the app
  const securedPages = await Promise.all(book.pages.map(async p => ({
    ...p,
    imageUrl: await getSignedUrl(p.imageUrl)
  })));

  res.json({ status: book.status, pages: securedPages, pdfUrl: await getSignedUrl(book.pdfUrl) });
});

app.listen(port, () => {
  console.log(`🚀 Secure Engine running at http://localhost:${port}`);
  connectDB().catch(console.error);
});