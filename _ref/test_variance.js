/* 检验：同一批股票在不同日期/时辰下，卦象与排名变化有多大 */
const fs = require('fs');
const html = fs.readFileSync('../周易玄学选股.html', 'utf8');
global.window = {};
eval(html.match(/<script id="engine-script">([\s\S]*?)<\/script>/)[1]);
const X = global.window.Xuan;
const DATA = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const codes = DATA.list.map(r => r[0]);
const price = {};
DATA.list.forEach(r => price[r[0]] = r[2]);

function run(date) {
  const rows = codes.map(c => {
    const a = X.analyze(c, date, price[c]);
    return { c, S: a.error ? 0 : a.S, gua: a.zhu ? a.zhu.gua.label : '', yao: a.zhu ? a.zhu.yaoName : '' };
  });
  rows.sort((x, y) => y.S - x.S);
  return rows;
}

/* 天时数 T = 年支 + 农历月 + 农历日 + 时支 */
function Tof(date) {
  const i = X.nowInfo(date);
  return i.yearBranch + i.lunar.m + i.lunar.d + i.hourBranch;
}

const days = [];
for (let d = 20; d <= 30; d++) {
  const dt = new Date(2026, 9, d, 9, 45, 0);
  if (dt.getDay() === 0 || dt.getDay() === 6) continue;
  days.push(dt);
}
const dayLabels = days.map(d => `${d.getMonth() + 1}-${d.getDate()}`);

/* 1. 连续交易日对比（同一时辰 09:45 巳时） */
const res = days.map(run);
const top = res.map(r => new Set(r.slice(0, 50).map(x => x.c)));
function jac(a, b) { let n = 0; for (const v of a) if (b.has(v)) n++; return n / (a.size + b.size - n); }
function spearman(a, b) {
  const map = new Map(b.map((x, i) => [x.c, i]));
  const n = a.length, d2 = a.reduce((s, x, i) => { const j = map.get(x.c); return s + (i - j) ** 2; }, 0);
  return 1 - 6 * d2 / (n * (n * n - 1));
}
function sameGua(a, b) {
  const m = new Map(b.map(x => [x.c, x.gua + x.yao]));
  return a.filter(x => m.get(x.c) === x.gua + x.yao).length / a.length;
}

console.log('== 天时数 T 与卦象联动 ==');
days.forEach((d, i) => {
  const g = X.timeGua(X.nowInfo(d));
  console.log(`  ${dayLabels[i]} 巳时  T=${Tof(d)}  天时卦=${g.gua.label}${g.yaoName}  (下卦=${g.gua.data.lo}, 动爻=${g.moving})`);
});

console.log('\n== 连续交易日：Top50 重合率 / 卦象不变率 / 排名相关 ==');
for (let i = 1; i < days.length; i++) {
  console.log(`  ${dayLabels[i - 1]} → ${dayLabels[i]}   Top50重合 ${(jac(top[i - 1], top[i]) * 100).toFixed(0)}%   个股卦象不变 ${(sameGua(res[i - 1], res[i]) * 100).toFixed(0)}%   排名相关 ρ=${spearman(res[i - 1], res[i]).toFixed(2)}`);
}

console.log('\n== 同一交易日内换时辰（巳 → 午 → 未） ==');
const intra = [9.75, 12, 14.5].map(h => run(new Date(2026, 9, 20, Math.floor(h), Math.round((h % 1) * 60), 0)));
const intraTop = intra.map(r => new Set(r.slice(0, 50).map(x => x.c)));
console.log(`  巳(09:45) → 午(12:00)   Top50重合 ${(jac(intraTop[0], intraTop[1]) * 100).toFixed(0)}%   卦象不变 ${(sameGua(intra[0], intra[1]) * 100).toFixed(0)}%`);
console.log(`  午(12:00) → 未(14:30)   Top50重合 ${(jac(intraTop[1], intraTop[2]) * 100).toFixed(0)}%   卦象不变 ${(sameGua(intra[1], intra[2]) * 100).toFixed(0)}%`);
console.log(`  巳(09:45) → 未(14:30)   Top50重合 ${(jac(intraTop[0], intraTop[2]) * 100).toFixed(0)}%   卦象不变 ${(sameGua(intra[0], intra[2]) * 100).toFixed(0)}%`);

/* 2. 周期检验：T 加 24 是否回到同一卦 */
console.log('\n== 周期检验（卦象是否 24 日一循环） ==');
for (const gap of [1, 8, 12, 24]) {
  const a = new Date(2026, 9, 20, 9, 45), b = new Date(2026, 9, 20 + gap, 9, 45);
  const ra = run(a), rb = run(b);
  console.log(`  +${gap} 日  卦象不变 ${(sameGua(ra, rb) * 100).toFixed(1)}%   Top50重合 ${(jac(new Set(ra.slice(0, 50).map(x => x.c)), new Set(rb.slice(0, 50).map(x => x.c))) * 100).toFixed(0)}%   T差=${Tof(b) - Tof(a)}`);
}

/* 3. 结构性统计：上卦是否永远不变 */
console.log('\n== 结构分解 ==');
const a1 = new Date(2026, 9, 20, 9, 45), a2 = new Date(2026, 10, 20, 9, 45);
const up1 = {}, up2 = {};
for (const c of codes) { up1[c] = X.stockGua(c, X.nowInfo(a1)).gua.data.up; up2[c] = X.stockGua(c, X.nowInfo(a2)).gua.data.up; }
console.log(`  上卦 30 天后不变的比例: ${(codes.filter(c => up1[c] === up2[c]).length / codes.length * 100).toFixed(1)}%`);
const lo1 = {}, lo2 = {};
for (const c of codes) { lo1[c] = X.stockGua(c, X.nowInfo(a1)).gua.data.lo; lo2[c] = X.stockGua(c, X.nowInfo(a2)).gua.data.lo; }
console.log(`  下卦 30 天后不变的比例: ${(codes.filter(c => lo1[c] === lo2[c]).length / codes.length * 100).toFixed(1)}%`);
const dist = {};
res[0].forEach(r => dist[r.S.toFixed(0)] = (dist[r.S.toFixed(0)] || 0) + 1);
console.log('  今日分数分布(前12档):', Object.entries(dist).sort((a, b) => b[0] - a[0]).slice(0, 12).map(([k, v]) => k + '分:' + v).join('  '));
const uniqGua = new Set(res[0].map(r => r.gua + r.yao));
console.log(`  今日 3125 只共 ${uniqGua.size} 种卦断`);
