const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Storage } = require("@google-cloud/storage");
const { ObjectId } = require("mongodb");
const axios = require("axios");
const logger = require("./logger");

const STORY_REF_CONCURRENCY = parseInt(process.env.STORY_REF_CONCURRENCY || "5");
const STORY_REF_RETRIES = parseInt(process.env.STORY_REF_RETRIES || "5");
const STORY_REF_TIMEOUT_MS = parseInt(process.env.STORY_REF_TIMEOUT_MS || "120000");
const STORY_BATCH_DELAY_MS = parseInt(process.env.STORY_BATCH_DELAY_MS || "65000");
const TEASER_IMAGES_CONCURRENCY = parseInt(process.env.TEASER_IMAGES_CONCURRENCY || "3");
const TEASER_LIMIT = 7;

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
  const { prompt, negativePrompt, referenceImages, pageNumber, bucket, timeoutMs = 120000 } = params;
  const apiKey = process.env.GOOGLE_API_KEY;

  try {
    if (apiKey) {
      logger.info(`🤖 [Page ${pageNumber}] Attempting Gemini Pro...`);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });
      
      const parts = [{ text: prompt }];
      let hasImages = false;
      
      if (referenceImages && referenceImages.length > 0) {
        logger.info(`📸 [Page ${pageNumber}] Preparing ${referenceImages.length} references for Gemini...`);
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

            logger.debug(`📸 [Page ${pageNumber}] Resolved reference path: ${path}`);
            const file = bucket.file(path);
            const [metadata] = await file.getMetadata();
            const [buffer] = await file.download();
            
            parts.push({
              inlineData: {
                data: buffer.toString('base64'),
                mimeType: metadata.contentType || "image/png"
              }
            });
            hasImages = true;
            logger.debug(`📸 [Page ${pageNumber}] Attached: ${path} (${metadata.contentType}, size: ${Math.round(buffer.length / 1024)} KB)`);
          } catch (refError) {
            logger.warn(`⚠️ [Page ${pageNumber}] Reference Load Fail: ${refError.message}`);
          }
        }
      }

      logger.info(`📡 [Page ${pageNumber}] Sending Gemini request (Prompt length: ${prompt.length}, Parts: ${parts.length})...`);
      parts.forEach((part, idx) => {
        if (part.inlineData) {
          logger.info(`📦 Part ${idx} size: ${Math.round(part.inlineData.data.length / 1024)} KB`);
        }
      });

      let geminiAttempt = 0;
      let geminiResult = null;
      const finalPayload = hasImages ? parts : prompt;

      while (geminiAttempt < 2) {
        const startTime = Date.now();
        const heartbeat = setInterval(() => {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          logger.info(`💓 [Page ${pageNumber}] Still waiting for Gemini Pro... (${elapsed}s elapsed)`);
        }, 15000);

        try {
          logger.info(`⏳ [Page ${pageNumber}] Waiting for Gemini Pro to paint... (Attempt ${geminiAttempt + 1})`);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`Gemini API Timeout (${timeoutMs/1000}s)`)), timeoutMs));
          const result = await Promise.race([model.generateContent(finalPayload), timeoutPromise]);
          
          clearInterval(heartbeat);
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          logger.info(`✅ [Page ${pageNumber}] Gemini Pro finished painting in ${duration}s`);
          
          geminiResult = result.response;
          break;
        } catch (netErr) {
          clearInterval(heartbeat);
          geminiAttempt++;
          if (geminiAttempt < 2) {
            logger.warn(`🔄 [Page ${pageNumber}] Gemini network issue, retrying once... Error: ${netErr.message}`);
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }
          throw netErr;
        }
      }

      const response = geminiResult;
      if (response && response.candidates?.[0]?.finishReason === 'SAFETY') {
        logger.error(`🛡️ SAFETY ALERT: Page ${pageNumber} Gemini prompt was blocked.`);
        return { error: 'SAFETY_FILTER_BLOCK', status: 200 };
      }

      const imagePart = response?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (imagePart?.inlineData?.data) {
        logger.info(`📸 Image generated successfully by Gemini Pro (${imagePart.inlineData.data.length} chars)`);
        return { bytesBase64Encoded: imagePart.inlineData.data, status: 200 };
      }
      return { error: 'NO_IMAGE_DATA', status: 200 };
    } 
  } catch (err) {
    logger.error(`💥 [Page ${pageNumber}] Gemini Pro network error:`, err.message);
    return { error: 'NETWORK_ERROR', status: 500 };
  }
}

async function generateImages(db, bookId, isFulfillment = false) {
  const pid = process.pid;
  logger.info(`🎯 ========== FUNCTION STARTED ==========`);
  
  const bookRecord = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
  if (!bookRecord) {
    logger.error(`🎯 Book not found: ${bookId}`);
    throw new Error('Book not found in database');
  }

  const userEmail = bookRecord.email?.toLowerCase();
  logger.info(`🎯 Function execution continuing, book found`);
  logger.info(`🎯 DB Record Status: { status: "${bookRecord.status}", currentPages: ${bookRecord.pages?.length}, isDigitalUnlocked: ${bookRecord.isDigitalUnlocked} }`);

  const activeHeroBible = bookRecord.heroBible || '';
  const activeAnimalBible = bookRecord.animalBible || '';

  const storyPagesOnly = bookRecord.pages
    .filter((p) => !p.type || p.type === 'story')
    .slice(0, 23)
    .map((p) => ({ ...p, type: 'story' }));
  const pages = storyPagesOnly;

  logger.info(`📄 Number of Story Pages to Process: ${pages.length}`);
  if (pages.length < 5) logger.warn(`⚠️ Low page count detected (${pages.length}).`);

  pages.forEach((page, index) => {
    logger.info(`📄 Page ${index + 1} Pre-processing:`, { pageNumber: page.pageNumber, textLength: page.text?.length || 0, hasImageUrl: !!page.imageUrl });
  });

  const storage = new Storage({projectId: process.env.GCP_PROJECT_ID});
  const bucket = storage.bucket(process.env.GCS_IMAGES_BUCKET_NAME);

  logger.info('📸 STEP 1: RESOLVING REFERENCE IMAGES (PARALLEL MEGA-RACE)');
  
  async function generateReferenceImageRace(bible, type, photoUrl, style) {
    const fileName = `books/${bookId}/${type}_reference.png`;
    const file = bucket.file(fileName);
    const existing = await file.exists();
    if (existing[0]) {
      const [signedUrl] = await file.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 60 * 60 * 1000 });
      logger.info(`📸 ${type} reference image already exists (signed): ${signedUrl.substring(0, 50)}...`);
      return signedUrl;
    }

    const prompt = `${bible}. A professional storybook illustration in ${style || 'children\'s book illustration'}. This is a reference portrait of the ${type} character, front view, neutral expression, centered composition.`;
    
    let raceAttempt = 0;
    while (raceAttempt < STORY_REF_RETRIES) {
      const concurrency = Math.min(raceAttempt + 1, STORY_REF_CONCURRENCY);
      logger.info(`🚀 [${type.toUpperCase()}_RACE] Starting Batch ${raceAttempt + 1}/${STORY_REF_RETRIES} (${concurrency} runners)...`);
      try {
        const runners = Array.from({ length: concurrency }).map(async (_, idx) => {
          const res = await callGeminiImageGen({ prompt, referenceImages: (photoUrl && type === 'hero') ? [{ uri: photoUrl }] : undefined, bucket, pageNumber: `${type}_batch${raceAttempt + 1}_runner${idx + 1}`, timeoutMs: STORY_REF_TIMEOUT_MS });
          if (res && res.bytesBase64Encoded) return res.bytesBase64Encoded;
          throw new Error(`Empty response`);
        });
        const winner = await Promise.any(runners);
        if (winner) {
          await file.save(Buffer.from(winner, "base64"), { metadata: { contentType: "image/png" } });
          const [signedUrl] = await file.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 60 * 60 * 1000 });
          logger.info(`✅ [${type.toUpperCase()}_RACE] Winner found in Batch ${raceAttempt + 1}!`);
          await db.collection('images').updateOne({ bookId: new ObjectId(bookId), type: `${type}_reference` }, { $set: { gcsUrl: `https://storage.googleapis.com/${process.env.GCS_IMAGES_BUCKET_NAME}/${fileName}`, updatedAt: new Date(), model: 'gemini' } }, { upsert: true });
          return signedUrl;
        }
      } catch (e) {
        raceAttempt++;
        const isOverloaded = e.message?.includes('503') || e.message?.includes('MODEL_OVERLOADED');
        const wait = isOverloaded ? 15000 : 150000;
        logger.info(`⏳ [${type.toUpperCase()}_RACE] Waiting ${wait/1000}s before next batch...`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
    throw new Error(`❌ [${type.toUpperCase()}_RACE] Failed all batches`);
  }

  const [heroRefUrl, animalRefUrl] = await Promise.all([
    generateReferenceImageRace(activeHeroBible, 'hero', bookRecord.photoUrl, bookRecord.characterStyle),
    generateReferenceImageRace(activeAnimalBible, 'animal', null, bookRecord.characterStyle)
  ]);

  logger.info('🏗️ STEP 2: CONSTRUCTING MASTER ARRAY (27 Pages)');
  const masterPages = [];
  masterPages.push({ pageNumber: 1, type: 'photo', text: bookRecord.photoUrl ? `Look, here is the real you!` : `Look, here is you as a storybook hero!`, url: bookRecord.photoUrl || heroRefUrl, imageUrl: bookRecord.photoUrl || heroRefUrl, prompt: `The real photo of the child` });
  masterPages.push({ pageNumber: 2, type: 'story', text: `Once upon a time, your adventure began right here!`, prompt: `Our hero child ${bookRecord.childName} is standing in the ${bookRecord.location || 'beautiful landscape'}, looking at the horizon with a bright smile, ready for a big adventure.` });
  masterPages.push({ pageNumber: 3, type: 'story', text: `Meet your brave friend, ${bookRecord.animal}!`, imageUrl: animalRefUrl, prompt: `The animal character friend` });
  pages.forEach((p, idx) => { masterPages.push({ ...p, type: 'story', pageNumber: idx + 4 }); });
  masterPages.push({ pageNumber: masterPages.length + 1, type: 'story', text: "The End. May your adventures never truly end!", prompt: bookRecord.finalPrompt || `A heartwarming final interaction scene between the child hero and their animal friend.` });

  logger.info(`📊 Master array constructed: ${masterPages.length} pages total`);
  logger.info('💾 Initializing DB with master array structure...');
  await db.collection('books').updateOne({ _id: new ObjectId(bookId) }, { $set: { pages: masterPages, updatedAt: new Date() } });

  const updatedPages = [...masterPages];
  const referenceImages = [];
  const heroUri = getGcsUriFromUrl(bookRecord.photoUrl || heroRefUrl);
  const animalUri = getGcsUriFromUrl(animalRefUrl);
  if (heroUri) referenceImages.push({ uri: heroUri });
  if (animalUri) referenceImages.push({ uri: animalUri });

  async function paintPageWithRetry(pageIndex) {
    const page = updatedPages[pageIndex];
    const isActuallyPainted = page.imageUrl && (page.imageUrl.includes('X-Goog-Signature') || page.imageUrl.includes('/books/') || page.imageUrl.includes('/uploads/')) && !page.imageUrl.includes('placeholder') && !page.imageUrl.includes('Painting+Page');

    if (isActuallyPainted) {
      logger.info(`⏭️ [Page ${page.pageNumber}] Skipping (already painted)`);
      await db.collection('images').updateOne({ bookId: new ObjectId(bookId), pageNumber: page.pageNumber }, { $set: { gcsUrl: page.imageUrl, updatedAt: new Date(), model: 'previously_painted' } }, { upsert: true });
      return true;
    }

    let cycle = 0;
    while (cycle < 5) {
      const concurrency = pageIndex < TEASER_LIMIT ? Math.min(cycle + 1, TEASER_IMAGES_CONCURRENCY) : 1;
      logger.info(`🎨 [Page ${page.pageNumber}] Painting Cycle ${cycle + 1}/5 (${concurrency} runners)...`);
      
      try {
        let charInstr = `Ref 1 is the child hero. Ref 2 is their animal friend. (CRITICAL: Refer to these references for character appearance to ensure 100% visual consistency). Please depict both interacting naturally.`;
        if (page.pageNumber === 2) charInstr = `Refer to Ref 1 for the child hero's appearance. (CRITICAL: Only the child hero should be in this scene, no animal friend yet).`;
        else if (page.pageNumber === 3) charInstr = `Refer to Ref 2 for the animal friend's appearance. (CRITICAL: Only the animal friend should be in this scene, no child hero yet).`;

        const prompt = `Wholesome children's book illustration. Style: ${bookRecord.characterStyle}. ${activeHeroBible} ${activeAnimalBible}. ${charInstr} Scene: ${page.prompt}`;

        const runners = Array.from({ length: concurrency }).map(async (_, rIdx) => {
          const res = await callGeminiImageGen({ prompt, negativePrompt: "distorted features, scary, dark themes, blurry, low resolution, missing limbs, extra fingers, realistic, photograph", referenceImages, bucket, pageNumber: `p${page.pageNumber}_c${cycle + 1}_r${rIdx + 1}` });
          if (res && res.bytesBase64Encoded) return res.bytesBase64Encoded;
          throw new Error(`Runner failed`);
        });

        const firstSuccessBase64 = await Promise.any(runners);
        if (firstSuccessBase64) {
          const fileName = `books/${bookId}/page_${page.pageNumber}.png`;
          await bucket.file(fileName).save(Buffer.from(firstSuccessBase64, 'base64'), { metadata: { contentType: 'image/png' } });
          const [signedUrl] = await bucket.file(fileName).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 60 * 60 * 1000 });
          
          const timestamp = Date.now();
          updatedPages[pageIndex].imageUrl = `${signedUrl}?v=${timestamp}`;

          await Promise.all([
            db.collection('books').updateOne({ _id: new ObjectId(bookId) }, { $set: { [`pages.${pageIndex}`]: updatedPages[pageIndex], pdfUrl: '', updatedAt: new Date() } }),
            db.collection('images').updateOne({ bookId: new ObjectId(bookId), pageNumber: page.pageNumber }, { $set: { gcsUrl: `https://storage.googleapis.com/${process.env.GCS_IMAGES_BUCKET_NAME}/${fileName}`, updatedAt: new Date(), model: 'gemini' } }, { upsert: true })
          ]);
          logger.info(`✅ [Page ${page.pageNumber}] Success! (Atomic sync complete)`);
          return true;
        }
      } catch (e) {
        cycle++;
        const isOverloaded = e.message?.includes('503') || e.message?.includes('MODEL_OVERLOADED');
        const wait = isOverloaded ? 15000 : (10000 * cycle);
        logger.info(`⏳ [Page ${page.pageNumber}] Waiting ${wait/1000}s before next cycle...`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
    return false;
  }

  logger.info(`🚀 FIRING TEASER BATCH: 7 pages (Indices 0-6)...`);
  await Promise.all(masterPages.map((_, i) => i).filter(i => i < TEASER_LIMIT).map(idx => paintPageWithRetry(idx)));
  logger.info(`✅ TEASER BATCH COMPLETE.`);

  if (isFulfillment) {
    logger.info(`🚀 FIRING REGULAR BATCHES with a ${STORY_BATCH_DELAY_MS / 1000}s fire-and-forget delay...`);
    const regularIndices = masterPages.map((_, i) => i).filter(i => i >= TEASER_LIMIT);
    const BATCH_SIZE = 18;
    const allBatchPromises = [];
    for (let i = 0; i < regularIndices.length; i += BATCH_SIZE) {
      const chunk = regularIndices.slice(i, i + BATCH_SIZE);
      const batchPromise = Promise.all(chunk.map(idx => paintPageWithRetry(idx)));
      allBatchPromises.push(batchPromise);
      if (i + BATCH_SIZE < regularIndices.length) {
        logger.info(`⏳ Batch Fired. Starting ${STORY_BATCH_DELAY_MS / 1000}s timer for the next batch...`);
        await new Promise(r => setTimeout(r, STORY_BATCH_DELAY_MS));
      }
    }
    await Promise.all(allBatchPromises);
    logger.info(`✅ All regular batches have now completed.`);
  }

  logger.info(`💾 ========== STEP 4: FINALIZING BOOK DOCUMENT ==========`);
  const finalStatus = isFulfillment ? 'preview' : 'teaser';
  await db.collection('books').updateOne({ _id: new ObjectId(bookId) }, { $set: { status: finalStatus, updatedAt: new Date() } });
  
  if (userEmail) {
    await db.collection('users').updateOne({ email: userEmail, "recentBooks.id": bookId }, { $set: { "recentBooks.$.status": finalStatus, "recentBooks.$.isDigitalUnlocked": true, updatedAt: new Date() } });
    logger.info(`🎯 [GenerateImages][PID:${pid}] Dashboard Sync: Triggered for ${userEmail}`);
  }

  if (isFulfillment) {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    logger.info(`🚀 Triggering background PDF generation for book: ${bookId}`);
    axios.post(`${baseUrl}/api/generate-pdf`, { bookId }).catch(e => logger.error(`⚠️ Auto-PDF fail: ${e.message}`));
  }

  const pagesWithImages = updatedPages.filter(p => p.imageUrl && !p.imageUrl.includes('placeholder')).length;
  logger.info(`📊 FINAL RESULTS: Total=${updatedPages.length}, WithImages=${pagesWithImages}`);
  logger.info(`🎯 [LIFECYCLE_TRACKER] PAINTING_COMPLETE: Book ${bookId}`);
  logger.info(`🎯 [GenerateImages][PID:${pid}] Execution complete.`);
}

module.exports = { generateImages };
