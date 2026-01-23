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
const { v4: uuidv4 } = require('uuid');
const { sendStoryEmail } = require('./mail');
const { generateImages } = require('./imageService');
const { generatePdf, get7DaySignedUrl } = require('./pdfService');
const logger = require('./logger');

dotenv.config();

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
  'GOOGLE_APPLICATION_CREDENTIALS',
  'APP_URL',
  'PRINT_PRICE_AMOUNT',
  'BASE_CURRENCY',
  'GELATO_API_KEY',
  'MONGODB_DB_NAME'
];

const missingVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  logger.error('❌ CRITICAL ERROR: Missing required environment variables:');
  missingVars.forEach(v => logger.error(`   - ${v}`));
  logger.error('The server will now exit. Please fix your .env file.');
  process.exit(1);
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
app.use(cors());

const port = process.env.PORT || 3001;
const TEASER_LIMIT = parseInt(process.env.STORY_TEASER_PAGES_COUNT || '7');
const PRINT_PRICE_AMOUNT = parseInt(process.env.PRINT_PRICE_AMOUNT || '2500');
const BASE_CURRENCY = process.env.BASE_CURRENCY || 'aud';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'story-db';
const MONGODB_TIMEOUT_MS = parseInt(process.env.MONGODB_TIMEOUT_MS || '90000');

const STORY_COST = parseInt(process.env.STORY_COST || '10');
const IMAGE_COST = parseInt(process.env.IMAGE_COST || '2');
const PDF_COST = parseInt(process.env.PDF_COST || '15');
const BOOK_COST = parseInt(process.env.PRINT_PRICE_AMOUNT || '2500');

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
    let email, name;

    // Support both ID Token (Capacitor) and Access Token (Web GSI)
    if (token.length > 500) {
      // Likely an ID Token
      const ticket = await googleClient.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      email = payload.email;
      name = payload.name;
    } else {
      // Likely an Access Token - fetch user info from Google
      const userInfo = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`);
      email = userInfo.data.email;
      name = userInfo.data.name;
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

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
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
    const maxRetries = parseInt(process.env.MAX_RETRY_ATTEMPTS || '5');
    const retryDelay = parseInt(process.env.IMAGE_GENERATION_DELAY_MS || '15000');

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
  generateImages(db, bookId).catch(err => {
    logger.error('💥 [IMAGE_GEN_CRASH]', { 
      message: err.message, 
      stack: err.stack,
      bookId 
    });
  });
});

app.get('/api/orders', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const ticket = await googleClient.verifyIdToken({ 
      idToken: token, 
      audience: process.env.GOOGLE_CLIENT_ID 
    });
    const payload = ticket.getPayload();
    const email = payload.email;

    const orders = await db.collection('orders').find({ email }).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, orders });
  } catch (error) { 
    logger.error('Order fetch failed:', error.message);
    res.status(401).json({ error: 'Invalid token' }); 
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
    console.log(`[DEBUG] /api/book-status for ${bookId}: status=${book.status}, pagesWithImages=${securedPages.filter(p => p.imageUrl && !p.imageUrl.includes('placeholder')).length}`);
    res.json({ status: book.status, pages: securedPages, pdfUrl: await get7DaySignedUrl(book.pdfUrl) });
  } catch (error) {
    logger.error(`Error in /api/book-status: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-pdf', async (req, res) => {
  const { bookId } = req.body;
  try {
    const pdfUrl = await generatePdf(db, bookId);
    const signedUrl = await get7DaySignedUrl(pdfUrl);

    // Send PDF ready email to the user
    const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
    if (book && book.userId) {
      const { sendStoryEmail } = require('./mail');
      await sendStoryEmail(book.userId, book.title, signedUrl);
      logger.info(`📧 PDF ready email sent to ${book.userId}`);
    }

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
    // FIX: Use req.body directly as it's already a Buffer from express.raw middleware
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error(`❌ Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookId = session.metadata.bookId;
    const email = session.customer_details.email;
    const type = session.metadata.type || 'book'; // default to book if not specified

    logger.info(`💰 Payment Received for Book ${bookId} from ${email}`, { type });

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
      status: type === 'digital' ? 'paid' : 'paid', // Both digital and physical go to 'paid' initially
      isDigitalUnlocked: true,
      customerEmail: session.customer_details?.email,
      updatedAt: new Date()
    };

    if (type === 'digital') {
      bookUpdate.status = 'pdf_ready'; // Digital orders go straight to pdf_ready
    }

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

    const internalUrl = `http://localhost:${process.env.PORT || 3001}`;
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

    // 3. FETCH LATEST BOOK TO CHECK FOR PLACEHOLDERS BEFORE PRINTING
    const bookRecord = await db.collection('books').findOne({ _id: new ObjectId(bookId) });

    const placeholders = bookRecord?.pages?.filter((p) =>
      !p.imageUrl ||
      p.imageUrl.includes('via.placeholder.com') ||
      p.imageUrl.includes('placeholder.png') ||
      p.imageUrl.includes('Painting+Page')
    );

    const hasPlaceholders = placeholders && placeholders.length > 0;

    if (hasPlaceholders) {
      logger.error('🚨🚨🚨 [CRITICAL FULFILLMENT ERROR] 🚨🚨🚨');
      logger.error(`Book ${bookId} contains MISSING or PLACEHOLDER IMAGES.`);
      logger.error('Missing Pages Summary:', placeholders.map((p) => ({
        pageNumber: p.pageNumber,
        urlPreview: p.imageUrl?.substring(0, 50) || 'NULL'
      })));
      logger.error('GELATO PRINTING ABORTED to prevent printing a defective book.');
      logger.error('Manual intervention required: Regenerate missing images and trigger printing manually.');

      await db.collection('books').updateOne(
        { _id: new ObjectId(bookId) },
        { $set: { status: 'fulfillment_error', error: 'Book contains placeholder images. Printing aborted.' } }
      );
      return;
    }

    // 4. Trigger Gelato fulfillment ONLY for physical books
    if (type === 'book') {
      const { triggerGelatoFulfillment } = require('./fulfillmentService');

      await triggerGelatoFulfillment({
        bookId,
        pdfUrl,
        shippingAddress: orderData.shippingAddress, // Use the shipping address from orderData
        db,
        orderReferenceId: `${bookId}-${session.id.slice(-6)}`,
        currency: session.currency?.toUpperCase() || 'AUD'
      });

      logger.info('📦 Gelato fulfillment initiated successfully');
    } else {
      logger.info('✨ [FULFILLMENT] Digital order complete. Skipping physical printing.');

      // For digital orders, send PDF ready email
      const { sendStoryEmail } = require('./mail');
      const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
      if (book && book.userId) {
        await sendStoryEmail(book.userId, book.title, pdfUrl);
        logger.info('📧 PDF ready email sent for digital order');
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

app.post('/api/create-checkout', async (req, res) => {
  try {
    const { bookId, bookTitle } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      phone_number_collection: { enabled: true },
      shipping_address_collection: { allowed_countries: [] }, // Blank array allows all countries supported by Stripe
      line_items: [{ price_data: { currency: BASE_CURRENCY, product_data: { name: `Hardcover: ${bookTitle}` }, unit_amount: PRINT_PRICE_AMOUNT }, quantity: 1 }],
      mode: 'payment',
      success_url: `${process.env.APP_URL}/success?bookId=${bookId}`,
      cancel_url: `${process.env.APP_URL}/`,
      metadata: { bookId }
    });
    res.json({ url: session.url });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

connectDB().then(() => {
  app.listen(port, () => {
    logger.info(`🚀 Engine Server running at http://localhost:${port}`);
  });
}).catch(err => {
  logger.error('Failed to connect to MongoDB:', err.message);
  process.exit(1);
});
