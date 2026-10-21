/* 因子 vs 玄学：同一套横截面 IC 口径 */
const fs = require('fs');
const h = fs.readFileSync('../周易玄学选股.html', 'utf8');
global.window = {};
eval(h.match(/<script id="engine-script">([\s\S]*?)<\/script>/)[1]);
const X = global.window.Xuan;
const K = JSON.parse(fs.readFileSync('kline300.json', 'utf8'));

const FWD = 5;                 // 预测未来 5 日收益
const LOOKBACK = 25;           // 因子回看窗口
const JUMP = 0.115;            // 超过 ±11.5% 的日涨跌视为除权/异常，剔除窗口

/* 1. 逐股构造样本 */
const byDate = new Map();      // date -> [{code, rev5, lowvol, bias, volshrink, mom20, xs, fwd}]
let skipped = 0;

for (const [code, bars] of Object.entries(K)) {
  if (bars.length < 40) continue;
  const c = bars.map(b => b[2]), o = bars.map(b => b[1]), v = bars.map(b => b[5]);
  const ret = c.map((x, i) => i ? x / c[i - 1] - 1 : 0);
  const bad = ret.map(r => Math.abs(r) > JUMP);

  for (let i = LOOKBACK; i + FWD < bars.length; i++) {
    /* 窗口内不能有跳空（除权） */
    let hasJump = false;
    for (let k = i - LOOKBACK; k <= i; k++) if (bad[k]) { hasJump = true; break; }
    if (hasJump) { skipped++; continue; }
    if (c[i] < 2) { skipped++; continue; }

    const rev5 = -(c[i] / c[i - 5] - 1);
    const mom20 = c[i] / c[i - 20] - 1;
    const ma20 = c.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20;
    const bias = -(c[i] / ma20 - 1);
    const r20 = ret.slice(i - 19, i + 1);
    const mu = r20.reduce((a, b) => a + b, 0) / 20;
    const lowvol = -Math.sqrt(r20.reduce((a, b) => a + (b - mu) ** 2, 0) / 20);
    const v5 = v.slice(i - 4, i + 1).reduce((a, b) => a + b, 0) / 5;
    const v20 = v.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20;
    const volshrink = v20 > 0 ? -(v5 / v20) : 0;
    const fwd = c[i + FWD] / c[i] - 1;

    const d = bars[i][0];
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push({ code, rev5, mom20, bias, lowvol, volshrink, fwd, i, date: d });
  }
}

const dates = [...byDate.keys()].sort();
console.log(`样本: ${dates.length} 个交易日 (${dates[0]} → ${dates[dates.length - 1]}) | 剔除跳空/低价: ${skipped}`);

/* 2. 每日横截面 IC */
function spearman(xs, ys) {
  const n = xs.length;
  if (n < 30) return null;
  const rk = arr => {
    const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(n);
    let i = 0;
    while (i < n) {
      let j = i; while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rk(xs), ry = rk(ys);
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return num / Math.sqrt(dx * dy);
}

/* 3. 玄学评分（按日，10:00 起卦）—— 只算 IC 用，故每 2 日抽一次以控时 */
const XUAN_STEP = 2;
const xuanIC = [];
console.log('计算玄学评分 IC（隔日抽样）…');
let cnt = 0;
for (const d of dates) {
  if (cnt++ % XUAN_STEP) continue;
  const rows = byDate.get(d);
  const [y, m, dd] = d.split('-').map(Number);
  const info = X.nowInfo(new Date(y, m - 1, dd, 10, 0, 0));
  const shi = X.timeGua(info);
  const pre = { info, shi };
  const xs = [], ys = [];
  for (const r of rows) {
    const a = X.analyze(r.code, info.date, K[r.code][r.i][2], null, pre);
    if (a.error) continue;
    r.xs = a.S;
    xs.push(a.S); ys.push(r.fwd);
  }
  const ic = spearman(xs, ys);
  if (ic != null) xuanIC.push(ic);
}

/* 4. 统计 */
const factors = [
  ['REV5  短期反转', 'rev5'],
  ['LOWVOL20 低波', 'lowvol'],
  ['BIAS20 超跌', 'bias'],
  ['VOLSHRINK 缩量', 'volshrink'],
  ['MOM20 动量', 'mom20']
];
function stat(ics) {
  const n = ics.length, mu = ics.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(ics.reduce((a, b) => a + (b - mu) ** 2, 0) / n);
  return { n, mu, sd, ir: mu / sd, t: mu / sd * Math.sqrt(n), hit: ics.filter(x => x > 0).length / n };
}

console.log('\n因子                    IC均值    IC标准差  ICIR    t值     IC>0占比');
const results = [];
for (const [name, key] of factors) {
  const ics = [];
  for (const d of dates) {
    const rows = byDate.get(d);
    const ic = spearman(rows.map(r => r[key]), rows.map(r => r.fwd));
    if (ic != null) ics.push(ic);
  }
  const s = stat(ics);
  results.push({ name, ...s });
  console.log(`${name.padEnd(22)} ${s.mu.toFixed(4).padStart(8)} ${s.sd.toFixed(3).padStart(8)} ${s.ir.toFixed(2).padStart(7)} ${s.t.toFixed(1).padStart(7)} ${(s.hit * 100).toFixed(1).padStart(8)}%`);
}
const sx = stat(xuanIC);
console.log(`${'玄学评分（对照）'.padEnd(20)} ${sx.mu.toFixed(4).padStart(8)} ${sx.sd.toFixed(3).padStart(8)} ${sx.ir.toFixed(2).padStart(7)} ${sx.t.toFixed(1).padStart(7)} ${(sx.hit * 100).toFixed(1).padStart(8)}%   (${sx.n} 天)`);

/* 5. 分层收益（最强因子 vs 最弱因子 vs 玄学） */
function decile(key, xuan) {
  const buckets = Array.from({ length: 10 }, () => []);
  for (const d of dates) {
    const rows = byDate.get(d);
    const valid = rows.filter(r => xuan ? (r.xs != null) : (r[key] != null));
    if (valid.length < 100) continue;
    const arr = valid.map(r => ({ v: xuan ? r.xs : r[key], f: r.fwd })).sort((a, b) => a.v - b.v);
    arr.forEach((x, i) => buckets[Math.min(9, Math.floor(i / arr.length * 10))].push(x.f));
  }
  return buckets.map(b => b.length ? b.reduce((a, c) => a + c, 0) / b.length * 100 : NaN);
}

const best = results.slice().sort((a, b) => Math.abs(b.mu) - Math.abs(a.mu))[0];
const keyMap = { 'REV5  短期反转': 'rev5', 'LOWVOL20 低波': 'lowvol', 'BIAS20 超跌': 'bias', 'VOLSHRINK 缩量': 'volshrink', 'MOM20 动量': 'mom20' };
console.log(`\n分层收益（未来5日，%）：最强因子 = ${best.name}`);
console.log('十分位  1(最低)  2     3     4     5     6     7     8     9   10(最高)   多空差');
const dd1 = decile(keyMap[best.name], false);
console.log('       ' + dd1.map(x => x.toFixed(2).padStart(6)).join('') + '   ' + (dd1[9] - dd1[0]).toFixed(2).padStart(7));

console.log('\n玄学评分分层：');
const dd2 = decile(null, true);
console.log('       ' + dd2.map(x => x.toFixed(2).padStart(6)).join('') + '   ' + (dd2[9] - dd2[0]).toFixed(2).padStart(7));
