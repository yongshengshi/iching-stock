/* 历史回测：抓主板全部日K（缓存），按工具规则模拟交易 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('../周易玄学选股.html', 'utf8');
global.window = {};
eval(html.match(/<script id="engine-script">([\s\S]*?)<\/script>/)[1]);
const X = global.window.Xuan;
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const CACHE = 'kline_cache.json';

const codes = D.list.map(r => r[0]).filter(c => X.boardOf(c) === '主板');

/* ---------- 抓取 ---------- */
async function fetchK(code) {
  const q = (code[0] === '6' ? 'sh' : 'sz') + code;
  for (let a = 0; a < 3; a++) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
      const res = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${q},day,,,60,qfq&_t=${Date.now()}`, { signal: ctl.signal, cache: 'no-store' });
      clearTimeout(t);
      if (!res.ok) continue;
      const j = await res.json();
      const node = j && j.data && j.data[q];
      const arr = node && (node.qfqday || node.day);
      if (!arr || !arr.length) return null;
      return arr.map(x => ({ d: x[0], o: +x[1], c: +x[2], h: +x[3], l: +x[4], v: +x[5] }));
    } catch (e) { if (a === 2) return null; await new Promise(r => setTimeout(r, 300)); }
  }
  return null;
}

(async () => {
  let klines = {};
  if (fs.existsSync(CACHE)) {
    klines = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    console.log('用缓存 K 线:', Object.keys(klines).length, '只');
  } else {
    let idx = 0, ok = 0;
    const t0 = Date.now();
    await Promise.all(Array.from({ length: 15 }, async () => {
      while (idx < codes.length) {
        const c = codes[idx++];
        const k = await fetchK(c);
        if (k) { klines[c] = k; ok++; }
        if (ok % 200 === 0) process.stdout.write(`  ${ok}/${codes.length}\r`);
      }
    }));
    fs.writeFileSync(CACHE, JSON.stringify(klines));
    console.log(`\n抓取完成 ${((Date.now() - t0) / 1000).toFixed(0)}s，有效 ${ok} 只`);
  }

  /* ---------- 回测 ---------- */
  /* 交易日集合：取出现次数最多的日期，最后 30 个 */
  const dayCount = {};
  Object.values(klines).forEach(ks => ks.forEach(k => dayCount[k.d] = (dayCount[k.d] || 0) + 1));
  const days = Object.keys(dayCount).filter(d => dayCount[d] > Object.keys(klines).length * 0.5).sort().slice(-30);
  console.log('回测区间:', days[0], '→', days[days.length - 1], `(${days.length} 个交易日)`);

  const COST = 0.001;   // 双边成本约 0.1%
  const trades = [];    // 成交记录
  const samples = [];   // 全部样本（含未成交），用于分档与相关性
  let skippedLimit = 0;

  for (const [code, ks] of Object.entries(klines)) {
    const map = new Map(ks.map(k => [k.d, k]));
    for (const d of days) {
      const bar = map.get(d);
      if (!bar) continue;
      if (bar.o <= 0 || bar.h <= 0) continue;
      /* 一字板：当日振幅为 0 或开盘即涨停，无法按买一成交 */
      if (bar.h === bar.l) { skippedLimit++; continue; }

      const [y, m, dd] = d.split('-').map(Number);
      const at = new Date(y, m - 1, dd, 10, 0, 0);          // 巳时 10:00 决策
      const r = X.analyze(code, at, bar.o, { name: code, price: bar.o, prevClose: bar.c * 0 + bar.o, chg: 0 });
      if (r.error) continue;
      const S = r.S, p = r.pts;

      const dayRet = bar.c / bar.o - 1;                     // 基准：开盘买、收盘卖
      samples.push({ code, d, S, dayRet, rel: r.zhu.relTxt.label, gua: r.zhu.gua.label });

      if (S < 66) continue;                                 // 只做「吉」及以上
      if (bar.o < 2) continue;
      /* 挂买一：当日最低价触及才成交 */
      if (bar.l > p.b1) continue;

      const entry = p.b1;
      let exit, why;
      /* 保守假设：若同日同时触及止损与目标，按先止损处理 */
      if (bar.l <= p.stop) { exit = p.stop; why = '止损'; }
      else if (bar.h >= p.t1) { exit = p.t1; why = '止盈'; }
      else { exit = bar.c; why = '收盘平'; }

      const ret = (exit / entry - 1) - COST;
      trades.push({ code, d, S, entry, exit, why, ret });
    }
  }

  /* ---------- 统计 ---------- */
  const n = trades.length;
  const win = trades.filter(t => t.ret > 0);
  const lose = trades.filter(t => t.ret <= 0);
  const avg = trades.reduce((s, t) => s + t.ret, 0) / n;
  const avgWin = win.length ? win.reduce((s, t) => s + t.ret, 0) / win.length : 0;
  const avgLose = lose.length ? lose.reduce((s, t) => s + t.ret, 0) / lose.length : 0;
  const byWhy = {};
  trades.forEach(t => byWhy[t.why] = (byWhy[t.why] || 0) + 1);

  const baseAvg = samples.reduce((s, x) => s + x.dayRet, 0) / samples.length;
  const baseWin = samples.filter(x => x.dayRet > 0).length / samples.length;

  console.log('\n===== 交易结果 =====');
  console.log('样本(股票×日):', samples.length, '| 一字板跳过:', skippedLimit);
  console.log('成交笔数:', n, `(占样本 ${(n / samples.length * 100).toFixed(1)}%)`);
  console.log('胜率:', (win.length / n * 100).toFixed(1) + '%');
  console.log('平均单笔:', (avg * 100).toFixed(2) + '%');
  console.log('平均盈利:', (avgWin * 100).toFixed(2) + '% | 平均亏损:', (avgLose * 100).toFixed(2) + '%');
  console.log('盈亏比:', (Math.abs(avgWin / avgLose)).toFixed(2));
  console.log('期望值/笔:', (avg * 100).toFixed(2) + '%（已扣 0.1% 成本）');
  console.log('出场分布:', JSON.stringify(byWhy));

  console.log('\n===== 基准对照（同期全样本 开盘买→收盘卖）=====');
  console.log('基准平均:', (baseAvg * 100).toFixed(2) + '% | 基准胜率:', (baseWin * 100).toFixed(1) + '%');
  console.log('策略超额:', ((avg - baseAvg) * 100).toFixed(2) + ' 个百分点/笔');

  /* 分档 */
  console.log('\n===== 按评分分档（全部样本，开盘→收盘）=====');
  const buckets = [[0, 40], [40, 52], [52, 66], [66, 78], [78, 101]];
  for (const [lo, hi] of buckets) {
    const g = samples.filter(x => x.S >= lo && x.S < hi);
    if (!g.length) continue;
    const a = g.reduce((s, x) => s + x.dayRet, 0) / g.length;
    const w = g.filter(x => x.dayRet > 0).length / g.length;
    console.log(`  ${lo}–${hi - 1} 分: ${String(g.length).padStart(5)} 样本 | 平均 ${(a * 100).toFixed(2)}% | 上涨占比 ${(w * 100).toFixed(1)}%`);
  }

  /* 相关性 */
  const rank = arr => {
    const s = [...arr].sort((a, b) => a - b), m = new Map();
    s.forEach((v, i) => { if (!m.has(v)) m.set(v, []); m.get(v).push(i); });
    const r = new Map();
    m.forEach((idx, v) => r.set(v, idx.reduce((a, b) => a + b, 0) / idx.length));
    return v => r.get(v);
  };
  const rs = rank(samples.map(x => x.S));
  const rr = rank(samples.map(x => x.dayRet));
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const xs = samples.map(x => rs(x.S)), ys = samples.map(x => rr(x.dayRet));
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  console.log('\n评分 vs 当日涨幅 Spearman ρ =', (num / Math.sqrt(dx * dy)).toFixed(4));
})();
