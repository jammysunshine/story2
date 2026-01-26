const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Look for .env in the parent server/ directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });

async function generateAsset(prompt, fileName) {
  console.log(`🎨 Generating ${fileName}...`);
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      throw new Error(`No image data returned for ${fileName}`);
    }

    const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
    // Save to the app/assets/ folder (Single Source of Truth)
    const filePath = path.join(__dirname, '..', '..', 'app', 'assets', fileName);
    fs.writeFileSync(filePath, buffer);
    console.log(`✅ Saved ${fileName} to /app/assets (${Math.round(buffer.length / 1024)} KB)`);
  } catch (error) {
    console.error(`❌ Failed to generate ${fileName}:`, error.message);
  }
}

async function run() {
  const iconPrompt = "A simple, high-quality 3D mobile app icon of a magical glowing children's book with floating sparkles. Soft Pixar-style textures, bold colors, centered composition, high resolution. Solid deep navy blue background. Professional mobile app icon aesthetic, no text, clean edges.";
  
  const foregroundPrompt = "A high-quality 3D asset for an app icon foreground. In the dead center, a magical glowing children's book with floating sparkles. Soft Pixar-style textures, bold colors. THE BACKGROUND MUST BE A SOLID BRIGHT PINK SO I CAN REMOVE IT, OR TRANSPARENT. No text, clean edges, professional mobile app icon aesthetic.";

  const backgroundPrompt = "A solid, high-resolution 1024x1024 image of a deep navy blue color with a very subtle, soft magical glow texture in the center. No objects, no text, professional mobile background.";

  const splashPrompt = "A high-resolution splash screen for a children's story app. In the dead center, a whimsical magical book is open with a soft golden glow. The background is a soft, out-of-focus magical jungle landscape with warm lighting and fireflies. Pixar character design style. Include the text 'WonderStories' clearly in a beautiful, whimsical, child-friendly font at the bottom center. Professional composition with 50% empty space around edges.";

  console.log("🚀 Starting AI Asset Generation from scripts folder...");
  
  if (!process.env.GOOGLE_API_KEY) {
    console.error("❌ GOOGLE_API_KEY missing from server/.env");
    process.exit(1);
  }

  await generateAsset(iconPrompt, 'icon-only.png');
  await generateAsset(foregroundPrompt, 'icon-foreground.png');
  await generateAsset(backgroundPrompt, 'icon-background.png');
  await generateAsset(splashPrompt, 'splash.png');

  console.log("\n✨ AI Generation Phase Complete.");
  console.log("👉 Next: Run './generate-assets.sh' from the project root.");
}

run();
