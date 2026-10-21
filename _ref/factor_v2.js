/* v2：按研报标准流程重做 —— 去极值 / 标准化 / 市值代理中性化 / 分层单调性 / 市场择时 */
const fs = require('fs');
const K = JSON.parse(fs.readFileSync('kline800.json', 'utf8'));

const HOLD = 5, LOOKBACK = 65, JUMP = 0.115;

/* ---------- 1. 构建横截面（含市值代理：20日均成交额） ---------- */
const byDate = new Map();
for (const [code, bars] of Object.entries(K)) {
  if (bars.length < LOOKBACK + 20) continue;
  const c = bars.map(b => b[2]), v = bars.map(b => b[5]);
  const ret = c.map((x, i) => i ? x / c[i - 1] - 1 : 0);
  const bad = ret.map(r => Math.abs(r) > JUMP);
  for (let i = LOOKBACK; i + HOLD < bars.length; i++) {
    let jump = false;
    for (let k = i - LOOKBACK; k <= i; k++) if (bad[k]) { jump = true; break; }
    if (jump || c[i] < 2) continue;
    const r60 = ret.slice(i - 59, i + 1);
    const mu = r60.reduce((a, b) => a + b, 0) / 60;
    const lowvol = -Math.sqrt(r60.reduce((a, b) => a + (b - mu) ** 2, 0) / 60);
    const rev20 = -(c[i] / c[i - 20] - 1);
    const v5 = v.slice(i - 4, i + 1).reduce((a, b) => a + b, 0) / 5;
    const v60 = v.slice(i - 59, i + 1).reduce((a, b) => a + b, 0) / 60;
    const volshrink = v60 > 0 ? -(v5 / v60) : 0;
    const turnover = v.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20 * c[i];  // 日均成交额，规模代理
    const fwd = c[i + HOLD] / c[i] - 1;
    const d = bars[i][0];
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push({ code, i, lowvol, rev20, volshrink, turnover, fwd, date: d });
  }
}
const dates = [...byDate.keys()].sort();
console.log(`横截面 ${dates.length} 天（${dates[0]} → ${dates[dates.length - 1]}）`);

/* ---------- 2. 预处理：MAD 去极值 + z-score + 规模中性化 ---------- */
function mad(arr) {
  const m = [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)];
  const dev = arr.map(x => Math.abs(x - m));
  const mad = [...dev].sort((a, b) => a - b)[Math.floor(dev.length / 2)] || 1e-9;
  return { m, mad: mad * 1.4826 };
}
function zscore(vals) {
  const n = vals.length, mu = vals.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mu) ** 2, 0) / n) || 1e-9;
  return vals.map(v => (v - mu) / sd);
}
/* 按规模分 5 组，组内标准化 → 近似市值中性 */
function neutralize(rows, key) {
  const vals = rows.map(r => r[key]);
  const { m, mad: md } = mad(vals);
  rows.forEach(r => { r[key + '_c'] = Math.max(m - 3 * md, Math.min(m + 3 * md, r[key])); });
  const sorted = [...rows].sort((a, b) => a.turnover - b.turnover);
  const G = 5;
  for (let g = 0; g < G; g++) {
    const part = sorted.slice(Math.floor(g * rows.length / G), Math.floor((g + 1) * rows.length / G));
    if (part.length < 5) continue;
    const z = zscore(part.map(r => r[key + '_c']));
    part.forEach((r, i) => { r[key + '_z'] = z[i]; });
  }
  rows.forEach(r => { if (r[key + '_z'] == null) r[key + '_z'] = 0; });
}

/* ---------- 3. 复合因子 + 分层单调性 ---------- */
const deciles = Array.from({ length: 10 }, () => ({ sum: 0, n: 0 }));
for (const d of dates) {
  const rows = byDate.get(d);
  if (rows.length < 300) continue;
  ['lowvol', 'rev20', 'volshrink'].forEach(k => neutralize(rows, k));
  rows.forEach(r => { r.score = (r.lowvol_z + r.rev20_z + r.volshrink_z) / 3; });
  const sorted = [...rows].sort((a, b) => a.score - b.score);
  sorted.forEach((r, i) => {
    const b = Math.min(9, Math.floor(i / sorted.length * 10));
    deciles[b].sum += r.fwd; deciles[b].n++;
  });
}
console.log('\n复合因子分层（未来5日平均收益，%）—— 单调才可用：');
const decAvg = deciles.map(x => x.sum / x.n * 100);
console.log('档位   ' + Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(6)).join(''));
console.log('收益   ' + decAvg.map(x => x.toFixed(2).padStart(6)).join('') + `   多空差 ${(decAvg[9] - decAvg[0]).toFixed(2)}`);

/* ---------- 4. 组合回测：等权指数 + MA20 择时 ---------- */
/* 先建等权市场指数（用横截面均值近似） */
const mkt = dates.map(d => {
  const rows = byDate.get(d);
  return rows.reduce((s, r) => s + r.fwd, 0) / rows.length;
});

function backtest(bucketLo, bucketHi, timing, t0, t1) {
  const eq = [1], bench = [1];
  let periods = 0, wins = 0, inMkt = 0;
  const from = t0 || 0, to = t1 || dates.length;
  for (let t = from; t + HOLD < to; t += HOLD) {
    const d = dates[t];
    const rows = byDate.get(d);
    if (rows.length < 300) continue;
    ['lowvol', 'rev20', 'volshrink'].forEach(k => neutralize(rows, k));
    rows.forEach(r => { r.score = (r.lowvol_z + r.rev20_z + r.volshrink_z) / 3; });
    const sorted = [...rows].sort((a, b) => a.score - b.score);
    const lo = Math.floor(sorted.length * bucketLo), hi = Math.floor(sorted.length * bucketHi);
    const pick = sorted.slice(lo, hi);

    /* 择时：只用「已实现」的最近 4 期（=20 个交易日）等权市场收益，避免前视偏差 */
    let hold = true;
    if (timing) {
      const idxs = [];
      for (let k = 1; k <= 4; k++) { const j = t - k * HOLD; if (j >= 0) idxs.push(j); }
      hold = idxs.length ? idxs.reduce((s, j) => s + mkt[j], 0) > 0 : true;
    }
    const r = hold ? pick.reduce((s, x) => s + x.fwd, 0) / pick.length - 0.0015 : 0;
    const bm = rows.reduce((s, x) => s + x.fwd, 0) / rows.length;
    if (hold) inMkt++;
    eq.push(eq[eq.length - 1] * (1 + r));
    bench.push(bench[bench.length - 1] * (1 + bm));
    if (hold) { periods++; if (r > 0) wins++; }
  }
  const total = eq[eq.length - 1] - 1, bmT = bench[bench.length - 1] - 1;
  let peak = 1, mdd = 0;
  eq.forEach(v => { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); });
  const yrs = (eq.length - 1) * HOLD / 244;
  return { total, cagr: Math.pow(1 + total, 1 / yrs) - 1, mdd, wr: periods ? wins / periods : 0, bmT, inMkt: inMkt / (eq.length - 1) };
}

const pct = v => (v * 100).toFixed(1) + '%';
console.log('\n组合回测（每5日调仓，成本0.15%）');
console.log('方案                          累计     年化   回撤    胜率   场内占比');
const cases = [
  ['头部10%（第9-10档）无择时', 0.8, 1.0, false],
  ['头部10% + MA20择时', 0.8, 1.0, true],
  ['中部30%（第5-7档）无择时', 0.4, 0.7, false],
  ['中部30% + MA20择时', 0.4, 0.7, true],
  ['尾部10%（第1档）无择时', 0.0, 0.1, false]
];
for (const [name, lo, hi, tm] of cases) {
  const r = backtest(lo, hi, tm);
  console.log(`${name.padEnd(28)} ${pct(r.total).padStart(7)} ${pct(r.cagr).padStart(7)} ${pct(r.mdd).padStart(7)} ${pct(r.wr).padStart(7)} ${pct(r.inMkt).padStart(8)}`);
}
console.log(`\n等权基准（全市场，买入持有）   ${pct(backtest(0, 1, false).bmT).padStart(7)}`);

/* ---------- 5. 分段稳健性：前半段 / 后半段 ---------- */
const mid = Math.floor(dates.length / 2);
console.log(`\n分段检验（中部30% + 择时）  前半 ${dates[0]}→${dates[mid]} ｜ 后半 ${dates[mid]}→${dates[dates.length - 1]}`);
const h1 = backtest(0.4, 0.7, true, 0, mid);
const h2 = backtest(0.4, 0.7, true, mid, dates.length);
const b1 = backtest(0.4, 0.7, false, 0, mid);
const b2 = backtest(0.4, 0.7, false, mid, dates.length);
console.log(`  前半段  有择时 ${pct(h1.total).padStart(7)} (胜率 ${pct(h1.wr)}, 回撤 ${pct(h1.mdd)})   无择时 ${pct(b1.total).padStart(7)}`);
console.log(`  后半段  有择时 ${pct(h2.total).padStart(7)} (胜率 ${pct(h2.wr)}, 回撤 ${pct(h2.mdd)})   无择时 ${pct(b2.total).padStart(7)}`);
