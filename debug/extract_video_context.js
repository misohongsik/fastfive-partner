const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'debug_B09V8FHNJ5.html');
const outputPath = path.join(__dirname, 'video_context.json');

try {
    const content = fs.readFileSync(filePath, 'utf8');
    const target = "video/mp4";
    const index = content.indexOf(target);

    if (index === -1) {
        console.log("Target not found");
        process.exit(0);
    }

    console.log(`Found target at index ${index}`);

    // Search backwards for the start of the JSON array or object
    // It likely starts with `[{` or `{"` or `&quot;videos&quot;:[`

    let start = index;
    let depth = 0;
    let foundStart = false;

    // We are looking for the *start* of the JSON string that contains this.
    // It might be an attribute value like `data-video-resource="[{...}]"`
    // So we look for `="` or `='` backwards.

    // Heuristic: Look backwards for `[` or `{` that is NOT inside quotes?
    // Since it's likely escaped JSON, we might look for `[{` or `&quot;`

    // Let's just grab a large chunk around it and try to regex out the JSON.
    const chunkStart = Math.max(0, index - 5000);
    const chunkEnd = Math.min(content.length, index + 5000);
    const chunk = content.substring(chunkStart, chunkEnd);

    fs.writeFileSync(path.join(__dirname, 'video_chunk.txt'), chunk);
    console.log("Saved chunk to video_chunk.txt");

    // Try to find the escaped JSON array in this chunk
    // Look for `[{&quot;` ... `}]`
    // or `[{` ... `}]`

    // Regex for escaped JSON array of objects
    const escapedJsonRegex = /\[\s*\{&quot;.*?\}\s*\]/s;
    // This regex is too simple and might be greedy or fail on nested structures.

    // Better: Find the attribute it belongs to.
    // Look for `data-something="...video/mp4..."`

    // We will iterate backwards from the match in the chunk to find `="`
    const relativeIndex = index - chunkStart;
    let attrStart = -1;
    for (let i = relativeIndex; i >= 0; i--) {
        if (chunk[i] === '"' && chunk[i - 1] === '=') {
            attrStart = i + 1; // Start of attribute value
            break;
        }
    }

    if (attrStart !== -1) {
        // Find end of attribute value
        let attrEnd = -1;
        for (let i = relativeIndex; i < chunk.length; i++) {
            if (chunk[i] === '"') {
                attrEnd = i;
                break;
            }
        }

        if (attrEnd !== -1) {
            const attrValue = chunk.substring(attrStart, attrEnd);
            console.log("Found potential attribute value length:", attrValue.length);

            // Try to unescape and parse
            try {
                const unescaped = attrValue.replace(/&quot;/g, '"');
                const parsed = JSON.parse(unescaped);
                fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
                console.log("Successfully parsed JSON from attribute!");
            } catch (e) {
                console.log("Failed to parse attribute value as JSON:", e.message);
                fs.writeFileSync(path.join(__dirname, 'failed_attr.txt'), attrValue);
            }
        }
    } else {
        console.log("Could not find attribute start.");
    }

} catch (err) {
    console.error(err);
}
