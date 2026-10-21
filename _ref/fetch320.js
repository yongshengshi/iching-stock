/* 抓 320 根日K（约15个月），用于因子回测 */
const fs = require('fs');
const klines = {};

const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const X = (() => { const h = fs.readFileSync('../周易玄学选股.html', 'utf8'); global.window = {}; eval(h.match(/<script id="engine-script">([\s\S]*?)<\/script>/)[1]); return global.window.Xuan; })();
const codes = D.list.map(r => r[0]).filter(c => X.boardOf(c) === '主板');

async function fetchK(code) {
  const q = (code[0] === '6' ? 'sh' : 'sz') + code;
  for (let a = 0; a < 4; a++) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
      const res = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${q},day,,,320,qfq&_t=${Date.now()}`, { signal: ctl.signal, cache: 'no-store' });
      clearTimeout(t);
      if (!res.ok) continue;
      const j = await res.json();
      const node = j && j.data && j.data[q];
      const arr = node && (node.qfqday || node.day);
      if (!arr || !arr.length) return null;
      return arr.map(x => ({ d: x[0], o: +x[1], c: +x[2], h: +x[3], l: +x[4], v: +x[5] }));
    } catch (e) { if (a === 3) return null; await new Promise(r => setTimeout(r, 400)); }
  }
  return null;
}

(async () => {
  let idx = 0, ok = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (idx < codes.length) {
      const c = codes[idx++];
      const k = await fetchK(c);
      if (k) { klines[c] = k; ok++; }
      if (ok % 300 === 0) process.stdout.write(`  ${ok}/${codes.length}\r`);
    }
  }));
  fs.writeFileSync('kline320.json', JSON.stringify(klines));
  const barCounts = Object.values(klines).map(k => k.length).sort((a, b) => a - b);
  console.log(`\n完成 ${((Date.now() - t0) / 1000).toFixed(0)}s | ${ok} 只 | 中位K线数 ${barCounts[Math.floor(barCounts.length / 2)]} | 文件 ${(fs.statSync('kline320.json').size / 1048576).toFixed(1)}MB`);
})();
