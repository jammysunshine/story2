const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Storage } = require("@google-cloud/storage");
const { GoogleAuth } = require("google-auth-library");
const { ObjectId } = require("mongodb");
const axios = require("axios");
const dotenv = require("dotenv");
const logger = require("./logger");

// Restored shared constants (matching story1/src/lib/constants.ts)
const IMAGE_COST = parseInt(process.env.IMAGE_COST || '2');
const STORY_COST = parseInt(process.env.STORY_COST || '10');
const PDF_COST = parseInt(process.env.PDF_COST || '15');
const BOOK_COST = parseInt(process.env.PRINT_PRICE_AMOUNT || '2500');
const TEASER_LIMIT = parseInt(process.env.STORY_TEASER_PAGES_COUNT || '7');

/**
 * Core image generation logic using Gemini Pro exclusively.
 * Restored 100% of the original logic, heartbeats, and logging.
 */
async function callGeminiImageGen(params) {
  const { prompt, referenceImages, accessToken, bucket, log, pageNumber, timeoutMs = 120000 } = params;
  
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (apiKey) {
      log.info(`🤖 [Page ${pageNumber}] Attempting Gemini Pro...`);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: process.env.GOOGLE_IMAGE_MODEL || 'gemini-2.5-flash-image' });
      
      const parts = [{ text: prompt }];
      let hasImages = false;
      
      if (referenceImages && referenceImages.length > 0) {
        log.info(`📸 [Page ${pageNumber}] Preparing ${referenceImages.length} references for Gemini...`);
        for (const ref of referenceImages) {
          try {
            const bucketName = process.env.GCS_IMAGES_BUCKET_NAME;
            
            // 100% ORIGINAL SMART PATH EXTRACTION
            let path = '';
            if (ref.uri.startsWith('gs://')) {
              path = ref.uri.replace(`gs://${bucketName}/`, '');
            } else if (ref.uri.includes('storage.googleapis.com')) {
              const urlParts = ref.uri.split('storage.googleapis.com/')[1];
              path = urlParts.startsWith(`${bucketName}/`) 
                ? urlParts.replace(`${bucketName}/`, '').split('?')[0]
                : urlParts.split('?')[0];
            } else {
              path = ref.uri;
            }

            log.debug(`📸 [Page ${pageNumber}] Resolved reference path: ${path}`);
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
            log.debug(`📸 [Page ${pageNumber}] Attached: ${path} (${metadata.contentType}, size: ${Math.round(buffer.length / 1024)} KB)`);
          } catch (refError) {
            log.warn(`⚠️ [Page ${pageNumber}] Reference Load Fail: ${refError.message}`);
          }
        }
      }

      log.info(`📡 [Page ${pageNumber}] Sending Gemini request (Prompt length: ${prompt.length}, Parts: ${parts.length})...`);
      
      parts.forEach((part, idx) => {
        if (part.inlineData) {
          log.info(`📦 Part ${idx} size: ${Math.round(part.inlineData.data.length / 1024)} KB`);
        }
      });

      // 100% ORIGINAL INTERNAL RETRY FOR NETWORK FAILURES
      let geminiAttempt = 0;
      let geminiResult = null;
      const finalPayload = hasImages ? parts : prompt;

      while (geminiAttempt < 2) {
        const startTime = Date.now();
        const heartbeat = setInterval(() => {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          log.info(`💓 [Page ${pageNumber}] Still waiting for Gemini Pro... (${elapsed}s elapsed)`);
        }, 15000);

        try {
          log.info(`⏳ [Page ${pageNumber}] Waiting for Gemini Pro to paint... (Attempt ${geminiAttempt + 1})`);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Gemini API Timeout (${timeoutMs/1000}s)`)), timeoutMs)
          );

          const result = await Promise.race([
            model.generateContent(finalPayload),
            timeoutPromise
          ]);
          
          clearInterval(heartbeat);
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          log.info(`✅ [Page ${pageNumber}] Gemini Pro finished painting in ${duration}s`);
          
          geminiResult = result.response;
          break;
        } catch (netErr) {
          clearInterval(heartbeat);
          geminiAttempt++;
          const isOverloaded = netErr.message?.includes('overloaded') || netErr.message?.includes('503');
          if (geminiAttempt < 2 && (netErr.message?.includes('fetch failed') || netErr.message?.includes('timeout') || netErr.message?.includes('Timeout') || netErr.message?.includes('aborted') || isOverloaded)) {
            log.warn(`🔄 [Page ${pageNumber}] Gemini ${isOverloaded ? 'overloaded' : 'network issue'}, retrying once... Error: ${netErr.message}`);
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }
          throw netErr;
        }
      }

      const response = geminiResult;
      if (response && response.candidates?.[0]?.finishReason === 'SAFETY') {
        log.error(`🛡️ SAFETY ALERT: Page ${pageNumber} Gemini prompt was blocked.`);
        return { error: 'SAFETY_FILTER_BLOCK', status: 200, modelUsed: 'gemini' };
      }

      const imagePart = response?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (imagePart?.inlineData?.data) {
        log.info(`📸 Image generated successfully by Gemini Pro (${imagePart.inlineData.data.length} chars)`);
        return { 
          bytesBase64Encoded: imagePart.inlineData.data, 
          modelUsed: 'gemini',
          status: 200
        };
      }
      log.warn(`⚠️ [Page ${pageNumber}] Gemini Pro did not return an image.`);
      return { error: 'NO_IMAGE_DATA', status: 200 };
    } else {
      log.error(`❌ [Page ${pageNumber}] GOOGLE_API_KEY IS MISSING FROM PROCESS.ENV`);
      return { error: 'MISSING_API_KEY', status: 500 };
    }
  } catch (geminiError) {
    log.error(`💥 [Page ${pageNumber}] Gemini Pro network error:`, geminiError.message);
    const isOverloaded = geminiError.message?.includes('overloaded') || geminiError.message?.includes('503');
    return { 
      error: isOverloaded ? 'MODEL_OVERLOADED' : 'NETWORK_ERROR', 
      status: isOverloaded ? 503 : 500 
    };
  }
}

async function generateImages(db, bookId, isFulfillment = false) {
  dotenv.config({ override: true });
  const pid = process.pid;
  const userEmail = 'unknown'; // placeholder until record loaded
  let giLog = { info: logger.info, error: logger.error }; // fallback

  try {
    const bookRecord = await db.collection('books').findOne({ _id: new ObjectId(bookId) });
    if (!bookRecord) throw new Error('Book not found in database');

    const email = bookRecord.email?.toLowerCase() || 'none';
    giLog = {
      info: (msg, meta) => logger.info(`[PID:${pid}][GI][${bookId}][${email}] ${msg} ${meta ? JSON.stringify(meta) : ""}`),
      debug: (msg, meta) => logger.debug(`[PID:${pid}][GI][${bookId}][${email}] ${msg} ${meta ? JSON.stringify(meta) : ""}`),
      warn: (msg, meta) => logger.warn(`[PID:${pid}][GI][${bookId}][${email}] ${msg} ${meta ? JSON.stringify(meta) : ""}`),
      error: (msg, meta) => logger.error(`[PID:${pid}][GI][${bookId}][${email}] ${msg} ${meta ? JSON.stringify(meta) : ""}`),
    };

    giLog.info(`🎯 ========== FUNCTION STARTED ==========`);

    const activeHeroBible = bookRecord.heroBible || '';
    const activeAnimalBible = bookRecord.animalBible || '';

    const rawPages = bookRecord.pages || [];
    const storyPagesCount = parseInt(process.env.STORY_PAGES_COUNT || '23');
    const pages = rawPages
      .filter((p) => !p.type || p.type === 'story')
      .slice(0, storyPagesCount)
      .map((p) => ({ ...p, type: 'story' }));

    giLog.info(`🎯 Params: { pagesCount: ${pages.length}, isFulfillment: ${isFulfillment} }`);
    giLog.info(`🎯 Auth Status: { authenticated: ${email !== 'none'}, user: "${email}" }`);

    giLog.info(`🎯 Function execution continuing, book found`);
    giLog.info(`🎯 DB Record Status: { status: "${bookRecord.status}", currentPages: ${bookRecord.pages?.length}, isDigitalUnlocked: ${bookRecord.isDigitalUnlocked} }`);

    giLog.info(`📄 Number of Story Pages to Process: ${pages.length}`);
    if (pages.length < 5) {
      giLog.warn(`⚠️ Low page count detected (${pages.length}). This book might have been truncated by a previous bug.`);
    }

    pages.forEach((page, index) => {
      giLog.info(`📄 Page ${index + 1} Pre-processing:`, {
        pageNumber: page.pageNumber,
        textLength: page.text?.length || 0,
        hasImageUrl: !!page.imageUrl,
        imageUrl: page.imageUrl
      });
    });

   const projectId = process.env.GCP_PROJECT_ID;
   const rawKeyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
   const path = require('path');
   const keyPath = path.isAbsolute(rawKeyPath) ? rawKeyPath : path.resolve(process.cwd(), rawKeyPath);

  giLog.info(`🔧 [IMAGE_GEN_DEBUG] Project ID from env: "${projectId}"`);
  giLog.info(`🔧 [IMAGE_GEN_DEBUG] Credentials Path (Resolved): "${keyPath}"`);

  if (!projectId) {
    giLog.error('❌ [IMAGE_GEN_DEBUG] GCP_PROJECT_ID is MISSING or EMPTY.');
  }

  let storage, authClient;
  try {
    storage = new Storage({ projectId: projectId || undefined, keyFilename: keyPath });
    authClient = new GoogleAuth({
      projectId: projectId || undefined,
      keyFilename: keyPath,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
  } catch (authErr) {
    giLog.error(`❌ [IMAGE_GEN_DEBUG] Failed to initialize GCS/Auth Clients: ${authErr.message}`);
    throw authErr;
  }

  const bucket = storage.bucket(process.env.GCS_IMAGES_BUCKET_NAME);

  let accessToken;
  try {
    const gClient = await authClient.getClient();
    accessToken = await gClient.getAccessToken();
    if (!accessToken.token) throw new Error('Token is empty');
  } catch (tokenErr) {
    giLog.error(`❌ [IMAGE_GEN_DEBUG] Failed to obtain access token: ${tokenErr.message}`);
    throw tokenErr;
  }

  giLog.info('📸 STEP 1: RESOLVING REFERENCE IMAGES (PARALLEL MEGA-RACE)');
  
  async function generateReferenceImageRace(bible, type, photoUrl, style) {
    const fileName = `books/${bookId}/${type}_reference.png`;
    const file = bucket.file(fileName);
    const existing = await file.exists();
    if (existing[0]) {
      const [signedUrl] = await file.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 60 * 60 * 1000 });
      giLog.info(`📸 ${type} reference image already exists (signed): ${signedUrl.substring(0, 50)}...`);
      return signedUrl;
    }

    const RACE_CONCURRENCY = parseInt(process.env.STORY_REF_CONCURRENCY || '5');
    const MAX_RACE_RETRIES = parseInt(process.env.STORY_REF_RETRIES || '5');
    const RACE_TIMEOUT = parseInt(process.env.STORY_REF_TIMEOUT_MS || '120000');
    
    const reinforcedRefPrompt = `${bible}. A professional storybook illustration in ${style || 'children\'s book illustration'}. This is a reference portrait of the ${type} character, front view, neutral expression, centered composition.`;

    let raceAttempt = 0;
    while (raceAttempt < MAX_RACE_RETRIES) {
      const currentConcurrency = Math.min(raceAttempt + 1, RACE_CONCURRENCY);
      giLog.info(`🚀 [${type.toUpperCase()}_RACE] Starting Batch ${raceAttempt + 1}/${MAX_RACE_RETRIES} (${currentConcurrency} runners)...`);
      
      try {
        const runners = Array.from({ length: currentConcurrency }).map(async (_, idx) => {
          const runnerId = `${type}_batch${raceAttempt + 1}_runner${idx + 1}`;
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout [${runnerId}]`)), RACE_TIMEOUT));
          const generatorPromise = (async () => {
            const result = await callGeminiImageGen({ prompt: reinforcedRefPrompt, referenceImages: (photoUrl && type === 'hero') ? [{ uri: photoUrl }] : undefined, accessToken: accessToken.token, bucket, log: giLog, bookId, pageNumber: runnerId, timeoutMs: RACE_TIMEOUT });
            if (result && result.bytesBase64Encoded) return result.bytesBase64Encoded;
            throw new Error(`Empty response from ${runnerId}`);
          })();
          return await Promise.race([generatorPromise, timeoutPromise]);
        });

        const firstSuccessBase64 = await Promise.any(runners);
        if (firstSuccessBase64) {
          await file.save(Buffer.from(firstSuccessBase64, 'base64'), { metadata: { contentType: 'image/png' } });
          const publicUrl = `https://storage.googleapis.com/${process.env.GCS_IMAGES_BUCKET_NAME}/${fileName}`;
          giLog.info(`✅ [${type.toUpperCase()}_RACE] Winner found in Batch ${raceAttempt + 1}!`);
          await db.collection('images').updateOne({ bookId: new ObjectId(bookId), type: `${type}_reference` }, { $set: { gcsUrl: publicUrl, updatedAt: new Date(), model: 'gemini' } }, { upsert: true });
          return publicUrl;
        }
      } catch (raceError) {
        giLog.warn(`⚠️ [${type.toUpperCase()}_RACE] Batch ${raceAttempt + 1} failed: ${raceError.message}`);
        raceAttempt++;
        const isOverloaded = raceError.message?.includes('503') || raceError.message?.includes('MODEL_OVERLOADED');
        const wait = isOverloaded ? 15000 : 150000;
        giLog.info(`⏳ [${type.toUpperCase()}_RACE] Waiting ${wait/1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, wait));
      }
    }
    throw new Error(`❌ [${type.toUpperCase()}_RACE] Failed all ${MAX_RACE_RETRIES} batches`);
  }

  const [heroRefUrl, animalRefUrl] = await Promise.all([
    generateReferenceImageRace(activeHeroBible, 'hero', bookRecord.photoUrl, bookRecord.characterStyle),
    generateReferenceImageRace(activeAnimalBible, 'animal', null, bookRecord.characterStyle)
  ]);

  giLog.info('🏗️ STEP 2: CONSTRUCTING MASTER ARRAY (27 Pages)');
  const masterPages = [];
  
  if (bookRecord.photoUrl) {
    masterPages.push({ pageNumber: 1, type: 'photo', text: `Look, here is the real you! Ready to start the story?`, url: bookRecord.photoUrl, imageUrl: bookRecord.photoUrl, prompt: `The real photo of the child` });
  } else {
    masterPages.push({ pageNumber: 1, type: 'photo', text: `Look, here is you as a storybook hero! Ready to start?`, url: heroRefUrl, imageUrl: heroRefUrl, prompt: `The stylized storybook character portrait of the child` });
  }

  if (bookRecord.photoUrl) {
    masterPages.push({ pageNumber: 2, type: 'story', text: `And here is your character in the story!`, imageUrl: heroRefUrl, prompt: `The stylized storybook character portrait of the child` });
  } else {
    const introPrompt = `Our hero child ${bookRecord.childName} is standing in the ${bookRecord.location || 'beautiful landscape'}, looking at the horizon with a bright smile, ready for a big ${bookRecord.theme || 'adventure'}. ${bookRecord.occasion ? `Occasion: ${bookRecord.occasion}.` : ''} Bathed in the ${bookRecord.characterStyle} aesthetic.`;
    masterPages.push({ pageNumber: 2, type: 'story', text: `Once upon a time, your adventure began right here!`, prompt: introPrompt });
  }

  masterPages.push({ pageNumber: 3, type: 'story', text: `Meet your brave friend, ${bookRecord.animal}!`, imageUrl: animalRefUrl, prompt: `The animal character friend` });
  pages.forEach((p, idx) => { masterPages.push({ ...p, type: 'story', pageNumber: idx + 4 }); });
  masterPages.push({ pageNumber: masterPages.length + 1, type: 'story', text: "The End. May your adventures never truly end!", prompt: bookRecord.finalPrompt || `A heartwarming final interaction scene between the child hero and their animal friend.` });

  giLog.info(`📊 Master array constructed: ${masterPages.length} pages total`);
  giLog.info('💾 Initializing DB with master array structure...');
  
  try {
    const updateResult = await db.collection('books').updateOne(
      { _id: new ObjectId(bookId) }, 
      { $set: { pages: masterPages, updatedAt: new Date() } }
    );
    giLog.info(`🎯 [GenerateImages][PID:${pid}] Initial DB Sync Result: { matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount} }`);
  } catch (dbErr) {
    giLog.error(`❌ FAILED INITIAL DB SYNC: ${dbErr.message}`, { stack: dbErr.stack });
    throw dbErr;
  }

  const updatedPages = [...masterPages];
  const getGcsUriFromUrlLocal = (urlStr) => {
    try {
      if (!urlStr) return null;
      const url = new URL(urlStr);
      // Correctly escaped regex to match leading slash
      return `gs://${url.pathname.replace(/^\//, '')}`;
    } catch (e) {
      const parts = urlStr.split('storage.googleapis.com/')[1];
      return parts ? `gs://${parts.split('?')[0]}` : null;
    }
  };

  const referenceImages = [];
  if (heroRefUrl) { const uri = getGcsUriFromUrlLocal(heroRefUrl); if (uri) referenceImages.push({ uri }); }
  if (animalRefUrl) { const uri = getGcsUriFromUrlLocal(animalRefUrl); if (uri) referenceImages.push({ uri }); }

  async function paintPageWithRetry(pageIndex) {
    const page = updatedPages[pageIndex];
    const isActuallyPainted = page.imageUrl && 
      (page.imageUrl.includes('X-Goog-Signature') || page.imageUrl.includes('/books/') || page.imageUrl.includes('/uploads/')) &&
      !page.imageUrl.includes('placeholder') && !page.imageUrl.includes('Painting+Page');

    if (isActuallyPainted) {
      giLog.info(`⏭️ [Page ${page.pageNumber}] Skipping (already painted)`);
      try {
        await db.collection('images').updateOne({ bookId: new ObjectId(bookId), pageNumber: page.pageNumber }, { $set: { gcsUrl: page.imageUrl, updatedAt: new Date(), model: 'previously_painted' } }, { upsert: true });
      } catch (e) { giLog.error(`❌ Sync error for Page ${page.pageNumber}`, e); }
      return true;
    }

    let cycle = 0;
    const MAX_CYCLES = 5;
    const BASE_DELAY = parseInt(process.env.IMAGE_GENERATION_DELAY_MS || '10000');
    while (cycle < MAX_CYCLES) {
      const teaserLimit = TEASER_LIMIT;
      const isTeaserPage = pageIndex < teaserLimit;
      const TEASER_CONCURRENCY = parseInt(process.env.TEASER_IMAGES_CONCURRENCY || '3');
      const concurrency = isTeaserPage ? Math.min(cycle + 1, TEASER_CONCURRENCY) : 1;
      giLog.info(`🎨 [Page ${page.pageNumber}] Painting Cycle ${cycle + 1}/${MAX_CYCLES} (${concurrency} runners)...`);
      
      try {
        let characterInstruction = `Ref 1 is the child hero. Ref 2 is their animal friend. (CRITICAL: Refer to these references for character appearance to ensure 100% visual consistency). Please depict both interacting naturally.`;
        if (page.pageNumber === 2) {
          characterInstruction = `Refer to Ref 1 for the child hero's appearance. (CRITICAL: Only the child hero should be in this scene, no animal friend yet).`;
        } else if (page.pageNumber === 3) {
          characterInstruction = `Refer to Ref 2 for the animal friend's appearance. (CRITICAL: Only the animal friend should be in this scene, no child hero yet).`;
        }

        const style = bookRecord.characterStyle || 'storybook illustration';
        const prompt = `Wholesome children's book illustration. Style: ${style}. ${activeHeroBible} ${activeAnimalBible}. ${characterInstruction} Scene: ${page.prompt}`;

        const runners = Array.from({ length: concurrency }).map(async (_, rIdx) => {
          const runnerId = `p${page.pageNumber}_c${cycle + 1}_r${rIdx + 1}`;
          const result = await callGeminiImageGen({
            prompt, negativePrompt: "distorted features, scary, dark themes, blurry, low resolution, missing limbs, extra fingers, realistic, photograph",
            accessToken: accessToken.token, referenceImages, bucket, log: giLog, bookId, pageNumber: runnerId, timeoutMs: 120000
          });
          if (result && result.bytesBase64Encoded) return result.bytesBase64Encoded;
          throw new Error(`Runner ${runnerId} failed`);
        });

        const firstSuccessBase64 = await Promise.any(runners);
        if (firstSuccessBase64) {
          const fileName = `books/${bookId}/page_${page.pageNumber}.png`;
          const publicUrl = `https://storage.googleapis.com/${process.env.GCS_IMAGES_BUCKET_NAME}/${fileName}`;
          
          await bucket.file(fileName).save(Buffer.from(firstSuccessBase64, 'base64'), { metadata: { contentType: 'image/png' } });
          
          // Use a simple timestamp for UI cache busting, but keep the base URL clean
          updatedPages[pageIndex].imageUrl = `${publicUrl}?v=${Date.now()}`;

          await Promise.all([
            db.collection('books').updateOne({ _id: new ObjectId(bookId) }, { $set: { [`pages.${pageIndex}`]: updatedPages[pageIndex], pdfUrl: '', updatedAt: new Date() } }),
            db.collection('images').updateOne({ bookId: new ObjectId(bookId), pageNumber: page.pageNumber }, { $set: { gcsUrl: publicUrl, updatedAt: new Date(), model: 'gemini' } }, { upsert: true })
          ]);
          giLog.info(`✅ [Page ${page.pageNumber}] Success! (Atomic sync complete)`);
          return true;
        }
      } catch (e) {
        giLog.warn(`⚠️ [Page ${page.pageNumber}] Cycle ${cycle + 1} failed: ${e.message}`);
        cycle++;
        const isOverloaded = e.message?.includes('503') || e.message?.includes('MODEL_OVERLOADED');
        const wait = isOverloaded ? 15000 : (BASE_DELAY * cycle);
        giLog.info(`⏳ [Page ${page.pageNumber}] Waiting ${wait/1000}s before next cycle...`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
    return false;
  }

  const teaserLimit = TEASER_LIMIT;
  const teaserIndices = masterPages.map((_, i) => i).filter(idx => idx < teaserLimit);
  giLog.info(`🚀 FIRING TEASER BATCH: ${teaserIndices.length} pages (Indices 0-6)...`);
  await Promise.all(teaserIndices.map(idx => paintPageWithRetry(idx)));
  giLog.info(`✅ TEASER BATCH COMPLETE.`);

  // Explicitly update status to teaser_ready so frontend knows to stop or show preview
  giLog.info(`🎯 Setting status to teaser_ready for book: ${bookId}`);
  await db.collection('books').updateOne(
    { _id: new ObjectId(bookId) },
    { $set: { status: 'teaser_ready', updatedAt: new Date() } }
  );

  if (isFulfillment) {
    const regularIndices = masterPages.map((_, i) => i).filter(idx => idx >= teaserLimit);
    const BATCH_DELAY_MS = STORY_BATCH_DELAY_MS;
    giLog.info(`🚀 FIRING REGULAR BATCHES with a ${BATCH_DELAY_MS / 1000}s fire-and-forget delay...`);
    const BATCH_SIZE = 18;
    const allBatchPromises = [];
    for (let i = 0; i < regularIndices.length; i += BATCH_SIZE) {
      const chunk = regularIndices.slice(i, i + BATCH_SIZE);
      giLog.info(`📦 Firing Regular Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(regularIndices.length/BATCH_SIZE)} (${chunk.length} pages)...`);
      const batchPromise = Promise.all(chunk.map(idx => paintPageWithRetry(idx)));
      allBatchPromises.push(batchPromise);
      if (i + BATCH_SIZE < regularIndices.length) {
        giLog.info(`⏳ Batch Fired. Starting ${BATCH_DELAY_MS / 1000}s timer for the next batch...`);
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }
    await Promise.all(allBatchPromises);
    giLog.info(`✅ All regular batches have now completed.`);
  }

  try {
    giLog.info(`💾 ========== STEP 4: FINALIZING BOOK DOCUMENT ==========`);
    giLog.info(`Updating Book: ${bookId} with ${updatedPages.length} images`);

    const updateData = {
      pages: updatedPages,
      updatedAt: new Date()
    };

    // Diagnostic Log for Document Size
    const docSize = JSON.stringify(updateData).length;
    giLog.debug(`📝 [DEBUG] Final Update Size: ${docSize} characters (~${Math.round(docSize / 1024)} KB)`);
    giLog.debug(`📝 [DEBUG] Update keys: ${Object.keys(updateData).join(', ')}`);

    // RE-FETCH the latest status to avoid overwriting a status update that happened during processing
    const latestRecord = await db.collection('books').findOne({ _id: new ObjectId(bookId) }, { projection: { status: 1 } });
    const currentStatus = latestRecord?.status || bookRecord?.status;
    
    const isPaidStatus = ['paid', 'printing', 'shipped', 'printing_test'].includes(currentStatus || '');
    const pagesToProcessCount = isFulfillment ? masterPages.length : teaserLimit;

    if (pagesToProcessCount === masterPages.length && !isPaidStatus) {
      updateData.status = 'preview';
    } else if (!isFulfillment && !isPaidStatus && currentStatus !== 'teaser_ready') {
      // Only set teaser_ready if we aren't already in a more advanced state
      updateData.status = 'teaser_ready';
    } else {
      // Keep whatever the latest status was
      updateData.status = currentStatus;
    }

    giLog.info(`🎯 Final DB Update Status: ${updateData.status}`);

    const updateResult = await db.collection('books').updateOne(
      { _id: new ObjectId(bookId) },
      { $set: updateData }
    );
    giLog.info(`🎯 [GenerateImages][PID:${pid}] DB Update Result: { matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount} }`);

    // SYNC TO RECENT BOOKS
    if (userEmail !== 'none') {
      await db.collection('users').updateOne(
        { email: userEmail, "recentBooks.id": bookId },
        {
          $set: {
            "recentBooks.$.status": updateData.status || currentStatus,
            "recentBooks.$.isDigitalUnlocked": true,
            updatedAt: new Date()
          }
        }
      ).catch((e) => giLog.error('Failed to sync status to recentBooks:', e));
      giLog.info(`🎯 [GenerateImages][PID:${pid}] Dashboard Sync: Triggered for ${userEmail}`);
    }

    // SMART PDF TRIGGER
    if (pagesToProcessCount === masterPages.length && !isFulfillment) {
      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      giLog.info(`🚀 Triggering background PDF generation for book: ${bookId}`);
      axios.post(`${baseUrl}/api/generate-pdf`, { bookId }).catch(e => giLog.error('⚠️ Auto-PDF trigger failed:', e.message));
    }

    const pagesWithImages = updatedPages.filter(p => p.imageUrl && !p.imageUrl.includes('placeholder')).length;
    //giLog.info(`📊 FINAL RESULTS: Total=${updatedPages.length}, WithImages=${pagesWithImages}`);
  } catch (updateError) {
    giLog.error(`❌ FAILED TO UPDATE BOOK DOCUMENT`, updateError);
  }

    giLog.info(`🎯 [LIFECYCLE_TRACKER] PAINTING_COMPLETE: Processing finished for Book: ${bookId}`);
    giLog.info(`🎯 [GenerateImages][PID:${pid}] Execution complete.`);
  } catch (err) {
    giLog.error(`💥 [FATAL_ENGINE_ERROR] ${err.message}`, { stack: err.stack });
    throw err;
  }
}

module.exports = { generateImages };
