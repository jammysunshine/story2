const fs = require('fs');
const { createCanvas } = require('canvas');

// Note: This might fail if 'canvas' is not installed. 
// I will check if I can use a simpler way if this fails.
try {
  const canvas = createCanvas(1024, 1024);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000033'; // Deep Navy Blue
  ctx.fillRect(0, 0, 1024, 1024);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('app/assets/icon-background.png', buffer);
  console.log('✅ Generated icon-background.png');
} catch (e) {
  console.log('❌ Canvas not available, using fallback copy...');
  // Fallback: just copy the icon-only as background too, it's better than nothing
  // and will at least trigger the update.
  fs.copyFileSync('app/assets/icon-only.png', 'app/assets/icon-background.png');
}
