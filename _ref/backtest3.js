/* 样本内外对比：验证"高期望配置"是否只是调参假象 */
const fs = require('fs');
const html = fs.readFileSync('../周易玄学选股.html', 'utf8');
global.window = {};
eval(html.match(/<script id="engine-script">([\s\S]*?)<\/script>/)[1]);
const X = global.window.Xuan;
const klines = JSON.parse(fs.readFileSync('kline_cache.json', 'utf8'));
const COST = 0.001;
const codes = Object.keys(klines);
const dayCount = {};
codes.forEach(c => klines[c].forEach(k => dayCount[k.d] = (dayCount[k.d] || 0) + 1));
const days = Object.keys(dayCount).filter(d => dayCount[d] > codes.length * 0.5).sort();
const win = days.slice(-30), dayIdx = new Map(days.map((d, i) => [d, i]));

const setups = [];
for (const code of codes) {
  const map = new Map(klines[code].map(k => [k.d, k]));
  for (const d of win) {
    const bar = map.get(d); if (!bar || bar.o <= 0 || bar.h === bar.l) continue;
    const i = dayIdx.get(d); if (i + 1 >= days.length) continue;
    const [y, m, dd] = d.split('-').map(Number);
    const r = X.analyze(code, new Date(y, m - 1, dd, 10, 0, 0), bar.o, { name: code, price: bar.o, prevClose: bar.o, chg: 0 });
    if (r.error || r.S < 66 || bar.l > r.pts.b1) continue;
    const bars = days.slice(i + 1, i + 6).map(x => klines[code].find(k => k.d === x)).filter(Boolean);
    if (!bars.length) continue;
    setups.push({ code, d, entry: r.pts.b1, bars });
  }
}
function evalCfg(list, t, s, h) {
  let n = 0, wins = 0, sum = 0;
  for (const x of list) {
    if (!x.bars.length) continue;
    const tgt = x.entry * (1 + t / 100), stp = x.entry * (1 - s / 100);
    let exit = null;
    for (let k = 0; k < Math.min(h, x.bars.length); k++) {
      const b = x.bars[k];
      if (b.l <= stp) { exit = Math.min(stp, b.o); break; }   // 跳空低开按开盘价成交，不用止损价
      if (b.h >= tgt) { exit = tgt; break; }                   // 止盈保守按目标价
      if (k === Math.min(h, x.bars.length) - 1) exit = b.c;
    }
    if (exit == null) exit = x.bars[x.bars.length - 1].c;
    const ret = exit / x.entry - 1 - COST;
    n++; sum += ret; if (ret > 0) wins++;
  }
  return n ? { n, wr: wins / n * 100, avg: sum / n * 100 } : null;
}
const half = Math.floor(win.length / 2);
const train = setups.filter(x => win.indexOf(x.d) < half), test = setups.filter(x => win.indexOf(x.d) >= half);
console.log(`训练段 ${win[0]}→${win[half - 1]} (${train.length} 笔) | 测试段 ${win[half]}→${win[win.length - 1]} (${test.length} 笔)\n`);
console.log('配置            训练:胜率/平均      测试:胜率/平均');
for (const [t, s, h] of [[5, 0.5, 1], [3, 0.5, 3], [1.5, 2, 3], [0.5, 5, 5], [2, 2, 3]]) {
  const a = evalCfg(train, t, s, h), b = evalCfg(test, t, s, h);
  console.log(`目标${String(t).padStart(3)}%/止损${String(s).padStart(3)}%/持${h}日  ${a.wr.toFixed(1)}% / ${a.avg.toFixed(2)}%      ${b.wr.toFixed(1)}% / ${b.avg.toFixed(2)}%`);
}
