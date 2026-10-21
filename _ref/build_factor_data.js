/* 构建因子页数据：每股 低波60 / 反转20 / 缩量 / 20日均额 */
const fs = require('fs');
const K = JSON.parse(fs.readFileSync('kline800.json', 'utf8'));
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const nameMap = {};
D.list.forEach(r => { nameMap[r[0]] = r[1]; });

const rows = [];
let asOf = '', jumps = 0;

for (const [code, bars] of Object.entries(K)) {
  if (bars.length < 70) continue;
  const n = bars.length;
  const c = bars.map(b => b[2]), v = bars.map(b => b[5]);
  const i = n - 1;
  asOf = asOf > bars[i][0] ? asOf : bars[i][0];
  const ret = c.map((x, k) => k ? x / c[k - 1] - 1 : 0);
  /* 近 60 日出现 >11.5% 跳空视为除权，跳过 */
  let bad = false;
  for (let k = i - 59; k <= i; k++) if (Math.abs(ret[k]) > 0.115) { bad = true; break; }
  if (bad) { jumps++; continue; }
  if (c[i] < 2) continue;

  const r60 = ret.slice(i - 59, i + 1);
  const mu = r60.reduce((a, b) => a + b, 0) / 60;
  const vol60 = Math.sqrt(r60.reduce((a, b) => a + (b - mu) ** 2, 0) / 60) * 100;   // 日波动率 %
  const rev20 = (c[i] / c[i - 20] - 1) * 100;                                        // 20日涨幅 %
  const v5 = v.slice(i - 4, i + 1).reduce((a, b) => a + b, 0) / 5;
  const v60 = v.slice(i - 59, i + 1).reduce((a, b) => a + b, 0) / 60;
  const vshr = v60 > 0 ? v5 / v60 : 1;                                               // 缩量比（<1 = 缩量）
  const amt20 = v.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20 * c[i] / 1e8; // 20日均成交额（亿）
  const chg = ret[i] * 100;

  rows.push([code, nameMap[code] || code, +c[i].toFixed(2), +chg.toFixed(2),
    +vol60.toFixed(2), +rev20.toFixed(1), +vshr.toFixed(2), +amt20.toFixed(2)]);
}

/* 市场温度：等权 20 日收益（用各股 rev20 中位数近似） */
const med = arr => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const mkt20 = med(rows.map(r => r[5]));

const out = {
  meta: { asOf, count: rows.length, skipped: jumps, mkt20: +mkt20.toFixed(2) },
  list: rows
};
fs.writeFileSync('factor_data.json', JSON.stringify(out));
console.log(`asOf ${asOf} | ${rows.length} 只 | 剔除除权 ${jumps} | 市场20日中位 ${mkt20.toFixed(2)}% | ${(fs.statSync('factor_data.json').size / 1024).toFixed(0)}KB`);
console.log('样例', JSON.stringify(rows.slice(0, 3)));
