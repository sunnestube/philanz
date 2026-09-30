const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/app/service/_wb_parts');
const out = path.join(__dirname, '../src/app/service/workbook.service.ts');
const parts = fs.readdirSync(dir).filter((f) => /^part\d{2}\.txt$/.test(f)).sort();
if (!parts.length) {
  console.error('check-assemble: no partNN.txt files');
  process.exit(1);
}
const expected = parts.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
if (expected.includes('PLACEHOLDER')) {
  console.error('check-assemble: PLACEHOLDER still in parts');
  process.exit(1);
}
const actual = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
if (actual !== expected) {
  console.error('check-assemble: workbook.service.ts drifted from _wb_parts. Run npm run assemble and commit both, or edit only the parts.');
  process.exit(1);
}
console.log('check-assemble: ok', parts.length, 'parts', expected.length, 'bytes');
