import { Jimp } from "jimp";

async function processImage() {
  try {
    console.log("Loading image...");
    const image = await Jimp.read('public/Screenshot 2026-07-04 195851.png');
    
    console.log("Scanning image...");
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const red = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];
      
      // if color is near white
      if (red > 240 && green > 240 && blue > 240) {
        this.bitmap.data[idx + 3] = 0; // alpha to 0
      }
    });
    
    console.log("Saving image...");
    await image.write('public/logo.png');
    console.log("Successfully saved public/logo.png");
  } catch (err) {
    console.error("Error processing image:", err);
  }
}

processImage();
