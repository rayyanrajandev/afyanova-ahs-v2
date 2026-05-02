/**
 * Fixes the garbled HTML comment at line ~4658 of Index.vue.
 * Run with: node scripts/fix-garbled-comment.cjs
 */
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../resources/js/pages/patients/Index.vue');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const idx = lines.findIndex(l => l.includes('PRIMARY INTAKE STRIP'));
if (idx === -1) {
    console.log('PRIMARY INTAKE STRIP comment not found - file may already be clean.');
    process.exit(0);
}

console.log(`Found garbled comment at line ${idx + 1}.`);
console.log(`Before: ${lines[idx].substring(0, 80)}...`);
lines[idx] = '                        <!-- PRIMARY INTAKE STRIP -->';
console.log(`After:  ${lines[idx]}`);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Done. Comment fixed.');
