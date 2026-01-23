const { Storage } = require('@google-cloud/storage');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
    const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
    const bucketName = process.env.GCS_IMAGES_BUCKET_NAME;
    const bookId = '69730269d19d72eb53e10955';
    const bucket = storage.bucket(bucketName);

    for (let i = 1; i <= 27; i++) {
        const fileName = `books/${bookId}/page_${i}.png`;
        const [exists] = await bucket.file(fileName).exists();
        console.log(`Page ${i}: ${exists ? '✅ EXISTS' : '❌ MISSING'} - ${fileName}`);
    }
}

check().catch(console.error);
