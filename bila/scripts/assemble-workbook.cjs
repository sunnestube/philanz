const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '../src/app/service/_wb_parts');
if (!fs.existsSync(dir)) {
  console.log('assemble-workbook: no _wb_parts dir, skip');
  process.exit(0);
}
// Only zero-padded part00.txt … partNN.txt (avoids leftover part4.txt breaking concat)
const parts = fs.readdirSync(dir).filter(f => /^part\d{2}\.txt$/.test(f)).sort();
if (!parts.length) {
  console.log('assemble-workbook: no partNN.txt files, skip');
  process.exit(0);
}
const out = path.join(__dirname, '../src/app/service/workbook.service.ts');
const body = parts.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
fs.writeFileSync(out, body);
console.log('assembled', out, 'bytes', body.length, 'from', parts.join(','));
