/* 回测 v2：严格 T+1，扫描出场参数，回答"胜率能不能提高、代价是什么" */
const fs = require('fs');
const html = fs.readFileSync('../周易玄学选股.html', 'utf8');
global.window = {};
eval(html.match(/<script id="engine-script">([\s\S]*?)<\/script>/)[1]);
const X = global.window.Xuan;
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const klines = JSON.parse(fs.readFileSync('kline_cache.json', 'utf8'));
const COST = 0.001;

const codes = Object.keys(klines);
const dayCount = {};
codes.forEach(c => klines[c].forEach(k => dayCount[k.d] = (dayCount[k.d] || 0) + 1));
const days = Object.keys(dayCount).filter(d => dayCount[d] > codes.length * 0.5).sort();
const win = days.slice(-30);                       // 决策日
const dayIdx = new Map(days.map((d, i) => [d, i]));

/* 天时（大盘）分：每天 10:00 的时运卦 */
const marketScore = {};
for (const d of days) {
  const [y, m, dd] = d.split('-').map(Number);
  const g = X.timeGua(X.nowInfo(new Date(y, m - 1, dd, 10, 0, 0)));
  marketScore[d] = Math.max(1, Math.min(100, g.base));
}

/* 建仓清单：决策日 D、开盘价挂买一、当日最低触及即成交 */
const setups = [];
let blocked = 0;
for (const code of codes) {
  const ks = klines[code];
  const map = new Map(ks.map((k, i) => [k.d, { ...k, i }]));
  for (const d of win) {
    const bar = map.get(d);
    if (!bar || bar.o <= 0) continue;
    if (bar.h === bar.l) { blocked++; continue; }       // 一字板
    const i = dayIdx.get(d);
    if (i + 1 >= days.length) continue;                 // 没有次日，无法卖出
    const [y, m, dd] = d.split('-').map(Number);
    const r = X.analyze(code, new Date(y, m - 1, dd, 10, 0, 0), bar.o,
      { name: code, price: bar.o, prevClose: bar.o, chg: 0 });
    if (r.error) continue;
    if (r.S < 66) continue;
    if (bar.l > r.pts.b1) continue;                     // 买一未触及
    setups.push({
      code, d, i, entry: r.pts.b1, S: r.S, guaStop: r.pts.stop,
      mkS: marketScore[d],
      bars: days.slice(i + 1, i + 1 + 10).map(x => klines[code].find(k => k.d === x)).filter(Boolean)
    });
  }
}
console.log('可执行建仓机会:', setups.length, '| 一字板跳过:', blocked);
console.log('决策区间:', win[0], '→', win[win.length - 1]);

/* ---------- 参数扫描：目标% / 止损% / 最长持有日 ---------- */
function run(targetPct, stopPct, holdDays, useGuaStop) {
  let n = 0, wins = 0, sum = 0, sumW = 0, sumL = 0, wc = 0, lc = 0, timedOut = 0;
  for (const s of setups) {
    const tgt = s.entry * (1 + targetPct / 100);
    const stp = useGuaStop ? s.guaStop : s.entry * (1 - stopPct / 100);
    let exit = null, reason = '';
    for (let k = 0; k < Math.min(holdDays, s.bars.length); k++) {
      const b = s.bars[k];
      if (b.l <= stp) { exit = stp; reason = '止损'; break; }   // 保守：次日先判止损
      if (b.h >= tgt) { exit = tgt; reason = '止盈'; break; }
      if (k === holdDays - 1 || k === s.bars.length - 1) { exit = b.c; reason = '到期'; }
    }
    if (exit == null) { exit = s.bars[s.bars.length - 1].c; reason = '到期'; }
    if (reason === '到期') timedOut++;
    const ret = exit / s.entry - 1 - COST;
    n++; sum += ret;
    if (ret > 0) { wins++; sumW += ret; wc++; } else { sumL += ret; lc++; }
  }
  return {
    n, winRate: wins / n * 100, avg: sum / n * 100,
    avgW: wc ? sumW / wc * 100 : 0, avgL: lc ? sumL / lc * 100 : 0,
    pl: lc && wc ? Math.abs((sumW / wc) / (sumL / lc)) : 0, timedOut
  };
}

const rows = [];
for (const t of [0.5, 1, 1.5, 2, 3, 5]) {
  for (const s of [0.5, 1, 1.5, 2, 3, 5]) {
    for (const h of [1, 3, 5]) {
      const r = run(t, s, h, false);
      rows.push({ ...r, t, s, h });
    }
  }
}
const guaBase = run(3, 0, 5, true);

console.log('\n===== 按胜率排序（前 12）=====');
console.log('目标% 止损% 持有 笔数   胜率   平均%   均盈%   均亏%  盈亏比');
rows.slice().sort((a, b) => b.winRate - a.winRate).slice(0, 12).forEach(r =>
  console.log(`${String(r.t).padStart(4)} ${String(r.s).padStart(5)} ${String(r.h).padStart(3)} ${String(r.n).padStart(6)} ${r.winRate.toFixed(1).padStart(6)}% ${r.avg.toFixed(2).padStart(7)} ${r.avgW.toFixed(2).padStart(6)} ${r.avgL.toFixed(2).padStart(6)} ${r.pl.toFixed(2).padStart(6)}`));

console.log('\n===== 按期望值排序（前 12）=====');
console.log('目标% 止损% 持有 笔数   胜率   平均%   盈亏比');
rows.slice().sort((a, b) => b.avg - a.avg).slice(0, 12).forEach(r =>
  console.log(`${String(r.t).padStart(4)} ${String(r.s).padStart(5)} ${String(r.h).padStart(3)} ${String(r.n).padStart(6)} ${r.winRate.toFixed(1).padStart(6)}% ${r.avg.toFixed(2).padStart(7)} ${r.pl.toFixed(2).padStart(6)}`));

console.log('\n===== 卦位止损（工具原版口径）+ 持有5日 =====');
console.log(`笔数 ${guaBase.n} | 胜率 ${guaBase.winRate.toFixed(1)}% | 平均 ${guaBase.avg.toFixed(2)}% | 盈亏比 ${guaBase.pl.toFixed(2)}`);

/* 天时过滤：只在时运卦 >=60 分时开仓 */
console.log('\n===== 天时过滤（目标1.5%/止损2%/持3日）=====');
for (const cut of [0, 45, 50, 55, 60]) {
  const sub = setups.filter(s => s.mkS >= cut);
  let n = 0, wins = 0, sum = 0;
  for (const s of sub) {
    const tgt = s.entry * 1.015, stp = s.entry * 0.98;
    let exit = null;
    for (let k = 0; k < Math.min(3, s.bars.length); k++) {
      const b = s.bars[k];
      if (b.l <= stp) { exit = stp; break; }
      if (b.h >= tgt) { exit = tgt; break; }
      if (k === 2 || k === s.bars.length - 1) exit = b.c;
    }
    if (exit == null) exit = s.bars[s.bars.length - 1].c;
    const ret = exit / s.entry - 1 - COST;
    n++; sum += ret; if (ret > 0) wins++;
  }
  console.log(`  天时≥${String(cut).padStart(2)}: ${String(n).padStart(5)} 笔 | 胜率 ${(wins / n * 100).toFixed(1)}% | 平均 ${(sum / n * 100).toFixed(2)}%`);
}
