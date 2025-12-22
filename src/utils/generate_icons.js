
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SIZES = [16, 48, 128];
const INPUT = 'src/assets/logo.svg';
const OUTPUT_DIR = 'src/assets';

async function generate() {
    console.log(`Generating icons from ${INPUT}...`);

    if (!fs.existsSync(INPUT)) {
        console.error('Error: Logo file not found at ' + INPUT);
        process.exit(1);
    }

    for (const size of SIZES) {
        const fileName = `icon-${size}.png`;
        const outputPath = path.join(OUTPUT_DIR, fileName);

        try {
            await sharp(INPUT)
                .resize(size, size)
                .png()
                .toFile(outputPath);
            console.log(`✅ Generated ${fileName}`);
        } catch (err) {
            console.error(`❌ Failed to generate ${fileName}:`, err);
        }
    }
}

generate();
