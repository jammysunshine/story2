const express = require('express');
console.log('🚀 NODE PROCESS STARTING...');
const path = require('path');
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
const { v4: uuidv4 } = require('uuid');
const { generateImages } = require('./imageService');
const { generatePdf, get7DaySignedUrl } = require('./pdfService');
const logger = require('./logger');

dotenv.config();

// Import mail module AFTER environment variables are loaded
const { sendStoryEmail } = require('./mail');

const app = express();

// --- STARTUP CONFIGURATION CHECK ---
const REQUIRED_ENV_VARS = [
  'GOOGLE_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'GCP_PROJECT_ID',
  'GCS_IMAGES_BUCKET_NAME',
  'GOOGLE_CLIENT_ID',
  'MONGODB_URI',
  'APP_URL',
  'PRINT_PRICE_AMOUNT',
  'BASE_CURRENCY',
  'GELATO_API_KEY',
  'MONGODB_DB_NAME',
  'GOOGLE_API_KEY_P'
];

const missingVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  logger.warn('⚠️ WARNING: Missing recommended environment variables:');
  missingVars.forEach(v => logger.warn(`   - ${v}`));
  logger.warn('The server will continue to start, but some features may fail.');
} else {
  logger.info('✅ Environment variable check passed.');
}

// --- GLOBAL SAFETY NETS ---

process.on('uncaughtException', (err) => {
  logger.error('🔥 CRITICAL: Uncaught Exception!', { message: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('🔥 CRITICAL: Unhandled Rejection!', { reason: reason?.message || reason, stack: reason?.stack });
});

const upload = multer({ storage: multer.memoryStorage() });
app.use((req, res, next) => {
  res.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (req.originalUrl === '/api/webhook') next();
  else express.json({ limit: '10mb' })(req, res, next);
});
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));
// app.use((req, res, next) => { logger.info(`${req.method} ${req.url} from ${req.ip}`); next(); }); // Commented out to reduce log noise in production

const port = process.env.PORT || 3001;
const TEASER_LIMIT = parseInt(process.env.STORY_TEASER_PAGES_COUNT || '7');
const PRINT_PRICE_AMOUNT = parseInt(process.env.PRINT_PRICE_AMOUNT || '4999');
const BASE_CURRENCY = process.env.BASE_CURRENCY || 'usd';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'story-db';
const MONGODB_TIMEOUT_MS = parseInt(process.env.MONGODB_TIMEOUT_MS || '90000');

const STORY_COST = parseInt(process.env.STORY_COST || '10');
const IMAGE_COST = parseInt(process.env.IMAGE_COST || '2');
const PDF_COST = parseInt(process.env.PDF_COST || '15');
const BOOK_COST = parseInt(process.env.PRINT_PRICE_AMOUNT || '4999');

// Initialize Services
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const bucket = storage.bucket(process.env.GCS_IMAGES_BUCKET_NAME);
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
let db;

async function connectDB() {
  const client = new MongoClient(process.env.MONGODB_URI, {
    family: 4,
    serverSelectionTimeoutMS: MONGODB_TIMEOUT_MS,
    connectTimeoutMS: MONGODB_TIMEOUT_MS
  });
  await client.connect();
  db = client.db(MONGODB_DB_NAME);
  logger.info(`✅ Connected to MongoDB Database: ${MONGODB_DB_NAME}`);
}

// --- SECURITY: SIGNED URLS ---

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: db ? 'connected' : 'disconnected'
  });
});

async function getSignedUrl(gcsPath) {
  if (!gcsPath) return null;

  // 1. Strip any existing query parameters or versioning (e.g., ?v=123 or ?X-Goog-...)
  let cleanPath = gcsPath.split('?')[0];

  // 2. Extract the relative file path from the full URL
  const bucketPrefix = `https://storage.googleapis.com/${process.env.GCS_IMAGES_BUCKET_NAME}/`;
  const filePath = cleanPath.replace(bucketPrefix, '');

  try {
    const [url] = await bucket.file(filePath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });
    return url;
  } catch (e) {
    logger.error({ msg: 'Sign error', error: e.message, path: filePath });
    return gcsPath;
  }
}

async function uploadToGCS(buffer, fileName, contentType) {
  const file = bucket.file(fileName);
  await file.save(buffer, { metadata: { contentType, cacheControl: 'private, max-age=0' } });
  return `https://storage.googleapis.com/${process.env.GCS_IMAGES_BUCKET_NAME}/${fileName}`;
}

async function generateImageRace(prompt, bookId, pageNumber) {
  const model = genAI.getGenerativeModel({ model: process.env.GOOGLE_IMAGE_MODEL || 'gemini-2.5-flash-image' });
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
    const email = await getUserEmailFromToken(token);
    if (!email) throw new Error('Could not resolve email from token');

    // Fetch user info from Google for name if it's an access token
    let name = 'Adventurer';
    if (token.length <= 500) {
      const userInfo = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`);
      name = userInfo.data.name;
    } else {
      const ticket = await googleClient.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
      name = ticket.getPayload().name;
    }

    const user = await db.collection('users').findOneAndUpdate(
      { email: email.toLowerCase() },
      { $set: { name, lastLogin: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );
    logger.info(`👤 User Logged In: ${email}`);
    res.json({ success: true, user: user.value || user });
  } catch (err) {
    logger.error('Auth failure:', err.message);
    res.status(500).json({ error: 'Auth failed' });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const fileExtension = file.originalname.split('.').pop() || 'png';
    const fileName = `uploads/${uuidv4()}.${fileExtension}`;
    const blob = bucket.file(fileName);

    await blob.save(file.buffer, {
      metadata: { contentType: file.mimetype },
      public: true
    });

    const publicUrl = `https://storage.googleapis.com/${process.env.GCS_IMAGES_BUCKET_NAME}/${fileName}`;
    res.json({ url: publicUrl });
  } catch (error) {
    logger.error('Upload error:', error.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

function getSafeAgeDescription(age) {
  const ageNum = parseInt(age);
  if (ageNum <= 2) return "a tiny toddler";
  if (ageNum <= 5) return "a playful little child";
  if (ageNum <= 9) return "a brave young hero";
  if (ageNum <= 13) return "a curious young adventurer";
  return "a youthful hero";
}

app.post('/api/generate-story', async (req, res) => {
  try {
    const { childName, age, gender = 'Boy', skinTone, hairStyle, hairColor, animal, characterStyle, occasion, language, theme = 'custom', email, photoUrl } = req.body;

    const ageDescription = getSafeAgeDescription(age || '5');
    const lesson = req.body.lesson?.toLowerCase() === 'none' ? '' : req.body.lesson;
    const location = req.body.location?.toLowerCase() === 'none' ? '' : req.body.location;

    let persona = "specialist children's book author";
    let targetAudience = `a child named ${childName}`;
    let extraInstructions = "The story should be appropriate for children.";

    if (theme === 'valentine') {
      persona = "poetic and sophisticated romantic author";
      targetAudience = `a beloved person named ${childName}`;
      extraInstructions = "The story should be elegant, romantic, and deeply meaningful. Avoid childish language. Focus on shared memories, the beauty of the relationship, and a future together. It should feel like a high-end personalized gift book.";
    } else if (theme === 'superhero') {
      persona = "dynamic comic book and adventure writer";
      extraInstructions = "The story should be action-packed and inspiring, focusing on the character's unique powers and courage.";
    }

    logger.info('🎨 ========== STORY GENERATION STYLE OPTIONS ==========');
    logger.info(`👤 Child/Hero Name: ${childName}`);
    logger.info(`🎭 Theme Mode: ${theme}`);
    logger.info(`✍️ Persona: ${persona}`);
    logger.info(`🚻 Gender: ${gender}`);
    logger.info(`🌍 Language: ${language || 'English'}`);
    logger.info(`🐾 Animal: ${animal}`);
    logger.info(`📚 Lesson: ${lesson || 'None (Focus on pure fun/adventure)'}`);
    logger.info(`🎉 Occasion: ${occasion || 'None'}`);
    logger.info(`📍 Location: ${location || 'None (AI determined)'}`);
    logger.info(`🎨 Character Style: ${characterStyle}`);
    logger.info(`🛡️ Anti-Creepy Rule: friendly expression, large expressive eyes, no distorted features`);
    logger.info('🎨 ====================================================');

    // Use the new API key for story generation to avoid rate limiting on original key
    // Use gemini-2.0-flash-exp model which may have better availability
    const storyGenAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY_P);
    const model = storyGenAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.8,
        topP: 0.95,
        responseMimeType: 'application/json',
      },
    });

    const pagesCount = parseInt(process.env.STORY_PAGES_COUNT || '23');
    const prompt = `IMPORTANT SAFETY INSTRUCTIONS: You must create content that is 100% compliant with strict AI image generation safety filters.
   - Focus on wholesome, joyful, and professional storybook quality.
   You are a ${persona}. Your task is to create a story featuring two main characters: a child and an animal companion.
   FIRST: Create a 'Hero Bible' for the child and an 'Animal Bible' for the animal.
   - Write each Bible as a short, natural paragraph of descriptive prose (under 60 words).
   - Focus on simple, positive, and visual traits.
   HERO BIBLE (The Child):
   - Name: "${childName}"
   - Gender: ${gender} (CRITICAL: You MUST portray the child as a ${gender.toLowerCase()} and use ${gender.toLowerCase() === 'boy' ? 'he/him' : 'she/her'} pronouns exclusively throughout the entire story and Hero Bible).
   - Description: ${gender} child, ${skinTone} skin tone, ${hairStyle} ${hairColor} hair.
   - Appearance: Friendly expression, bright expressive eyes, wearing simple colorful children's clothing.
   ANIMAL BIBLE (The Animal):
   - Species: "${animal}"
   - Appearance: A friendly, cute, and highly expressive ${animal.toLowerCase()} with gentle eyes and distinct features. Describe its fur/skin texture, any unique markings, and its endearing personality in the Bible paragraph.
   - Artistic style for both: "${characterStyle}"
   IMPORTANT: You must create EXACTLY ${pagesCount} pages. Not more, not less.
   For the ${pagesCount}-page story:
   Every single visual_prompt you generate MUST start with the Hero Bible paragraph AND the Animal Bible paragraph before describing the scene. This is mandatory for visual consistency.
   CRITICAL: You must write the entire story and the catchy title in ${language || 'English'}.
   Create a EXACTLY ${pagesCount} page story where ${childName} and their ${animal.toLowerCase()} friend go on an adventure. ${location ? `The story takes place in ${location}.` : ""} ${occasion ? `The story revolves around the theme or occasion of "${occasion}".` : ""} ${lesson ? `The lesson should teach: "${lesson}".` : ""} ${extraInstructions}
   CRITICAL REQUIREMENTS:
   - You MUST create EXACTLY ${pagesCount} pages (no more, no less)
   - Each page MUST have pageNumber, text, and prompt fields
   - Every prompt MUST start with the EXACT Hero Bible and Animal Bible text.
   - The story should have a clear beginning, middle, and end
   Return the result as a JSON object with the following structure:
   {
   "title": "A catchy title",
   "heroBible": "Descriptive paragraph for the child",
   "animalBible": "Descriptive paragraph for the animal",
   "finalPrompt": "A visual prompt for the 'The End' page that captures the theme of the story",
   "pages": [
   {
   "pageNumber": 1,
   "text": "Story text",
   "prompt": "Hero Bible + Animal Bible + Scene details"
   }
   ]
   }
   
   FINAL REMINDER: The pages array MUST contain EXACTLY ${pagesCount} objects.`;

    logger.info(`📖 Generating story with ${pagesCount} pages`);
    logger.info('🌐 ========== GEMINI STORY PROMPT AUDIT ==========');
    logger.info(`📜 FULL PROMPT: ${prompt}`);
    logger.info('🌐 ===============================================');

    let storyData;
    const maxRetries = parseInt(process.env.STORY_GEN_MAX_RETRIES || '5'); // Increased to 5 retries for story generation
    const retryDelay = parseInt(process.env.STORY_GEN_DELAY_MS || '15000'); // Using story-specific delay

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Attempting Gemini API call (attempt ${attempt}/${maxRetries})`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let storyText = response.text();

        if (!storyText) throw new Error('No text content received');

        let cleanText = storyText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        storyData = JSON.parse(cleanText);

        logger.info('✅ JSON parsing successful');
        logger.info('✅ ========== STORY GENERATED SUCCESSFULLY ==========');
        logger.info(`👶 Hero Bible: ${storyData.heroBible}`);
        logger.info(`🐾 Animal Bible: ${storyData.animalBible}`);
        break;
      } catch (err) {
        const isRateLimit = JSON.stringify(err).includes('429') || err.message?.includes('429');
        if (isRateLimit && attempt < maxRetries) {
          logger.warn(`Gemini API rate limited (attempt ${attempt}/${maxRetries}), waiting...`);
          await new Promise(r => setTimeout(r, retryDelay));
          continue;
        }
        if (attempt === maxRetries) throw err;
      }
    }

    const bookIdObj = new ObjectId();
    const pagesWithUrls = storyData.pages.map(p => ({
      ...p,
      imageUrl: `https://via.placeholder.com/1024x1024.png?text=Painting+Page+${p.pageNumber}...`
    }));

    const bookDoc = {
      _id: bookIdObj,
      userId: email || null,
      title: storyData.title,
      childName,
      age,
      gender,
      skinTone,
      hairStyle,
      hairColor,
      language: language || 'English',
      animal,
      lesson,
      occasion,
      location,
      characterStyle,
      photoUrl: photoUrl || null,
      heroBible: storyData.heroBible,
      animalBible: storyData.animalBible,
      finalPrompt: storyData.finalPrompt,
      pages: pagesWithUrls,
      status: email ? 'preview' : 'teaser',
      isDigitalUnlocked: !!email,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('books').insertOne(bookDoc);
    logger.info('✅ Story generated and saved to database', { bookId: bookIdObj });

    if (email) {
      const recentBookEntry = {
        id: bookIdObj.toString(),
        title: bookDoc.title,
        thumbnailUrl: pagesWithUrls[0]?.imageUrl || '',
        status: bookDoc.status,
        isDigitalUnlocked: true,
        createdAt: bookDoc.createdAt
      };

      await db.collection('users').updateOne(
        { email: email.toLowerCase() },
        {
          $inc: { storiesCount: 1 },
          $push: {
            recentBooks: {
              $each: [recentBookEntry],
              $position: 0,
              $slice: 2
            }
          },
          $set: { updatedAt: new Date() }
        },
        { upsert: true }
      );
    }

    res.json({ success: true, bookId: bookIdObj.toString(), ...storyData });
  } catch (error) {
    logger.error({ msg: 'Story gen failed', error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-images', async (req, res) => {
  const { bookId } = req.body;
  res.json({ success: true, message: 'Painting started' });

  try {
    const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
    const isFulfillment = ['paid', 'printing', 'printing_test', 'pdf_ready'].includes(book?.status || '');

    generateImages(db, bookId, isFulfillment).catch(err => {
      logger.error('💥 [IMAGE_GEN_CRASH]', {
        message: err.message,
        stack: err.stack,
        bookId
      });
    });
  } catch (e) {
    logger.error('Failed to start image generation:', e.message);
  }
});

// Common helper for token verification
async function getUserEmailFromToken(token) {
  if (!token) {
    logger.debug('Token validation: No token provided');
    return null;
  }

  logger.debug(`Token validation: Processing token of length ${token.length}, starts with: ${token.substring(0, 20)}...`);

  try {
    if (token.length > 500) {
      // ID Token
      logger.debug('Token validation: Treating as ID token');
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      const email = ticket.getPayload().email;
      logger.debug(`Token validation: Successfully extracted email from ID token: ${email}`);
      return email;
    } else {
      // Access Token
      logger.debug('Token validation: Treating as Access token');
      const userInfo = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`);
      const email = userInfo.data.email;
      logger.debug(`Token validation: Successfully extracted email from Access token: ${email}`);
      return email;
    }
  } catch (error) {
    logger.warn(`Token validation failed for token starting with: ${token.substring(0, 20)}... Error: ${error.message}`);
    logger.debug(`Token validation error details:`, error);
    return null; // Return null instead of throwing to allow graceful degradation
  }
}

app.get('/api/orders', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  logger.debug(`Order fetch attempt with token starting: ${token.substring(0, 20)}...`);
  const email = await getUserEmailFromToken(token);
  if (!email) {
    logger.warn('Order fetch blocked (Invalid/Missing Token): Could not resolve email from token');
    return res.status(401).json({ error: 'Invalid token' });
  }
  logger.debug(`Order fetch: Successfully authenticated user with email: ${email}`);

  try {
    logger.info(`🔍 [ORDER_FETCH] Fetching orders for email: ${email}`);
    const orders = await db.collection('orders').find({ email }).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, orders });
  } catch (error) {
    logger.error('Error fetching orders:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET USER'S LIBRARY OF BOOKS
app.get('/api/user/library', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  logger.debug(`Library fetch attempt with token starting: ${token.substring(0, 20)}...`);
  const email = await getUserEmailFromToken(token);
  if (!email) {
    logger.warn('Library fetch blocked (Invalid/Missing Token): Could not resolve email from token');
    return res.status(401).json({ error: 'Invalid token' });
  }
  logger.debug(`Library fetch: Successfully authenticated user with email: ${email}`);

  try {
    logger.info(`📚 [LIBRARY_FETCH] Fetching books for email: ${email}`);
    const books = await db.collection('books').find({
      $or: [
        { email: email.toLowerCase() },
        { userId: email.toLowerCase() }
      ]
    }).sort({ createdAt: -1 }).toArray();

    logger.info(`📚 [LIBRARY_FETCH] Found ${books.length} books for ${email}`);
    res.json({ success: true, books });
  } catch (error) {
    logger.error('Error fetching library:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/api/book-status', async (req, res) => {
  const { bookId } = req.query;
  try {
    if (!bookId || !ObjectId.isValid(bookId)) {
      return res.status(400).json({ error: 'Invalid or missing bookId' });
    }
    const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    const securedPages = await Promise.all((book.pages || []).map(async p => ({ ...p, imageUrl: await getSignedUrl(p.imageUrl) })));

    let signedPdfUrl = null;
    if (book.pdfUrl) {
      const { get7DaySignedUrl } = require('./pdfService');
      signedPdfUrl = await get7DaySignedUrl(book.pdfUrl);
    }

    console.log(`[DEBUG] /api/book-status for ${bookId}: status=${book.status}, pagesWithImages=${securedPages.filter(p => p.imageUrl && !p.imageUrl.includes('placeholder')).length}`);
    res.json({ status: book.status, pages: securedPages, pdfUrl: signedPdfUrl });
  } catch (error) {
    logger.error(`Error in /api/book-status: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-pdf', async (req, res) => {
  const { bookId } = req.body;
  try {
    logger.info(`📄 [PDF_GEN] Starting generation for Book: ${bookId}`);
    const pdfUrl = await generatePdf(db, bookId);
    const signedUrl = await get7DaySignedUrl(pdfUrl);

    logger.info(`🔗 [PDF_GEN] SUCCESS! PDF Link generated: ${signedUrl.substring(0, 100)}...`);

    // Send PDF ready email to the user
    const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
    const emailRecipient = book?.userId || book?.customerEmail;

    if (emailRecipient) {
      const { sendStoryEmail } = require('./mail');
      logger.info(`📡 [EMAIL_TRIGGER] Attempting to send PDF email to: ${emailRecipient} (Found in ${book?.userId ? 'userId' : 'customerEmail'})`);
      try {
        await sendStoryEmail(emailRecipient, book.title, signedUrl);
        logger.info(`✅ [EMAIL_TRIGGER] SUCCESS! PDF ready email sent to ${emailRecipient}`);
      } catch (emailError) {
        logger.error(`❌ [EMAIL_TRIGGER] FAILED to send email to ${emailRecipient}: ${emailError.message}`);
      }
    } else {
      logger.warn(`⚠️ [EMAIL_TRIGGER] SKIPPED: No recipient email found in record for book ${bookId}. Fields: { userId: ${book?.userId}, customerEmail: ${book?.customerEmail} }`);
    }

    res.json({ success: true, pdfUrl: signedUrl });
  } catch (error) {
    logger.error(`💥 [PDF_GEN] FAILED for Book ${bookId}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    // FIX: Use req.body directly as it's already a Buffer from express.raw middleware
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error(`❌ Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookId = session.metadata.bookId;
    const stripeEmail = session.customer_details.email;
    const accountEmail = session.metadata.accountEmail;

    // IDENTITY LOGIC: Prioritize logged-in account email over Stripe billing email
    const email = accountEmail || stripeEmail;
    const type = session.metadata.type || 'book'; // default to book if not specified

    logger.info(`💰 [CHECKOUT_COMPLETE] Processing Identity:`, {
      bookId,
      finalEmail: email,
      fromAccount: !!accountEmail,
      accountEmail,
      stripeEmail,
      type
    });

    // 1. Create Order Record
    const shipping = session.shipping_details;
    const address = shipping?.address || session.customer_details?.address;
    const customerPhone = session.customer_details?.phone || shipping?.phone || '';
    const nameParts = (shipping?.name || session.customer_details?.name || 'Customer').split(' ');

    const orderData = {
      bookId: new ObjectId(bookId),
      userId: email,
      stripeSessionId: session.id,
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency?.toUpperCase(),
      status: 'paid',
      type: type,
      shippingAddress: {
        firstName: nameParts[0] || 'Customer',
        lastName: nameParts.slice(1).join(' ') || '',
        addressLine1: address?.line1 || '',
        addressLine2: address?.line2 || '',
        city: address?.city || '',
        state: address?.state || '',
        postCode: address?.postal_code || '',
        country: address?.country || 'AU',
        email: email,
        phone: customerPhone
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('orders').insertOne(orderData);

    // 1.1 Sync latest address/phone to User Profile for future convenience
    await db.collection('users').updateOne(
      { email: email.toLowerCase() },
      {
        $set: {
          lastShippingAddress: orderData.shippingAddress,
          phone: customerPhone,
          updatedAt: new Date()
        }
      }
    ).catch(e => logger.error('Failed to sync address to user profile:', e));

    // 2. Update Book Status
    const bookUpdate = {
      status: 'paid', // All orders start as 'paid' to trigger image generation first
      isDigitalUnlocked: true,
      userId: email, // ENSURE userId is set so emails can be sent later
      customerEmail: session.customer_details?.email,
      updatedAt: new Date()
    };

    await db.collection('books').updateOne(
      { _id: new ObjectId(bookId) },
      { $set: bookUpdate }
    );

    // 3. Update user's recent books
    await db.collection('users').updateOne(
      { email: email.toLowerCase(), "recentBooks.id": bookId },
      {
        $set: {
          "recentBooks.$.status": bookUpdate.status,
          "recentBooks.$.isDigitalUnlocked": true,
          updatedAt: new Date()
        }
      }
    ).catch((e) => logger.error('Failed to sync status to recentBooks:', e));

    // 4. Trigger Background Tasks (Painting + PDF + Gelato)
    // Run these as background tasks
    handleCheckoutComplete(session, bookId, db, type, orderData).catch(err => {
      logger.error('Fulfillment Background Task Failed:', err);
    });
  }

  res.json({ received: true });
});

// Helper function to get raw body for webhook signature verification
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', reject);
  });
}

// Background fulfillment function
async function handleCheckoutComplete(session, bookId, db, type = 'book', orderData) {
  try {
    logger.info(`🏁 [LIFECYCLE_TRACKER] STARTING fulfillment for Book: ${bookId}`);

    // 1. Trigger Image Generation (Painting the rest of the book)
    logger.info(`🎨 Kicking off image generation for Stripe order: ${bookId}`);
    try {
      const currentBook = await db.collection('books').findOne({ _id: new ObjectId(bookId) });

      if (currentBook) {
        logger.info(`🎨 Webhook calling generateImages: bookId=${bookId}`);

        // This function handles the expansion to all pages and skips already-painted images
        await generateImages(db, bookId, true); // true indicates this is a fulfillment call
        logger.info('✅ Image generation finished for Stripe order.');
      }
    } catch (genError) {
      logger.error('❌ Failed to generate images for Stripe order:', genError);
    }

    // 2. Trigger PDF generation (Now safe because images are done)
    logger.info(`📄 Triggering PDF generation for: ${bookId}`);

    // FETCH LATEST BOOK TO CHECK FOR PLACEHOLDERS BEFORE PDF OR PRINTING
    const bookRecordCheck = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
    const placeholders = bookRecordCheck?.pages?.filter((p) =>
      !p.imageUrl ||
      p.imageUrl.includes('via.placeholder.com') ||
      p.imageUrl.includes('placeholder.png') ||
      p.imageUrl.includes('Painting+Page')
    );

    if (placeholders && placeholders.length > 0) {
      logger.error(`🚨 [FULFILLMENT ERROR] Book ${bookId} contains ${placeholders.length} placeholders. Retrying painting...`);
      // Re-trigger painting once more and wait
      await generateImages(db, bookId, true);

      // Check again after retry
      const bookRecordRecheck = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
      const remainingPlaceholders = bookRecordRecheck?.pages?.filter((p) =>
        !p.imageUrl || p.imageUrl.includes('placeholder') || p.imageUrl.includes('Painting+Page')
      );

      if (remainingPlaceholders && remainingPlaceholders.length > 0) {
        logger.error(`❌ [FULFILLMENT HALT] Book ${bookId} still has ${remainingPlaceholders.length} missing images. Aborting PDF generation.`);
        return; // Stop here to prevent generating a broken PDF
      }
    }

    // Internal call should always hit the local Express port
    const internalUrl = `http://localhost:${port}`;
    const pdfResponse = await fetch(`${internalUrl}/api/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bookId }),
    });

    if (!pdfResponse.ok) {
      throw new Error(`PDF generation failed: ${pdfResponse.statusText}`);
    }

    const { pdfUrl } = await pdfResponse.json();
    logger.info(`✅ PDF generated successfully: ${pdfUrl}`);

    // 3. Trigger Gelato fulfillment ONLY for physical books
    if (type === 'book') {
      const { triggerGelatoFulfillment } = require('./fulfillmentService');

      await triggerGelatoFulfillment({
        bookId,
        pdfUrl,
        shippingAddress: orderData.shippingAddress,
        db,
        orderReferenceId: `${bookId}-${session.id.slice(-6)}`,
        currency: session.currency?.toUpperCase() || 'AUD'
      });

      logger.info('📦 Gelato fulfillment initiated successfully');
    } else {
      logger.info('✨ [FULFILLMENT] Digital order complete. PDF is ready.');

      // For digital orders, send PDF ready email
      const customerEmail = orderData.shippingAddress.email || session.customer_details?.email;
      if (customerEmail) {
        const { sendStoryEmail } = require('./mail');
        const { get7DaySignedUrl } = require('./pdfService');
        const signedUrl = await get7DaySignedUrl(pdfUrl);

        logger.info(`📡 [DIGITAL_FULFILLMENT] Sending email to: ${customerEmail}`);
        try {
          // Fetch book title fresh
          const currentBook = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
          await sendStoryEmail(customerEmail, currentBook?.title || 'Your Digital Storybook', signedUrl);
          logger.info(`✅ [DIGITAL_FULFILLMENT] SUCCESS! Email sent.`);
        } catch (emailError) {
          logger.error(`❌ [DIGITAL_FULFILLMENT] FAILED: ${emailError.message}`);
        }
      }
    }

    logger.info(`✅ [LIFECYCLE_TRACKER] FINISHED full fulfillment for Book: ${bookId}`);

  } catch (error) {
    logger.error('❌ Error processing checkout completion:', error);

    await db.collection('books').updateOne(
      { _id: new ObjectId(bookId) },
      {
        $set: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date()
        }
      }
    );
  }
}

app.get('/success', (req, res) => {
  const { bookId } = req.query;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Magic Confirmed!</title>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', -apple-system, sans-serif; background-color: #020617; color: white; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; overflow: hidden; }
        .glow { position: absolute; width: 300px; height: 300px; background: radial-gradient(circle, rgba(79, 70, 229, 0.3) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; z-index: -1; top: 50%; left: 50%; transform: translate(-50%, -50%); animation: pulse 4s infinite ease-in-out; }
        @keyframes pulse { 0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; } 50% { transform: translate(-50%, -50%) scale(1.5); opacity: 0.6; } }
        .card { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(10px); padding: 3rem 2rem; border-radius: 3rem; border: 1px solid rgba(255,255,255,0.05); max-width: 400px; width: 85%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
        .icon-circle { width: 80px; height: 80px; background: rgba(34, 197, 94, 0.1); border-radius: 50%; display: flex; items-center; justify-content: center; margin: 0 auto 2rem; color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.2); }
        h1 { font-weight: 900; text-transform: uppercase; letter-spacing: -0.05em; font-size: 2rem; margin: 0 0 1rem; line-height: 1; }
        p { color: #94a3b8; font-size: 1rem; margin-bottom: 2.5rem; line-height: 1.5; }
        .btn { background: #ffffff; color: #020617; padding: 1.25rem 2rem; border-radius: 1.25rem; text-decoration: none; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; width: 100%; box-sizing: border-box; transition: all 0.2s; box-shadow: 0 10px 15px -3px rgba(255,255,255,0.1); }
        .btn:active { transform: scale(0.96); opacity: 0.9; }
        .secondary-link { margin-top: 2rem; display: block; color: #64748b; font-size: 0.8rem; text-decoration: none; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
      </style>
    </head>
    <body>
      <div class="glow"></div>
      <div class="card">
        <div class="icon-circle">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <h1>Magic Confirmed!</h1>
        <p>Your payment was successful. Returning you to the app to start painting your story...</p>
        <a href="com.aistorytime.app://success?bookId=${bookId}" class="btn">Return to App</a>
        <a href="/success?bookId=${bookId}" class="secondary-link">Stay in Browser</a>
      </div>
      <script>
        // Automatic deep link attempt
        setTimeout(() => {
          window.location.href = "com.aistorytime.app://success?bookId=${bookId}";
        }, 500);
      </script>
    </body>
    </html>
  `);
});

app.get('/cancel', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Cancelled</title>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', -apple-system, sans-serif; background-color: #020617; color: white; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; overflow: hidden; }
        .card { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(10px); padding: 3rem 2rem; border-radius: 3rem; border: 1px solid rgba(255,255,255,0.05); max-width: 400px; width: 85%; }
        h1 { font-weight: 900; text-transform: uppercase; letter-spacing: -0.05em; font-size: 1.75rem; margin-bottom: 1rem; }
        p { color: #94a3b8; font-size: 1rem; margin-bottom: 2.5rem; }
        .btn { background: rgba(255,255,255,0.1); color: white; padding: 1.25rem 2rem; border-radius: 1.25rem; text-decoration: none; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; width: 100%; box-sizing: border-box; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Payment Cancelled</h1>
        <p>No worries! You can try again whenever you are ready.</p>
        <a href="com.aistorytime.app://home" class="btn">Return to App</a>
        <a href="/" class="secondary-link" style="margin-top: 2rem; display: block; color: #64748b; font-size: 0.8rem; text-decoration: none; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Back to Home</a>
      </div>
    </body>
    </html>
  `);
});

app.post('/api/create-checkout', async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('[CHECKOUT_ERROR] Request body is empty. Ensure Content-Type: application/json is set.');
      return res.status(400).json({ error: 'Request body is empty' });
    }

    const { bookId, bookTitle, accountEmail } = req.body;
    console.log(`[CHECKOUT_START] bookId=${bookId}, email=${accountEmail}, title=${bookTitle}`);
    
    const appUrl = (process.env.APP_URL || '').trim();
    if (!appUrl) throw new Error('APP_URL environment variable is missing');
    
    const success_url = `${appUrl}/success?bookId=${bookId}`;
    const cancel_url = `${appUrl}/`;
    
    console.log(`[CHECKOUT_DEBUG] Generating Stripe Session with: success_url=${success_url}, cancel_url=${cancel_url}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      phone_number_collection: { enabled: true },
      shipping_address_collection: { allowed_countries: [] }, // Blank array allows all countries supported by Stripe
      line_items: [{ price_data: { currency: BASE_CURRENCY, product_data: { name: `Hardcover: ${bookTitle}` }, unit_amount: PRINT_PRICE_AMOUNT }, quantity: 1 }],
      mode: 'payment',
      success_url: success_url,
      cancel_url: cancel_url,
      metadata: { bookId, accountEmail }
    });
    console.log(`[CHECKOUT_SUCCESS] sessionId=${session.id}`);
    res.json({ url: session.url });
  } catch (error) { 
    console.error('[CHECKOUT_ERROR] Detailed Stripe failure:', {
      message: error.message,
      type: error.type,
      code: error.code,
      param: error.param,
      request_id: error.requestId
    });
    res.status(500).json({ error: error.message }); 
  }
});

// --- FRONTEND SERVING ---
console.log(`📡 Preparing to listen on port: ${port}`);
// Serve static files from the 'public_html' directory (built Vite app)
const publicPath = path.join(__dirname, 'public_html');
app.use(express.static(publicPath));

// Catch-all route to serve the React app for any route not handled by the API
// This is critical for React Router routes like /print/template/:bookId to work
app.get(/^((?!\/api).)*$/, (req, res) => {
  // Only serve index.html if it's not an API route
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start the server immediately so Cloud Run health checks pass
app.listen(port, '0.0.0.0', () => {
  logger.info(`🚀 Engine Server running at http://localhost:${port}`);
  
  // Connect to database in the background
  connectDB().catch(err => {
    logger.error('❌ Failed to connect to MongoDB:', err.message);
  });
});
