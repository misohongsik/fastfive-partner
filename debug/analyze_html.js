const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'debug_B09V8FHNJ5.html');
const outputPath = path.join(__dirname, 'analysis_output.txt');

function log(message) {
    fs.appendFileSync(outputPath, message + '\n');
}

// Clear previous output
fs.writeFileSync(outputPath, '');

try {
    const content = fs.readFileSync(filePath, 'utf8');
    log(`Read ${content.length} characters.`);

    // 1. Search for "video" keyword and print context
    const videoRegex = /video/gi;
    let match;
    let count = 0;
    log('\n--- "video" keyword matches (first 10) ---');
    while ((match = videoRegex.exec(content)) !== null) {
        count++;
        if (count <= 10) {
            const start = Math.max(0, match.index - 50);
            const end = Math.min(content.length, match.index + 50);
            log(`Match ${count}: ...${content.substring(start, end).replace(/\n/g, ' ')}...`);
        }
    }
    log(`Total "video" matches: ${count}`);

    // 2. Search for "mp4"
    const mp4Regex = /\.mp4/gi;
    count = 0;
    log('\n--- ".mp4" keyword matches ---');
    while ((match = mp4Regex.exec(content)) !== null) {
        count++;
        const start = Math.max(0, match.index - 100);
        const end = Math.min(content.length, match.index + 100);
        log(`Match ${count}: ...${content.substring(start, end).replace(/\n/g, ' ')}...`);
    }
    log(`Total ".mp4" matches: ${count}`);

    // 3. Look for large JSON objects that might contain video data
    // This is a heuristic: look for "videos": [ ... ]
    const jsonVideoRegex = /"videos"\s*:\s*\[/g;
    count = 0;
    log('\n--- "videos": [ ... ] pattern matches ---');
    while ((match = jsonVideoRegex.exec(content)) !== null) {
        count++;
        const start = Math.max(0, match.index - 20);
        const end = Math.min(content.length, match.index + 500); // Print more context
        log(`Match ${count}: ...${content.substring(start, end).replace(/\n/g, ' ')}...`);
    }

} catch (err) {
    log("Error reading file: " + err);
    console.error(err);
}
