const fs = require('fs');
const tpl = fs.readFileSync('ledger_page.html', 'utf8');
const data = fs.readFileSync('ledger.json', 'utf8');
const out = tpl.split('/*__LEDGER__*/').join(data);
fs.writeFileSync('../台账.html', out);
console.log('台账.html 生成，大小', Math.round(Buffer.byteLength(out) / 1024), 'KB');
