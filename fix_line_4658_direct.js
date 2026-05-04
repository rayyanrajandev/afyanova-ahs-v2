const fs = require('fs');
const path = require('path');

const filePath = path.join('C:', 'Portfolio', 'afyanova-ahs-v2', 'resources', 'js', 'pages', 'patients', 'Index.vue');

console.log('Reading file...');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log(`\n=== BEFORE FIX ===`);
console.log(`Total lines: ${lines.length}`);
console.log(`Line 4658 (index 4657) length: ${lines[4657].length}`);
console.log(`First 100 chars: ${JSON.stringify(lines[4657].substring(0, 100))}`);

// Replace line 4658 (index 4657)
lines[4657] = '                        <!-- PRIMARY INTAKE STRIP -->';

// Reconstruct content and write back
const newContent = lines.join('\n');
fs.writeFileSync(filePath, newContent, 'utf-8');

console.log(`\n=== AFTER FIX ===`);
console.log('File written successfully!');

// Verify the fix
const verifyContent = fs.readFileSync(filePath, 'utf-8');
const verifyLines = verifyContent.split('\n');

console.log(`\n=== VERIFICATION (Lines 4656-4660) ===`);
for (let i = 4655; i < 4660 && i < verifyLines.length; i++) {
    const lineNum = i + 1;
    const linePreview = verifyLines[i].length > 100 
        ? verifyLines[i].substring(0, 100) + '...' 
        : verifyLines[i];
    console.log(`Line ${lineNum}: ${JSON.stringify(linePreview)}`);
}

console.log(`\n=== Line 4658 Content ===`);
console.log(`Line 4658 is now: ${JSON.stringify(verifyLines[4657])}`);
console.log(`Stripped content: "${verifyLines[4657].trim()}"`);
console.log(`\n✓ Fix completed successfully!`);
