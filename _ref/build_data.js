/* 构建数据：历法表 + 六十四卦库 + 行情快照 */
const fs = require('fs');
const L = require('./lunar_lib.js');

/* ---------- 1. 农历年表 2020-2040 ---------- */
const lunarYears = {};
for (let y = 2019; y <= 2045; y++) {
  const ly = L.LunarYear.fromYear(y);
  const ms = ly.getMonths().filter(m => m.getYear() === y);
  const months = ms.map(m => [m.getMonth(), m.getDayCount()]);
  const first = L.Lunar.fromYmd(y, 1, 1).getSolar();
  lunarYears[y] = { s: [first.getYear(), first.getMonth(), first.getDay()], m: months };
}

/* ---------- 2. 节气表 2019-2041 ---------- */
const JQ = ['小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至',
            '小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'];
const jieqi = {};
for (let y = 2018; y <= 2046; y++) {
  const arr = new Array(24).fill(0);
  let cur = new Date(y, 0, 1);
  while (cur.getFullYear() === y) {
    const name = L.Lunar.fromDate(cur).getJieQi();
    if (name && JQ.includes(name) && !arr[JQ.indexOf(name)]) arr[JQ.indexOf(name)] = (cur.getMonth() + 1) * 100 + cur.getDate();
    cur.setDate(cur.getDate() + 1);
  }
  jieqi[y] = arr;
}

/* ---------- 3. 日干支基准 ---------- */
function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
    - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
const ref = L.Lunar.fromDate(new Date(2026, 9, 20, 12, 0, 0));
const refDay = ref.getDayInGanZhi();
const GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥';
let refIdx = -1;
for (let i = 0; i < 60; i++) if (GAN[i % 10] === refDay[0] && ZHI[i % 12] === refDay[1]) { refIdx = i; break; }
const OFFSET = refIdx - jdn(2026, 10, 20);
// 校验 5000 天
let bad = 0;
for (let d = 0; d < 5000; d += 7) {
  const dt = new Date(2020, 0, 1 + d);
  const idx = ((jdn(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()) + OFFSET) % 60 + 60) % 60;
  const lib = L.Lunar.fromDate(dt).getDayInGanZhi();
  if (GAN[idx % 10] !== lib[0] || ZHI[idx % 12] !== lib[1]) bad++;
}
console.log('日干支基准 index=' + refIdx + ' offset=' + OFFSET + ' 校验不符=' + bad);

/* ---------- 4. 六十四卦库 + 判词吉凶打分 ---------- */
const raw = JSON.parse(fs.readFileSync('./iching_master.json', 'utf8'));
const POS = [['无不利', 1.8], ['无攸利', -2.0], ['不利', -2.2], ['利涉大川', 1.2], ['利有攸往', 1.2],
  ['利见大人', 1.0], ['无咎', 1.6], ['悔亡', 1.6], ['有孚', 0.8], ['元', 2.0], ['亨', 2.0],
  ['吉', 3.0], ['利', 1.2], ['贞', 0.8], ['凶', -3.0], ['厉', -1.4], ['吝', -1.4], ['悔', -1.0],
  ['勿用', -1.6], ['泣血', -2.0], ['贞凶', -1.0]];
function score(text) {
  let t = text, s = 0;
  for (const [w, v] of POS) {
    let i;
    while ((i = t.indexOf(w)) >= 0) { s += v; t = t.slice(0, i) + '\u0000'.repeat(w.length) + t.slice(i + w.length); }
  }
  return s;
}
function clampScore(text) {
  const clauses = text.split(/[，。；：、！？]/).filter(s => s.trim().length > 0);
  let total = 0;
  for (const c of clauses) total += score(c);
  const n = Math.max(1, clauses.length);
  // 分句数阻尼：避免长文累加导致长度偏差
  return total / (1 + 0.22 * (n - 1));
}
const gua = {};
let gMin = 99, gMax = -99, lMin = 99, lMax = -99;
const lineAll = [];
for (const g of raw) {
  const bin = g.array.join('');
  const lower = g.combination[0], upper = g.combination[1];
  const t = g.scripture.replace(/[“”]/g, '');
  const ls = g.lines.map(l => l.scripture.replace(/[“”]/g, ''));
  const gs = clampScore(t);
  const lss = ls.map(x => clampScore(x));
  gMin = Math.min(gMin, gs); gMax = Math.max(gMax, gs);
  lss.forEach(v => { lMin = Math.min(lMin, v); lMax = Math.max(lMax, v); });
  gua[bin] = { i: g.id, n: g.name, sym: g.symbol, up: upper, lo: lower, t, ls, gs, lss };
}
console.log('卦辞分范围', gMin.toFixed(1), gMax.toFixed(1), '爻辞分范围', lMin.toFixed(1), lMax.toFixed(1));
// 抽样看几个
['111111', '000000', '111000', '000111', '010010'].forEach(k => {
  const g = gua[k]; if (g) console.log(k, g.n, g.t, 'gs=' + g.gs.toFixed(1), 'ls=' + g.lss.join('/'));
});

/* ---------- 5. 行情快照 ---------- */
const stocks = {};
for (const f of ['q1.txt', 'q2.txt', 'q3.txt']) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/v_([a-z]{2}\d{6})="([^"]+)"/);
    if (!m) continue;
    const p = m[2].split('~');
    stocks[m[1].slice(2)] = { n: p[1].replace(/\s/g, ''), p: +p[3], pc: +p[4], chg: +p[32], hi: +p[33], lo: +p[34], tr: +p[38], pe: +p[39] };
  }
}
console.log('行情条数', Object.keys(stocks).length);

const out = {
  meta: { madeAt: new Date().toISOString(), dayOffset: OFFSET, gan: GAN, zhi: ZHI, jq: JQ },
  lunarYears, jieqi, gua, stocks,
  norm: { g: [gMin, gMax], l: [lMin, lMax] }
};
fs.writeFileSync('./data.json', JSON.stringify(out));
console.log('data.json 字节', fs.statSync('./data.json').size);
console.log('2026 节气', JSON.stringify(jieqi[2026]));
console.log('农历2026', JSON.stringify(lunarYears[2026]));
