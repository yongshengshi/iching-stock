const fs = require('fs');
const main = fs.readFileSync('app_template.html', 'utf8');
const engine = main.match(/<script id="engine-script">([\s\S]*?)<\/script>/)[1];   // 含 const DATA = /*__DATA__*/;
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const F = JSON.parse(fs.readFileSync('factor_data.json', 'utf8'));

/* 技术面行：[code,name,py,vol,rev,vshr,amt] */
const pyMap = {};
D.list.forEach(r => { pyMap[r[0]] = r[5] || ''; });
const rows = F.list.map(r => [r[0], r[1], pyMap[r[0]] || '', r[4], r[5], r[6], r[7]]);

const DATA = {
  meta: Object.assign({}, D.meta, { asOf: F.meta.asOf, count: rows.length, mkt20: F.meta.mkt20 }),
  lunarYears: D.lunarYears, jieqi: D.jieqi, gua: D.gua, norm: D.norm,
  list: [], rows
};

const tpl = fs.readFileSync('diag_page.html', 'utf8');
const out = tpl
  .replace('/*__ENGINE__*/', engine.split('/*__DATA__*/').join(JSON.stringify(DATA)));
fs.writeFileSync('../个股诊断.html', out);
console.log('size', (Buffer.byteLength(out) / 1024).toFixed(0) + 'KB', '| rows', rows.length, '| asOf', F.meta.asOf);
