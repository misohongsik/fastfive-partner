const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'detail_crawler_proxy.js');
const fileContent = fs.readFileSync(filePath, 'utf8');
const lines = fileContent.split('\n');

// Target lines to remove: 616 to 922 (1-based)
// In 0-based index: 615 to 921
const startLine = 615;
const endLine = 921;

console.log(`Total lines before: ${lines.length}`);
console.log(`Removing lines ${startLine + 1} to ${endLine + 1}`);

// Verify content before deleting
console.log('First line to remove:', lines[startLine]);
console.log('Last line to remove:', lines[endLine]);

if (lines[startLine].includes('async function waitForElement') && lines[endLine].trim() === '`;') {
    lines.splice(startLine, endLine - startLine + 1);
    console.log(`Total lines after: ${lines.length}`);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log('File updated successfully.');
} else {
    console.error('Safety check failed. Lines do not match expected content.');
    console.error('Expected start to contain "async function waitForElement"');
    console.error('Expected end to be "`;"');
    console.error('Actual start:', lines[startLine]);
    console.error('Actual end:', lines[endLine]);
}
