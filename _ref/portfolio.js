/* 组合回测：复合因子 top-N vs 玄学 top-N vs 等权基准 */
const fs = require('fs');
const h = fs.readFileSync('../周易玄学选股.html', 'utf8');
global.window = {};
eval(h.match(/<script id="engine-script">([\s\S]*?)<\/script>/)[1]);
const X = global.window.Xuan;
const K = JSON.parse(fs.readFileSync('kline800.json', 'utf8'));

const HOLD = 5, TOPN = 30, COST = 0.0015, LOOKBACK = 25, JUMP = 0.115;

/* 逐日快照 */
const byDate = new Map();
for (const [code, bars] of Object.entries(K)) {
  if (bars.length < 40) continue;
  const c = bars.map(b => b[2]), v = bars.map(b => b[5]);
  const ret = c.map((x, i) => i ? x / c[i - 1] - 1 : 0);
  const bad = ret.map(r => Math.abs(r) > JUMP);
  for (let i = LOOKBACK; i + HOLD < bars.length; i++) {
    let jump = false;
    for (let k = i - LOOKBACK; k <= i; k++) if (bad[k]) { jump = true; break; }
    if (jump || c[i] < 2) continue;
    const ma20 = c.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20;
    const r20 = ret.slice(i - 19, i + 1);
    const mu = r20.reduce((a, b) => a + b, 0) / 20;
    const stdev = Math.sqrt(r20.reduce((a, b) => a + (b - mu) ** 2, 0) / 20);
    const v5 = v.slice(i - 4, i + 1).reduce((a, b) => a + b, 0) / 5;
    const v20 = v.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20;
    const d = bars[i][0];
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push({
      code, i, date: d,
      lowvol: -stdev,
      bias: -(c[i] / ma20 - 1),
      volshrink: v20 > 0 ? -(v5 / v20) : 0,
      fwd: c[i + HOLD] / c[i] - 1
    });
  }
}
const dates = [...byDate.keys()].sort();
console.log(`交易日 ${dates.length}（${dates[0]} → ${dates[dates.length - 1]}），每 ${HOLD} 日调仓，持仓 ${TOPN} 只`);

/* 横截面排名 → 0~1 */
function rankNorm(rows, key) {
  const sorted = [...rows].sort((a, b) => a[key] - b[key]);
  const m = new Map();
  sorted.forEach((r, i) => m.set(r, i / (rows.length - 1)));
  return m;
}

function backtest(mode) {
  const eq = [1], bench = [1], periods = [];
  let prevPick = null;
  for (let t = LOOKBACK; t + HOLD < dates.length; t += HOLD) {
    const d = dates[t];
    const rows = byDate.get(d) || [];
    if (rows.length < 200) continue;

    let scored;
    if (mode === 'factor') {
      const a = rankNorm(rows, 'lowvol'), b = rankNorm(rows, 'volshrink'), c2 = rankNorm(rows, 'bias');
      scored = rows.map(r => ({ ...r, score: (a.get(r) + b.get(r) + c2.get(r)) / 3 }));
    } else {
      const [y, m, dd] = d.split('-').map(Number);
      const info = X.nowInfo(new Date(y, m - 1, dd, 10, 0, 0));
      const pre = { info, shi: X.timeGua(info) };
      scored = rows.map(r => {
        const res = X.analyze(r.code, info.date, K[r.code][r.i][2], null, pre);
        return { ...r, score: res.error ? 0 : res.S };
      });
    }
    scored.sort((x, y) => y.score - x.score);
    const pick = scored.slice(0, TOPN);
    const r = pick.reduce((s, x) => s + x.fwd, 0) / pick.length - COST;
    const bm = rows.reduce((s, x) => s + x.fwd, 0) / rows.length;
    eq.push(eq[eq.length - 1] * (1 + r));
    bench.push(bench[bench.length - 1] * (1 + bm));
    periods.push({ d, r, bm });
  }
  const total = eq[eq.length - 1] - 1;
  const bmTotal = bench[bench.length - 1] - 1;
  let peak = 1, mdd = 0;
  eq.forEach(v => { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); });
  const wins = periods.filter(p => p.r > 0).length / periods.length;
  const beat = periods.filter(p => p.r > p.bm).length / periods.length;
  const yrs = periods.length * HOLD / 244;
  const cagr = Math.pow(1 + total, 1 / yrs) - 1;
  const sd = Math.sqrt(periods.reduce((s, p) => s + (p.r - periods.reduce((a, b) => a + b.r, 0) / periods.length) ** 2, 0) / periods.length);
  const sharpe = (periods.reduce((a, b) => a + b.r, 0) / periods.length) / sd * Math.sqrt(244 / HOLD);
  return { total, bmTotal, mdd, wins, beat, cagr, sharpe, n: periods.length, eq };
}

const f = backtest('factor');
const xu = backtest('xuan');

const pct = v => (v * 100).toFixed(1) + '%';
console.log('\n策略              累计收益   年化    最大回撤  每期胜率  跑赢基准  夏普');
console.log(`复合因子 top${TOPN}     ${pct(f.total).padStart(8)} ${pct(f.cagr).padStart(7)} ${pct(f.mdd).padStart(9)} ${pct(f.wins).padStart(8)} ${pct(f.beat).padStart(8)} ${f.sharpe.toFixed(2).padStart(6)}`);
console.log(`玄学评分 top${TOPN}     ${pct(xu.total).padStart(8)} ${pct(xu.cagr).padStart(7)} ${pct(xu.mdd).padStart(9)} ${pct(xu.wins).padStart(8)} ${pct(xu.beat).padStart(8)} ${xu.sharpe.toFixed(2).padStart(6)}`);
console.log(`等权基准（全市场）      ${pct(f.bmTotal).padStart(8)}`);
console.log(`\n调仓期数 ${f.n}（约 ${(f.n * HOLD / 244).toFixed(1)} 年）`);
