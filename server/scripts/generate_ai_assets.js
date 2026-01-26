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

  const testimonialPrompts = [
    "A photorealistic, high-quality close-up of a 5-year-old child's face glowing with pure joy and wonder as they hold an open 'WonderStories' hardcover book. Soft, warm indoor lighting, bokeh background of a cozy living room. 8k resolution, professional photography style.",
    "A professional product shot of a premium, slim hardcover children's book (28 pages) with 'WonderStories' visible on the spine, lying on a high-end minimalist wooden coffee table next to a warm cup of cocoa. The book is 8x11 inches, elegant and high-quality. Soft morning sunlight through a window. Cinematic lighting.",
    "A photorealistic medium shot of a diverse mother and daughter sitting on a velvet sofa, laughing and pointing at a page in their personalized 'WonderStories' book. High-end lifestyle photography, warm and emotional atmosphere.",
    "A high-quality photo of a father reading a 'WonderStories' book to his two children in a cozy blanket fort built with fairy lights. The book's magical illustrations are visible and glowing slightly. Extremely cozy and magical vibe.",
    "A close-up shot of small child's hands holding a 'WonderStories' book, showing the high-quality paper texture and vibrant AI-generated illustrations inside. Professional boutique product photography.",
    "A photorealistic shot of a happy grandmother and grandson unboxing a package to reveal a beautiful, slim 'WonderStories' hardcover storybook. Pure emotional connection, bright and clean indoor lighting.",
    "A lifestyle shot of a 'WonderStories' book placed on a child's nightstand next to a sleeping teddy bear and a soft nightlight. Professional interior design photography.",
    "A photorealistic portrait of a young boy hugging his 'WonderStories' book to his chest with a big smile. He is wearing pajamas. Soft evening lighting, high resolution.",
    "A high-angle shot of a family of four lying on a rug, all looking at a 'WonderStories' book together. Joyful expressions, professional family portrait style, sharp focus.",
    "A stunning photo of a slim, 8x11 inch 'WonderStories' hardcover book being held up against a backdrop of a beautiful, slightly out-of-focus garden at sunset. The book has an elegant, high-quality profile. Cinematic lighting, 8k."
  ];

  console.log("🚀 Starting AI Asset Generation (Standard + 10 Testimonials)...");
  
  if (!process.env.GOOGLE_API_KEY) {
    console.error("❌ GOOGLE_API_KEY missing from server/.env");
    process.exit(1);
  }

  // Base Assets
  await generateAsset(iconPrompt, 'icon-only.png');
  await generateAsset(foregroundPrompt, 'icon-foreground.png');
  await generateAsset(backgroundPrompt, 'icon-background.png');
  await generateAsset(splashPrompt, 'splash.png');

  // Testimonials
  for (let i = 0; i < testimonialPrompts.length; i++) {
    const fileName = `testimonial-${i + 1}.png`;
    console.log(`🎨 Generating Testimonial ${i + 1}...`);
    try {
      const result = await model.generateContent(testimonialPrompts[i]);
      const response = await result.response;
      const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      
      if (!imagePart?.inlineData?.data) {
        throw new Error(`No image data returned for ${fileName}`);
      }

      const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
      const filePath = path.join(__dirname, '..', '..', 'app', 'public', 'assets', 'testimonials', fileName);
      fs.writeFileSync(filePath, buffer);
      console.log(`✅ Saved ${fileName} to /app/public/assets/testimonials (${Math.round(buffer.length / 1024)} KB)`);
    } catch (error) {
      console.error(`❌ Failed to generate ${fileName}:`, error.message);
    }
  }

  console.log("\n✨ AI Generation Phase Complete.");
  console.log("👉 Next: Run './generate-assets.sh' from the project root.");
}

run();
