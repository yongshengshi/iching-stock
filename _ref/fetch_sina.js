const fs = require('fs');
const h = fs.readFileSync('../周易玄学选股.html', 'utf8'); global.window = {};
eval(h.match(/<script id="engine-script">([\s\S]*?)<\/script>/)[1]);
const X = global.window.Xuan;
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const codes = D.list.map(r => r[0]).filter(c => X.boardOf(c) === '主板');
const out = {};

async function get(code) {
  const sym = (code[0] === '6' ? 'sh' : 'sz') + code;
  const u = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${sym}&scale=240&ma=no&datalen=800`;
  for (let a = 0; a < 3; a++) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
      const r = await fetch(u, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
      clearTimeout(t);
      if (!r.ok) continue;
      const txt = await r.text();
      const arr = JSON.parse(txt);
      if (!Array.isArray(arr) || !arr.length) return null;
      return arr.map(x => [x.day, +x.open, +x.close, +x.high, +x.low, +x.volume]);
    } catch (e) { if (a === 2) return null; await new Promise(r => setTimeout(r, 500)); }
  }
  return null;
}

(async () => {
  let i = 0, ok = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (i < codes.length) {
      const c = codes[i++];
      const k = await get(c);
      if (k) { out[c] = k; ok++; }
      if (ok % 300 === 0) process.stdout.write(`  ${ok}/${codes.length}\r`);
    }
  }));
  fs.writeFileSync('kline800.json', JSON.stringify(out));
  const lens = Object.values(out).map(k => k.length).sort((a, b) => a - b);
  console.log(`\n完成 ${((Date.now() - t0) / 1000).toFixed(0)}s | ${ok} 只 | 中位 ${lens[Math.floor(lens.length / 2)]} 根 | ${(fs.statSync('kline800.json').size / 1048576).toFixed(1)}MB`);
})();
