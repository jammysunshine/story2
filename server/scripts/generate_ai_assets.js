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
  /* Commented out to avoid regenerating icons
  const iconPrompt = "A simple, high-quality 3D mobile app icon of a magical glowing children's book with floating sparkles. Soft Pixar-style textures, bold colors, centered composition, high resolution. Solid deep navy blue background. Professional mobile app icon aesthetic, no text, clean edges.";
  
  const foregroundPrompt = "A high-quality 3D asset for an app icon foreground. In the dead center, a magical glowing children's book with floating sparkles. Soft Pixar-style textures, bold colors. THE BACKGROUND MUST BE A SOLID BRIGHT PINK SO I CAN REMOVE IT, OR TRANSPARENT. No text, clean edges, professional mobile app icon aesthetic.";

  const backgroundPrompt = "A solid, high-resolution 1024x1024 image of a deep navy blue color with a very subtle, soft magical glow texture in the center. No objects, no text, professional mobile background.";

  const splashPrompt = "A high-resolution splash screen for a children's story app. In the dead center, a whimsical magical book is open with a soft golden glow. The background is a soft, out-of-focus magical jungle landscape with warm lighting and fireflies. Pixar character design style. Include the text 'WonderStories' clearly in a beautiful, whimsical, child-friendly font at the bottom center. Professional composition with 50% empty space around edges.";
  */

  const testimonialPrompts = [
    "A photorealistic, high-quality close-up of a 5-year-old child's face glowing with joy as they hold a slim, 28-page 'WonderStories' hardcover book. The book is 8x11 inches with an elegant thin profile. The cover is deep navy blue with a glowing magical book icon. Soft, warm indoor lighting.",
    "A professional product shot of a premium, slim 28-page hardcover children's book lying on a wooden table. The book is 8x11 inches and clearly thin (0.5 inches thick). The cover is deep navy blue with 'WonderStories' branding and a glowing icon. High-end lifestyle photography.",
    "A photorealistic shot of a mother and daughter reading a slim 8x11 inch 'WonderStories' book. The book has a thin, elegant hardcover profile. The navy blue cover with its glowing icon is visible. Warm and emotional atmosphere.",
    "A high-quality photo of a father reading a slim, 28-page 'WonderStories' book to his children. The book's thin 8x11 inch dimensions are clearly visible as he holds it. The cover is deep navy with a magical glowing book design.",
    "A close-up of a child's hands turning a page in a slim 8x11 inch 'WonderStories' book. The shot highlights the thin hardcover spine and the high-quality interior pages. Professional boutique product photography.",
    "A photorealistic shot of a grandmother and grandson unboxing a slim, elegant 28-page 'WonderStories' hardcover book. The book is 8x11 inches and looks like a boutique treasure. The navy cover with glowing icon is catching the light.",
    "A lifestyle shot of a slim 8x11 inch 'WonderStories' book placed on a child's nightstand. The book is clearly thin and elegant. The deep navy cover with its magical glowing book icon matches the room's whimsical decor.",
    "A photorealistic portrait of a young boy hugging his slim 'WonderStories' hardcover book. The book is 8x11 inches and about 0.5 inches thick. The navy blue cover is visible against his pajamas. Soft evening lighting.",
    "A high-angle shot of a family looking at a slim, 28-page 'WonderStories' book together on a rug. The book's thin 8x11 inch profile is obvious. The cover is navy blue with a glowing magical book icon.",
    "A stunning photo of a slim, elegant 8x11 inch 'WonderStories' book held up against a sunset background. The book is thin and high-quality. The navy cover and its glowing book icon look like a real treasure.",
    "A photorealistic shot of a young girl reading a slim 'WonderStories' book under a tree in a sunny park. The 8x11 inch book is thin and easy for her to hold. The navy cover with its glowing book icon is prominent.",
    "A professional shot of a slim 'WonderStories' hardcover book standing upright on a shelf next to other children's classics. Its thin 0.5-inch spine is visible. The navy blue cover stands out with its magical glow.",
    "A candid photo of a toddler pointing at an illustration in a slim 8x11 'WonderStories' book. The parent is smiling. The book's elegant, thin profile is visible. Navy blue cover with magical icon.",
    "A high-quality lifestyle image of a child unboxing a 'WonderStories' package to find their slim hardcover book inside. The book is 8x11 inches and thin. The navy blue cover is shiny and new.",
    "A photorealistic shot of two siblings sharing a slim 'WonderStories' book in a cozy reading nook. The book is thin and 8x11 inches. The cover is deep navy with a glowing book logo.",
    "A close-up of a 'WonderStories' book lying open on a bed, showing a beautiful AI illustration. The slim hardcover edges and the 8x11 inch size are evident. The navy blue cover is partially visible.",
    "A professional photography shot of a parent holding a slim, elegant 'WonderStories' book while the child looks on with excitement. The book is 8x11 inches and clearly high-end. Navy blue cover.",
    "A photorealistic image of a 'WonderStories' book sitting on a desk with art supplies. The book is thin (28 pages) and has an 8x11 inch footprint. The navy blue cover features a magical glowing book.",
    "A heartwarming shot of a grandfather reading a slim 'WonderStories' book to his granddaughter. The book's thin, elegant dimensions are clear. The cover is navy blue with its unique glowing icon.",
    "A stunning high-resolution photo of a child discovering a 'WonderStories' book in their Christmas stocking. The book is slim, 8x11 inches, and has a beautiful navy blue cover with a glowing book icon."
  ];

  console.log(`🚀 Starting AI Asset Generation (${testimonialPrompts.length} Testimonials)...`);
  
  if (!process.env.GOOGLE_API_KEY) {
    console.error("❌ GOOGLE_API_KEY missing from server/.env");
    process.exit(1);
  }

  /* Base Assets - Commented out
  await generateAsset(iconPrompt, 'icon-only.png');
  await generateAsset(foregroundPrompt, 'icon-foreground.png');
  await generateAsset(backgroundPrompt, 'icon-background.png');
  await generateAsset(splashPrompt, 'splash.png');
  */

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
