const sharp = require("sharp");
const path = require("path");

async function resizeIcons() {
  const sizes = [16, 48];
  const inputPath = path.join(__dirname, "../icons/icon128.png");

  for (const size of sizes) {
    const outputPath = path.join(__dirname, `../icons/icon${size}.png`);
    await sharp(inputPath).resize(size, size).toFile(outputPath);
  }
}

resizeIcons().catch(console.error);
