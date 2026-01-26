const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
// Using the same model as your imageService
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });

async function generateAsset(prompt, fileName, targetSize) {
  console.log(`🎨 Generating ${fileName}...`);
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      throw new Error(`No image data returned for ${fileName}`);
    }

    const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const filePath = path.join(__dirname, 'app', fileName);
    fs.writeFileSync(filePath, buffer);
    console.log(`✅ Saved ${fileName} to /app (${Math.round(buffer.length / 1024)} KB)`);
  } catch (error) {
    console.error(`❌ Failed to generate ${fileName}:`, error.message);
  }
}

async function run() {
  const iconPrompt = "A simple, high-quality 3D mobile app icon of a magical glowing children's book with floating sparkles. Soft Pixar-style textures, bold colors, centered composition, high resolution. Solid deep navy blue background. Professional mobile app icon aesthetic, no text, clean edges.";
  
  const splashPrompt = "A high-resolution splash screen for a children's story app. In the dead center, a whimsical magical book is open with a soft golden glow. The background is a soft, out-of-focus magical jungle landscape with warm lighting and fireflies. Pixar character design style. Professional composition with the main subject strictly in the center and 50% empty space around edges.";

  console.log("🚀 Starting AI Asset Generation...");
  
  // Generate Icon
  await generateAsset(iconPrompt, 'icon-only.png');
  
  // Generate Splash
  await generateAsset(splashPrompt, 'splash.png');

  console.log("\n✨ AI Generation Phase Complete.");
  console.log("👉 Next: Run './generate-assets.sh' to process these into all Android sizes.");
}

run();
