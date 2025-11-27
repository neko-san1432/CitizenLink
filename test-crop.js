const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const imagePath = 'C:\\Users\\User\\Downloads\\362142282_1351083545477868_3087288934325249736_n.jpg';
const outputPath = path.join(__dirname, 'cropped-test.jpg');
const debugPath = path.join(__dirname, 'crop-debug.jpg');

async function detectAndCrop() {
  try {
    console.log('Loading image...');
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    console.log(`Original size: ${metadata.width}x${metadata.height}`);

    // 1. Thresholding to find the card (assuming card is lighter than background)
    // We'll use a simple threshold first.
    // Ideally, we'd use Otsu's method, but sharp doesn't have it built-in.
    // We can try 'threshold' with a fixed value or use 'normalise' then threshold.
    
    console.log('Processing for edge detection...');
    
    // Resize for processing (speed + memory safety)
    const processWidth = 400;
    const scale = processWidth / metadata.width;
    const processHeight = Math.round(metadata.height * scale);
    
    // Sobel edge detection kernel
    const kernel = {
      width: 3,
      height: 3,
      kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
    };

    const edges = await image
      .clone()
      .resize(processWidth, processHeight)
      .greyscale()
      .convolve(kernel)
      .threshold(50) // Keep only strong edges
      .toBuffer();
      
    // Save debug image
    await sharp(edges, { raw: { width: processWidth, height: processHeight, channels: 1 } })
      .toFile(debugPath);
    console.log('Saved debug edge image to:', debugPath);

    // 2. Find bounding box of the edges
    const { data, info } = await sharp(edges, { raw: { width: processWidth, height: processHeight, channels: 1 } })
      .raw()
      .toBuffer({ resolveWithObject: true });
      
    let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
    let found = false;
    let pixelCount = 0;

    // Iterate pixels to find the bounding box of the edges
    // We can ignore the outer 5% of the image to avoid border noise
    const marginX = Math.round(info.width * 0.05);
    const marginY = Math.round(info.height * 0.05);

    for (let y = marginY; y < info.height - marginY; y++) {
      for (let x = marginX; x < info.width - marginX; x++) {
        const idx = y * info.width + x;
        const pixel = data[idx]; 
        
        if (pixel > 0) { // Edge detected
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
          pixelCount++;
        }
      }
    }

    if (!found || pixelCount < 1000) {
      console.log('Could not detect card edges.');
      return;
    }

    // Add some padding
    const padding = 20;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(info.width, maxX + padding);
    maxY = Math.min(info.height, maxY + padding);
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    console.log(`Detected Bounding Box: x=${minX}, y=${minY}, w=${width}, h=${height}`);
    console.log(`Edge Pixel Count: ${pixelCount}`);
    
    // Validate Aspect Ratio
    const ratio = width / height;
    console.log(`Aspect Ratio: ${ratio.toFixed(2)}`);
    
    // 3. Crop original image
    console.log('Cropping...');
    await image
      .extract({ left: minX, top: minY, width: width, height: height })
      .toFile(outputPath);
      
    console.log('Saved cropped image to:', outputPath);

  } catch (err) {
    console.error('Error:', err);
  }
}

detectAndCrop();
