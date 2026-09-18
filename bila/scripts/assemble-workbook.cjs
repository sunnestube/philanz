const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '../src/app/service/_wb_parts');
const parts = fs.readdirSync(dir).filter(f => /^part\d+\.txt$/.test(f)).sort();
const out = path.join(__dirname, '../src/app/service/workbook.service.ts');
const body = parts.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
fs.writeFileSync(out, body);
console.log('assembled', out, 'bytes', body.length, 'from', parts.join(','));
