const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'debug_B09V8FHNJ5.html');
const outputPath = path.join(__dirname, 'extracted_json.json');

try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Look for the escaped JSON structure containing "creatorType"
    // It seems to be inside a list of videos.
    // Let's try to find a larger block.
    // The logs showed: ...&quot;creatorType&quot;:&quot;Influencer&quot;...

    // We'll look for a sequence of escaped quotes and typical JSON chars
    const regex = /(&quot;creatorType&quot;:&quot;[^&]+&quot;)/g;

    let match;
    const found = [];

    // Alternative: Look for the array of videos. 
    // Often these are in `data-a-carousel-options` or similar attributes, or inside `vse-video-data`

    // Let's try to find the string starting with `[{&quot;` and containing `creatorType`
    // This is a bit loose, but might work.

    // Better: search for the specific MP4 url context and expand outwards.
    const mp4ContextRegex = /(&quot;url&quot;:&quot;https:[^&]+.mp4&quot;)/g;

    while ((match = mp4ContextRegex.exec(content)) !== null) {
        found.push(match[1]);
    }

    // Let's try to extract the whole JSON block if possible.
    // It might be inside `data-video-url` or similar?
    // Let's look for `data-` attributes containing `vse`.

    const dataAttrRegex = /data-\w+="([^"]*vse[^"]*)"/g;
    let attrMatch;
    while ((attrMatch = dataAttrRegex.exec(content)) !== null) {
        // Decode HTML entities
        let jsonStr = attrMatch[1].replace(/&quot;/g, '"');
        try {
            const parsed = JSON.parse(jsonStr);
            found.push({ source: 'data-attribute', data: parsed });
        } catch (e) {
            // Not valid JSON, maybe just a URL
            found.push({ source: 'data-attribute-raw', data: jsonStr });
        }
    }

    // Also check for the "videos" key in escaped JSON
    const escapedVideosRegex = /&quot;videos&quot;:(\[[^\]]+\])/g;
    while ((match = escapedVideosRegex.exec(content)) !== null) {
        let jsonStr = match[1].replace(/&quot;/g, '"');
        try {
            const parsed = JSON.parse(jsonStr);
            found.push({ source: 'escaped-videos-array', data: parsed });
        } catch (e) {
            found.push({ source: 'escaped-videos-array-raw', data: jsonStr });
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(found, null, 2));
    console.log(`Extracted ${found.length} items.`);

} catch (err) {
    console.error(err);
}
