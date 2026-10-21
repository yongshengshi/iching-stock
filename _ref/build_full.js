/* 抓取沪深主板全量行情，生成紧凑快照并入 data.json */
const fs = require('fs');
const { pinyin } = require('pinyin-pro');   // npm i pinyin-pro
const half = str => str.replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
const initials = name => {
  const t = half(name).replace(/[^0-9A-Za-z\u4e00-\u9fa5]/g, '');
  try { return pinyin(t, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toLowerCase(); }
  catch (e) { return ''; }
};

const ranges = [];
/* 沪主板 + 科创板 */
for (const base of [600000, 601000, 603000, 605000, 688000, 689000]) ranges.push(['sh', base, 1000]);
/* 深主板 + 创业板 */
for (const base of [0, 1000, 2000, 3000, 300000, 301000, 302000]) ranges.push(['sz', base, 1000]);
/* 北交所（代码稀疏，穷举） */
for (const base of [430000, 920000]) ranges.push(['bj', base, 1000]);
for (const base of [830000, 870000]) ranges.push(['bj', base, 10000]);
const codes = [];
for (const [p, base, n] of ranges) for (let i = 0; i < n; i++) codes.push(p + String(base + i).padStart(6, '0'));

const BATCH = 100, CONC = 12;
const batches = [];
for (let i = 0; i < codes.length; i += BATCH) batches.push(codes.slice(i, i + BATCH));
const dec = new TextDecoder('gbk');
const list = [];
let idx = 0, done = 0, failed = 0;

async function one(b) {
  const url = 'https://qt.gtimg.cn/q=' + b.join(',');
  for (let a = 0; a < 3; a++) {
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000);
      const res = await fetch(url, { signal: c.signal });
      const buf = Buffer.from(await res.arrayBuffer()); clearTimeout(t);
      return dec.decode(buf);
    } catch (e) { if (a === 2) { failed++; return ''; } await new Promise(r => setTimeout(r, 400 * (a + 1))); }
  }
}

function parse(txt) {
  for (const line of txt.split('\n')) {
    const m = line.match(/v_([a-z]{2}\d{6})="([^"]*)"/);
    if (!m || !m[2]) continue;
    const p = m[2].split('~');
    if (p.length < 46) continue;
    const name = p[1].replace(/\s/g, '');
    const price = +p[3];
    if (!price || price <= 0 || !+p[4]) continue;
    if (/ST|退|PT/.test(name)) continue;
    if (!+p[37]) continue;                 // 成交额为 0：停牌／已退市／僵尸代码
    list.push([m[1].slice(2), name, +price.toFixed(2), +p[32], +(p[37] / 10000).toFixed(2), initials(name)]);
  }
}

(async () => {
  console.log('候选', codes.length);
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (idx < batches.length) {
      const k = idx++;
      parse(await one(batches[k]));
      if (++done % 20 === 0) process.stdout.write(`  ${done}/${batches.length}\r`);
    }
  }));
  list.sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`\n有效主板 ${list.length} 只，失败批次 ${failed}`);

  const d = JSON.parse(fs.readFileSync('data.json', 'utf8'));
  delete d.stocks;
  d.list = list;
  d.meta.snapAt = '2026-10-20 15:00';
  fs.writeFileSync('data.json', JSON.stringify(d));
  console.log('data.json', fs.statSync('data.json').size, '字节；样例', JSON.stringify(list.slice(100, 103)));
})();
