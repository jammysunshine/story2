const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Storage } = require("@google-cloud/storage");
const { ObjectId } = require("mongodb");
const axios = require("axios");
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
  const { prompt, referenceImages, pageNumber, bucket, timeoutMs = 120000 } = params;
  const apiKey = process.env.GOOGLE_API_KEY;

  let geminiAttempt = 0;
  let geminiResult = null;

  while (geminiAttempt < 2) {
    const startTime = Date.now();
    const heartbeat = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      logger.info(`💓 [Page ${pageNumber}] Still waiting for Gemini Pro... (${elapsed}s elapsed)`);
    }, 15000);

    try {
      logger.info(`🤖 [Page ${pageNumber}] Attempting Gemini Pro... (Attempt ${geminiAttempt + 1})`);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview" });

      const parts = [{ text: prompt }];
      let hasImages = false;

      if (referenceImages && referenceImages.length > 0) {
        for (const ref of referenceImages) {
          try {
            const bucketName = process.env.GCS_IMAGES_BUCKET_NAME;
            let path = '';
            if (ref.uri.startsWith('gs://')) {
              path = ref.uri.replace(`gs://${bucketName}/`, '');
            } else if (ref.uri.includes('storage.googleapis.com')) {
              const urlParts = ref.uri.split('storage.googleapis.com/')[1];
              path = urlParts.startsWith(`${bucketName}/`) ? urlParts.replace(`${bucketName}/`, '').split('?')[0] : urlParts.split('?')[0];
            } else {
              path = ref.uri;
            }

            const [metadata] = await bucket.file(path).getMetadata();
            const [buffer] = await bucket.file(path).download();
            parts.push({
              inlineData: {
                data: buffer.toString("base64"),
                mimeType: metadata.contentType || "image/png",
              },
            });
            hasImages = true;
          } catch (e) {
            logger.warn(`⚠️ [Page ${pageNumber}] Ref load fail: ${e.message}`);
          }
        }
      }

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`Gemini API Timeout (${timeoutMs/1000}s)`)), timeoutMs));
      const result = await Promise.race([model.generateContent(hasImages ? parts : prompt), timeoutPromise]);
      
      clearInterval(heartbeat);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`✅ [Page ${pageNumber}] Gemini Pro finished painting in ${duration}s`);
      
      geminiResult = result.response;
      break;
    } catch (err) {
      clearInterval(heartbeat);
      geminiAttempt++;
      if (geminiAttempt < 2) {
        logger.warn(`🔄 [Page ${pageNumber}] Gemini network issue, retrying once... Error: ${err.message}`);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      throw err;
    }
  }

  const response = geminiResult;
  if (response && response.candidates?.[0]?.finishReason === 'SAFETY') {
    logger.error(`🛡️ SAFETY ALERT: Page ${pageNumber} Gemini prompt was blocked.`);
    return null;
  }

  const imagePart = response?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  return imagePart?.inlineData?.data || null;
}

async function generateImages(db, bookId, isFulfillment = false) {
  const pid = process.pid;
  logger.info(`🎯 ========== FUNCTION STARTED [PID:${pid}] ==========`);
  logger.info(`🎯 Params: { pagesCount: unknown, isFulfillment: ${isFulfillment} }`);

  const book = await db.collection("books").findOne({ _id: new ObjectId(bookId) });
  if (!book) throw new Error("Book not found");

  const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
  const bucket = storage.bucket(process.env.GCS_IMAGES_BUCKET_NAME);

  // 1. RESOLVE CHARACTER REFERENCES
  logger.info(`📸 [GenerateImages][PID:${pid}] STEP 1: RESOLVING REFERENCE IMAGES`);
  
  async function generateReferenceImageRace(bible, type) {
    const fileName = `books/${bookId}/${type}_reference.png`;
    const file = bucket.file(fileName);
    const existing = await file.exists();
    if (existing[0]) return `https://storage.googleapis.com/${process.env.GCS_IMAGES_BUCKET_NAME}/${fileName}`;

    const prompt = `${bible}. Professional storybook illustration, ${book.characterStyle}. Centered character portrait, neutral expression, front view.`;
    
    let raceAttempt = 0;
    while (raceAttempt < STORY_REF_RETRIES) {
      const concurrency = Math.min(raceAttempt + 1, STORY_REF_CONCURRENCY);
      try {
        const runners = Array.from({ length: concurrency }).map(async (_, idx) => {
          return await callGeminiImageGen({
            prompt, bucket, pageNumber: `${type}_race${raceAttempt}_r${idx}`, timeoutMs: STORY_REF_TIMEOUT_MS
          });
        });
        const winnerBase64 = await Promise.any(runners.map(p => p.then(res => { if (!res) throw new Error("No data"); return res; })));
        if (winnerBase64) {
          await file.save(Buffer.from(winnerBase64, "base64"), { metadata: { contentType: "image/png" } });
          const url = `https://storage.googleapis.com/${process.env.GCS_IMAGES_BUCKET_NAME}/${fileName}`;
          await db.collection('images').updateOne({ bookId: new ObjectId(bookId), type: `${type}_reference` }, { $set: { gcsUrl: url, updatedAt: new Date(), model: 'gemini' } }, { upsert: true });
          return url;
        }
      } catch (e) {
        raceAttempt++;
        await new Promise(r => setTimeout(r, 10000));
      }
    }
    throw new Error(`Failed to generate ${type} reference`);
  }

  const [heroRefUrl, animalRefUrl] = await Promise.all([
    generateReferenceImageRace(book.heroBible, 'hero'),
    generateReferenceImageRace(book.animalBible, 'animal')
  ]);

  // 2. MASTER ARRAY
  logger.info(`🏗️ [GenerateImages][PID:${pid}] STEP 2: CONSTRUCTING MASTER ARRAY`);
  const masterPages = [];
  masterPages.push({ pageNumber: 1, type: 'photo', text: book.photoUrl ? `Look, here is the real you!` : `Look, here is you as a storybook hero!`, imageUrl: book.photoUrl || heroRefUrl, prompt: `Portrait` });
  
  const introPrompt = `Our hero child ${book.childName} is standing in the ${book.location || 'beautiful landscape'}, looking at the horizon with a bright smile, ready for a big adventure. Bathed in the ${book.characterStyle} aesthetic.`;
  masterPages.push({ pageNumber: 2, type: 'story', text: `Once upon a time, your adventure began right here!`, prompt: introPrompt });
  
  masterPages.push({ pageNumber: 3, type: 'story', text: `Meet your brave friend, ${book.animal}!`, imageUrl: animalRefUrl, prompt: `Animal friend` });
  
  book.pages.forEach((p, idx) => { masterPages.push({ ...p, type: 'story', pageNumber: idx + 4 }); });
  masterPages.push({ pageNumber: masterPages.length + 1, type: 'story', text: "The End. May your adventures never truly end!", prompt: book.finalPrompt || `Final interaction scene.` });

  await db.collection('books').updateOne({ _id: new ObjectId(bookId) }, { $set: { pages: masterPages, updatedAt: new Date() } });

  const referenceImages = [];
  if (heroRefUrl) referenceImages.push({ uri: getGcsUriFromUrl(book.photoUrl || heroRefUrl) });
  if (animalRefUrl) referenceImages.push({ uri: getGcsUriFromUrl(animalRefUrl) });

  // 3. PAINTING ENGINE
  const paintPageWithRetry = async (idx) => {
    const page = masterPages[idx];
    if (page.imageUrl && !page.imageUrl.includes('placeholder')) return true;

    let cycle = 0;
    const MAX_CYCLES = 5;
    while (cycle < MAX_CYCLES) {
      const concurrency = idx < TEASER_LIMIT ? Math.min(cycle + 1, 3) : 1;
      logger.info(`🎨 [Page ${page.pageNumber}] Painting Cycle ${cycle + 1}/${MAX_CYCLES} (${concurrency} runners)...`);
      
      try {
        let charInstr = `Ref 1 is child, Ref 2 is animal. Visual consistency.`;
        if (page.pageNumber === 2) charInstr = `Ref 1 is child. Only child in scene.`;
        const prompt = `Style: ${book.characterStyle}. ${book.heroBible} ${book.animalBible}. ${charInstr} Scene: ${page.prompt}`;

        const runners = Array.from({ length: concurrency }).map(async (_, rIdx) => {
          return await callGeminiImageGen({ prompt, referenceImages, pageNumber: `p${page.pageNumber}_c${cycle}_r${rIdx}`, bucket });
        });

        const winnerBase64 = await Promise.any(runners.map(p => p.then(res => { if (!res) throw new Error("No data"); return res; })));
        if (winnerBase64) {
          const fileName = `books/${bookId}/page_${page.pageNumber}.png`;
          await bucket.file(fileName).save(Buffer.from(winnerBase64, "base64"), { metadata: { contentType: "image/png" } });
          const signedUrl = (await bucket.file(fileName).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 60 * 60 * 1000 }))[0];
          
          await Promise.all([
            db.collection("books").updateOne({ _id: new ObjectId(bookId) }, { $set: { [`pages.${idx}.imageUrl`]: signedUrl, updatedAt: new Date() } }),
            db.collection('images').updateOne({ bookId: new ObjectId(bookId), pageNumber: page.pageNumber }, { $set: { gcsUrl: signedUrl.split('?')[0], updatedAt: new Date(), model: 'gemini' } }, { upsert: true })
          ]);
          logger.info(`✅ [Page ${page.pageNumber}] Success! [PID:${pid}]`);
          return true;
        }
      } catch (e) {
        logger.warn(`⚠️ [Page ${page.pageNumber}] Cycle ${cycle + 1} failed: ${e.message}`);
        cycle++;
        await new Promise(r => setTimeout(r, 10000 * cycle));
      }
    }
    return false;
  };

  // TEASER
  logger.info(`🚀 [GenerateImages][PID:${pid}] FIRING TEASER BATCH`);
  const teaserIndices = masterPages.map((_, i) => i).filter(i => i < TEASER_LIMIT);
  await Promise.all(teaserIndices.map(idx => paintPageWithRetry(idx)));

  // REGULAR
  if (isFulfillment) {
    logger.info(`🚀 [GenerateImages][PID:${pid}] FIRING REGULAR BATCHES`);
    const regularIndices = masterPages.map((_, i) => i).filter(i => i >= TEASER_LIMIT);
    const BATCH_SIZE = 18;
    for (let i = 0; i < regularIndices.length; i += BATCH_SIZE) {
      const chunk = regularIndices.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk.map(idx => paintPageWithRetry(idx)));
      if (i + BATCH_SIZE < regularIndices.length) await new Promise(r => setTimeout(r, STORY_BATCH_DELAY_MS));
    }
  }

  // FINALIZATION
  const finalStatus = isFulfillment ? 'preview' : 'teaser';
  await db.collection('books').updateOne({ _id: new ObjectId(bookId) }, { $set: { status: finalStatus, updatedAt: new Date() } });
  
  if (book.email) {
    await db.collection('users').updateOne({ email: book.email.toLowerCase(), "recentBooks.id": bookId }, { $set: { "recentBooks.$.status": finalStatus, updatedAt: new Date() } });
    logger.info(`🎯 [GenerateImages][PID:${pid}] Dashboard Sync complete for ${book.email}`);
  }

  if (isFulfillment) {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    axios.post(`${baseUrl}/api/generate-pdf`, { bookId }).catch(e => logger.error(`⚠️ Auto-PDF fail: ${e.message}`));
  }

  logger.info(`🎯 [LIFECYCLE_TRACKER] PAINTING_COMPLETE: Book ${bookId}`);
}

module.exports = { generateImages };
