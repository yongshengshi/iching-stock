const fs = require('fs');
const L = require('./lunar_lib.js');
const html = fs.readFileSync('../周易玄学选股.html', 'utf8');
const m = html.match(/<script id="engine-script">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine not found');
global.window = {};
eval(m[1]);
const X = global.window.Xuan;

let fail = 0, pass = 0;
const eq = (a, b, label) => {
  if (a === b) { pass++; } else { fail++; console.log('  ✗', label, 'got', a, 'want', b); }
};

/* 1. 四柱 */
const dt = new Date(2026, 9, 20, 14, 7, 0);
const i = X.nowInfo(dt);
console.log('— 四柱 2026-10-20 14:07');
console.log('  农历', JSON.stringify(i.lunar), i.yearGz, i.monthGz, i.dayGz, i.hourGz);
eq(i.lunar.m, 9, '农历月'); eq(i.lunar.d, 11, '农历日');
eq(i.yearGz, '丙午', '年柱'); eq(i.monthGz, '戊戌', '月柱'); eq(i.dayGz, '丁卯', '日柱'); eq(i.hourGz, '丁未', '时柱');

/* 2. 批量对照 lunar.js */
console.log('— 批量对照 lunar-javascript (400 天)');
let bad = 0, badLunar = 0;
for (let k = 0; k < 400; k++) {
  const d = new Date(2020, 0, 1 + Math.floor(k * 18.2), 8 + (k % 12), 30, 0);
  const lib = L.Lunar.fromDate(d);
  const got = X.nowInfo(d);
  const wantY = lib.getYearInGanZhiByLiChun(), wantM = lib.getMonthInGanZhi(),
        wantD = lib.getDayInGanZhi(), wantH = lib.getTimeInGanZhi();
  if (got.yearGz !== wantY || got.monthGz !== wantM || got.dayGz !== wantD || got.hourGz !== wantH) {
    bad++;
    if (bad <= 3) console.log('  ✗', d.toDateString(), got.yearGz + got.monthGz + got.dayGz + got.hourGz, '≠', wantY + wantM + wantD + wantH);
  }
  if (got.lunar.y !== lib.getYear() || got.lunar.m !== Math.abs(lib.getMonth()) || got.lunar.d !== lib.getDay()) {
    badLunar++;
    if (badLunar <= 3) console.log('  ✗农历', d.toDateString(), JSON.stringify(got.lunar), '≠', lib.getYear(), lib.getMonth(), lib.getDay());
  }
}
console.log('  四柱不符', bad, '/400 ；农历不符', badLunar, '/400');
if (bad || badLunar) fail++; else pass++;

/* 3. 时间起卦 */
console.log('— 时间起卦');
const s = X.timeGua(i);
console.log('  ', s.gua.label, '动' + s.yaoName, '体' + s.ti.n + s.ti.wx, '用' + s.yong.n + s.yong.wx, s.relTxt.label, '分', s.base.toFixed(1));
eq(s.gua.label, '离为火', '天时卦');
eq(s.moving, 5, '动爻');

/* 4. 个股 */
console.log('— 个股 600519');
const r = X.analyze('600519', dt, 1320);
console.log('  ', r.name, r.price, '主卦', r.zhu.gua.label, '动' + r.zhu.yaoName, '命卦', r.ming.label);
console.log('   四维', JSON.stringify(Object.fromEntries(Object.entries(r.zhu.subs).map(([k, v]) => [k, +v.toFixed(0)]))), '共振', r.reso, '总分', r.S.toFixed(1), r.grade.t);
console.log('   买一', r.pts.b1.toFixed(2), '买二', r.pts.b2.toFixed(2), '止损', r.pts.stop.toFixed(2), '目标', r.pts.t1.toFixed(2), r.pts.t2.toFixed(2), '时', r.hour.name);
console.log('   断语:', X.verdictOf(r).replace(/<[^>]+>/g, ''));
const okPts = r.pts.b2 < r.pts.b1 && r.pts.b1 < r.price && r.pts.stop < r.pts.b2 && r.pts.t1 > r.price && r.pts.t2 > r.pts.t1;
eq(okPts, true, '点位次序');
eq(r.S > 0 && r.S <= 100, true, '总分范围');

/* 5. 代码校验（全部 A 股） */
console.log('— 代码校验与板块识别');
eq(X.checkCode('300750'), null, '创业板放行');
eq(X.checkCode('688981'), null, '科创板放行');
eq(X.checkCode('830799'), null, '北交所放行');
eq(X.checkCode('600519'), null, '沪主板放行');
eq(X.checkCode('002594'), null, '深主板放行');
eq(X.checkCode('900901'), '该代码不在 A 股范围（仅收录沪深主板／创业板／科创板／北交所）', 'B股拦截');
eq(X.checkCode('12345'), '请输入 6 位数字代码', '长度校验');
eq(X.boardOf('301363'), '创业板', '美好医疗板块');
eq(X.boardOf('688981'), '科创板', '中芯国际板块');
eq(X.boardOf('600519'), '主板', '茅台板块');
eq(X.boardOf('830799'), '北交所', '北交所板块');
eq(X.limitPctOf('301363'), 0.2, '创业板涨跌幅 20%');
eq(X.limitPctOf('600519'), 0.1, '主板涨跌幅 10%');
eq(X.limitPctOf('830799'), 0.3, '北交所涨跌幅 30%');

/* 6. 全量选股分布 */
console.log('— 200 只样本评分分布');
const codes = require('./data.json').list.slice(0, 200).map(r => r[0]);
const arr = codes.map(c => X.analyze(c, dt, null)).filter(x => !x.error).map(x => ({ c: x.name, s: x.S, g: x.grade.t, gua: x.zhu.gua.label }));
arr.sort((a, b) => b.s - a.s);
console.log('   n=' + arr.length, 'max', arr[0].s.toFixed(1), arr[0].c, '| min', arr[arr.length - 1].s.toFixed(1), arr[arr.length - 1].c);
console.log('   top5', arr.slice(0, 5).map(a => a.c + ':' + a.s.toFixed(0) + a.g).join(' '));
console.log('   bot5', arr.slice(-5).map(a => a.c + ':' + a.s.toFixed(0) + a.g).join(' '));
const grades = arr.reduce((o, a) => (o[a.g] = (o[a.g] || 0) + 1, o), {});
console.log('   评级分布', JSON.stringify(grades));
const distinct = new Set(arr.map(a => a.gua)).size;
console.log('   不同卦象数', distinct, '/' + arr.length);

console.log('\n结果: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
