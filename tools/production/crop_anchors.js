const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHARACTERS = ['zhang_ruochen', 'chi_yao', 'lin_fei', 'eighth_prince'];

function cropAnchors() {
    for (const char of CHARACTERS) {
        const sheetPath = path.join(process.cwd(), 'storage', 'characters', char, 'anchors', 'guoman_triview_sheet.png');
        const frontOut = path.join(process.cwd(), 'storage', 'characters', char, 'anchors', 'canonical_front.png');

        if (fs.existsSync(sheetPath)) {
            console.log(`Cropping frontend anchor for ${char}...`);
            // The sheet contains 3 figures side-by-side. 
            // We crop the middle 1/3. 
            // crop=w:h:x:y
            // Width = input_width/3
            // Height = input_height
            // X = input_width/3
            // Y = 0
            try {
                execSync(`ffmpeg -y -i "${sheetPath}" -vf "crop=in_w/3:in_h:in_w/3:0" "${frontOut}" 2>/dev/null`);
                console.log(`[SUCCESS] Saved ${frontOut}`);
            } catch (e) {
                console.error(`[ERROR] Failed to crop ${char}:`, e.message);
            }
        } else {
            console.error(`[WARN] Sheet not found: ${sheetPath}`);
        }
    }
}

cropAnchors();
