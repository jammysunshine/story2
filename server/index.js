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

// --- GLOBAL SAFETY NETS ---
process.on('uncaughtException', (err) => {
  logger.error('🔥 CRITICAL: Uncaught Exception!', { message: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('🔥 CRITICAL: Unhandled Rejection!', { reason: reason?.message || reason, stack: reason?.stack });
});

const upload = multer({ storage: multer.memoryStorage() });
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhook') next();
  else express.json({ limit: '10mb' })(req, res, next);
});
app.use(cors());

const port = process.env.PORT || 3001;
const TEASER_LIMIT = parseInt(process.env.STORY_TEASER_PAGES_COUNT || '7');

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
  const { email } = req.query;
  try {
    const orders = await db.collection('orders').find({ email }).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, orders });
  } catch (error) { res.status(500).json({ error: error.message }); }
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

connectDB().then(() => {
  app.listen(port, () => {
    logger.info(`🚀 Engine Server running at http://localhost:${port}`);
  });
}).catch(err => {
  logger.error('Failed to connect to MongoDB:', err.message);
  process.exit(1);
});
