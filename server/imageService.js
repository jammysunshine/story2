const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Storage } = require("@google-cloud/storage");
const { ObjectId } = require("mongodb");
const logger = require("./logger");

const STORY_REF_CONCURRENCY = parseInt(process.env.STORY_REF_CONCURRENCY || "3");
const STORY_REF_RETRIES = parseInt(process.env.STORY_REF_RETRIES || "5");
const STORY_REF_TIMEOUT_MS = parseInt(process.env.STORY_REF_TIMEOUT_MS || "120000");
const STORY_BATCH_DELAY_MS = parseInt(process.env.STORY_BATCH_DELAY_MS || "90000");
const TEASER_LIMIT = 7;

/**
 * Helper to convert storage URLs to gs:// URIs for Gemini
 */
const getGcsUriFromUrl = (urlStr) => {
  try {
    if (!urlStr) return null;
    if (urlStr.startsWith('gs://')) return urlStr;
    const url = new URL(urlStr);
    const path = url.pathname.replace(/^\//, '');
    return `gs://${path}`;
  } catch (e) {
    const parts = urlStr.split('storage.googleapis.com/')[1];
    return parts ? `gs://${parts.split('?')[0]}` : null;
  }
};

async function callGeminiImageGen(params) {
  const { prompt, referenceImages, pageNumber, bucket } = params;
  const apiKey = process.env.GOOGLE_API_KEY;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview" });

    const parts = [{ text: prompt }];

    if (referenceImages && referenceImages.length > 0) {
      for (const ref of referenceImages) {
        try {
          const path = ref.uri.replace(`gs://${process.env.GCS_IMAGES_BUCKET_NAME}/`, "");
          const [buffer] = await bucket.file(path).download();
          const [metadata] = await bucket.file(path).getMetadata();
          parts.push({
            inlineData: {
              data: buffer.toString("base64"),
              mimeType: metadata.contentType || "image/png",
            },
          });
        } catch (e) {
          logger.warn(`⚠️ [Page ${pageNumber}] Ref load fail: ${e.message}`);
        }
      }
    }

    const result = await model.generateContent(parts.length > 1 ? parts : prompt);
    const response = await result.response;
    
    if (response && response.candidates?.[0]?.finishReason === 'SAFETY') {
        logger.error(`🛡️ SAFETY ALERT: Page ${pageNumber} Gemini prompt was blocked.`);
        return null;
    }

    const imagePart = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    return imagePart?.inlineData?.data || null;
  } catch (err) {
    throw err;
  }
}

async function paintPageWithRace(params) {
  const { bookId, pageNumber, prompt, referenceImages, bucket, concurrency = 2 } = params;

  let attempt = 0;
  while (attempt < STORY_REF_RETRIES) {
    logger.info(`🚀 [Page ${pageNumber}] Race attempt ${attempt + 1}/${STORY_REF_RETRIES} (${concurrency} runners)...`);
    
    try {
      const runners = Array.from({ length: concurrency }).map(async (_, idx) => {
        return await callGeminiImageGen({
          prompt,
          referenceImages,
          pageNumber: `${pageNumber}_r${idx}`,
          bucket
        });
      });

      const winnerBase64 = await Promise.any(runners.map(p => p.then(res => {
          if (!res) throw new Error("No data");
          return res;
      })));

      if (winnerBase64) {
        const buffer = Buffer.from(winnerBase64, "base64");
        const fileName = `books/${bookId}/page_${pageNumber}.png`;
        const file = bucket.file(fileName);
        await file.save(buffer, { metadata: { contentType: "image/png" } });
        
        const [signedUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000,
        });
        return signedUrl;
      }
    } catch (e) {
      logger.warn(`⚠️ [Page ${pageNumber}] Race failed: ${e.message}`);
      attempt++;
      if (attempt < STORY_REF_RETRIES) await new Promise(r => setTimeout(r, 10000));
    }
  }
  return null;
}

async function generateImages(db, bookId, isFulfillment = false) {
  const pid = process.pid;
  logger.info(`🎯 ========== FULL ENGINE STARTED [PID:${pid}] ==========`);

  const book = await db.collection("books").findOne({ _id: new ObjectId(bookId) });
  if (!book) throw new Error("Book not found");

  const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
  const bucket = storage.bucket(process.env.GCS_IMAGES_BUCKET_NAME);

  // 1. RESOLVE CHARACTER PORTRAITS
  logger.info("📸 STEP 1: RESOLVING REFERENCE PORTRAITS");
  
  const heroPrompt = `${book.heroBible}. Professional storybook illustration, ${book.characterStyle}. Centered character portrait, neutral expression, front view.`;
  const animalPrompt = `${book.animalBible}. Professional storybook illustration, ${book.characterStyle}. Centered animal portrait, neutral expression, front view.`;

  const [heroRefUrl, animalRefUrl] = await Promise.all([
    paintPageWithRace({ bookId, pageNumber: 'hero_ref', prompt: heroPrompt, bucket, concurrency: 2 }),
    paintPageWithRace({ bookId, pageNumber: 'animal_ref', prompt: animalPrompt, bucket, concurrency: 2 })
  ]);

  // SYNC REFERENCES TO IMAGES COLLECTION
  const syncRef = async (type, url) => {
      if (!url) return;
      await db.collection('images').updateOne(
          { bookId: new ObjectId(bookId), type: `${type}_reference` },
          { $set: { gcsUrl: url.split('?')[0], updatedAt: new Date(), model: 'gemini' } },
          { upsert: true }
      );
  };
  await Promise.all([syncRef('hero', heroRefUrl), syncRef('animal', animalRefUrl)]);

  // 2. CONSTRUCT MASTER ARRAY
  logger.info("🏗️ STEP 2: CONSTRUCTING MASTER ARRAY");
  const masterPages = [];
  
  if (book.photoUrl) {
    masterPages.push({
      pageNumber: 1, type: 'photo',
      text: `Look, here is the real you! Ready to start the story?`,
      url: book.photoUrl, imageUrl: book.photoUrl,
      prompt: `The real photo of the child`
    });
  } else {
    masterPages.push({
      pageNumber: 1, type: 'photo',
      text: `Look, here is you as a storybook hero! Ready to start?`,
      url: heroRefUrl, imageUrl: heroRefUrl,
      prompt: `Stylized character portrait`
    });
  }

  masterPages.push({
    pageNumber: 2, type: 'story',
    text: `Once upon a time, your adventure began right here in the ${book.location}!`,
    prompt: `Hero standing in ${book.location}, looking excited.`
  });

  masterPages.push({
    pageNumber: 3, type: 'story',
    text: `Meet your brave friend, the ${book.animal}!`,
    imageUrl: animalRefUrl,
    prompt: `Portrait of the animal friend`
  });

  book.pages.forEach((p, idx) => {
    masterPages.push({ ...p, type: 'story', pageNumber: idx + 4 });
  });

  masterPages.push({
    pageNumber: masterPages.length + 1, type: 'story',
    text: "The End. May your adventures never truly end!",
    prompt: book.finalPrompt || `Heartwarming final scene.`
  });

  await db.collection('books').updateOne(
    { _id: new ObjectId(bookId) },
    { $set: { pages: masterPages, updatedAt: new Date() } }
  );

  const referenceImages = [];
  const heroUri = getGcsUriFromUrl(book.photoUrl || heroRefUrl);
  const animalUri = getGcsUriFromUrl(animalRefUrl);
  if (heroUri) referenceImages.push({ uri: heroUri });
  if (animalUri) referenceImages.push({ uri: animalUri });

  // 3. PAINTING BATCHES
  const paintPage = async (idx) => {
    const page = masterPages[idx];
    if (page.imageUrl && !page.imageUrl.includes('placeholder') && !page.imageUrl.includes('via.placeholder')) return;

    let charInstr = `Ref 1 is the child hero. Ref 2 is their animal friend. Refer to these for visual consistency. Depict both interacting naturally.`;
    if (page.pageNumber === 2) charInstr = `Refer to Ref 1 for the child's appearance. Only the child hero should be in this scene.`;

    const prompt = `Wholesome children's book illustration. Style: ${book.characterStyle}. ${book.heroBible} ${book.animalBible}. ${charInstr} Scene: ${page.prompt}`;
    
    const signedUrl = await paintPageWithRace({ bookId, pageNumber: page.pageNumber, prompt, referenceImages, bucket });
    
    if (signedUrl) {
      const gcsUrl = signedUrl.split('?')[0];
      await Promise.all([
        db.collection("books").updateOne(
          { _id: new ObjectId(bookId) },
          { $set: { [`pages.${idx}.imageUrl`]: signedUrl, updatedAt: new Date() } }
        ),
        db.collection('images').updateOne(
          { bookId: new ObjectId(bookId), pageNumber: page.pageNumber },
          { $set: { gcsUrl, updatedAt: new Date(), model: 'gemini' } },
          { upsert: true }
        )
      ]);
      logger.info(`✅ [Page ${page.pageNumber}] Success! (Atomic sync complete)`);
    }
  };

  const teaserIndices = masterPages.map((_, i) => i).filter(i => i < TEASER_LIMIT);
  await Promise.all(teaserIndices.map(idx => paintPage(idx)));

  if (isFulfillment) {
    const regularIndices = masterPages.map((_, i) => i).filter(i => i >= TEASER_LIMIT);
    const BATCH_SIZE = 18;
    for (let i = 0; i < regularIndices.length; i += BATCH_SIZE) {
      const chunk = regularIndices.slice(i, i + BATCH_SIZE);
      logger.info(`📦 Firing Batch ${Math.floor(i/BATCH_SIZE) + 1}...`);
      await Promise.all(chunk.map(idx => paintPage(idx)));
      if (i + BATCH_SIZE < regularIndices.length) {
        logger.info(`⏳ Rate-limit safety wait (${STORY_BATCH_DELAY_MS/1000}s)...`);
        await new Promise(r => setTimeout(r, STORY_BATCH_DELAY_MS));
      }
    }
  }

  // FINAL SYNC
  const finalBook = await db.collection('books').findOneAndUpdate(
      { _id: new ObjectId(bookId) },
      { $set: { status: isFulfillment ? 'preview' : 'teaser', updatedAt: new Date() } },
      { returnDocument: 'after' }
  );

  if (book.email) {
      await db.collection('users').updateOne(
          { email: book.email.toLowerCase(), "recentBooks.id": bookId },
          { $set: { "recentBooks.$.status": finalBook.value?.status || 'teaser', updatedAt: new Date() } }
      ).catch(e => logger.error('User sync fail:', e.message));
  }

  logger.info(`🎯 [GenerateImages] Execution complete for Book: ${bookId}`);
}

module.exports = { generateImages };