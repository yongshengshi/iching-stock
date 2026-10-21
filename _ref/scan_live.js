/* 今日实时全市场扫描（仅主板可交易标的） */
const fs = require('fs');
const html = fs.readFileSync('../周易玄学选股.html', 'utf8');
global.window = {};
eval(html.match(/<script id="engine-script">([\s\S]*?)<\/script>/)[1]);
const X = global.window.Xuan;
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));

/* 只取主板代码 */
const codes = D.list.map(r => r[0]).filter(c => X.boardOf(c) === '主板');
const BATCH = 100, CONC = 10;
const batches = [];
for (let i = 0; i < codes.length; i += BATCH) batches.push(codes.slice(i, i + BATCH));
const dec = new TextDecoder('gbk');
const live = {};

async function one(list) {
  const pre = list.map(c => (c[0] === '6' ? 'sh' : 'sz') + c).join(',');
  for (let a = 0; a < 3; a++) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
      const res = await fetch('https://qt.gtimg.cn/q=' + pre + '&_t=' + Date.now(), { signal: ctl.signal, cache: 'no-store' });
      clearTimeout(t);
      return dec.decode(await res.arrayBuffer());
    } catch (e) { if (a === 2) return ''; await new Promise(r => setTimeout(r, 300)); }
  }
}

function parse(txt) {
  for (const line of txt.split('\n')) {
    const m = line.match(/v_([a-z]{2}\d{6})="([^"]*)"/);
    if (!m || !m[2]) continue;
    const p = m[2].split('~');
    if (p.length < 46) continue;
    const code = m[1].slice(2), name = p[1].replace(/\s/g, ''), price = +p[3], pc = +p[4];
    if (!price || !pc) continue;
    if (/ST|退|PT/.test(name)) continue;
    live[code] = { code, name, price, pc, chg: +p[32], hi: +p[33], lo: +p[34], amount: +p[37], turnover: +p[38], vr: +p[49] };
  }
}

(async () => {
  let idx = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (idx < batches.length) { parse(await one(batches[idx++])); }
  }));
  const now = new Date();
  const info = X.nowInfo(now);
  const shi = X.timeGua(info);
  console.log('时空:', info.yearGz + '年', info.monthGz + '月', info.dayGz + '日', info.hourGz + '时',
    '| 农历', info.lunar.m + '月' + info.lunar.d + '日');
  console.log('天时卦:', shi.gua.label, shi.yaoName + '爻动', Math.min(100, shi.base).toFixed(0) + '分');
  console.log('实时行情:', Object.keys(live).length, '只（主板）');

  const pool = Object.values(live).filter(r =>
    r.amount >= 8000 &&           // 成交额 ≥ 8000 万
    r.chg > -6 && r.chg < 7.5 &&  // 排除接近涨跌停
    r.price >= 3
  );

  const rows = pool.map(r => {
    const a = X.analyze(r.code, now, r.price, { name: r.name, price: r.price, prevClose: r.pc, chg: r.chg });
    if (a.error) return null;
    return { ...r, S: a.S, g: a.grade.t, z: a.zhu, pts: a.pts, posMax: a.posMax, posCapped: a.posCapped, reso: a.reso, bad: a.badBen };
  }).filter(Boolean).sort((a, b) => b.S - a.S || b.amount - a.amount);

  /* 卦断去重 */
  const seen = new Set(), uniq = [];
  for (const r of rows) {
    const k = r.z.gua.label + '|' + r.z.yaoName;
    if (seen.has(k)) continue;
    seen.add(k); uniq.push(r);
  }
  console.log('入围', rows.length, '只 → 卦断', uniq.length, '种\n');
  console.log('排名 名称 代码 现价 涨幅 本卦 动爻 体用 分 仓位 买一 止损 目标 额亿 量比');
  uniq.slice(0, 15).forEach((r, i) => {
    console.log(`${String(i + 1).padStart(2)} ${r.name} ${r.code} ${r.price} ${r.chg}% ${r.z.gua.label} ${r.z.yaoName} ${r.z.relTxt.label} ${r.S.toFixed(0)} ≤${r.posMax}成 ${r.pts.b1} ${r.pts.stop} ${r.pts.t1} ${(r.amount / 10000).toFixed(1)} ${r.vr}${r.bad ? ' ⚠卦名不吉' : ''}`);
  });

  /* 详情：前三 */
  console.log('\n== 前三详情 ==');
  uniq.slice(0, 3).forEach(r => {
    console.log(`【${r.name} ${r.code}】现价 ${r.price}（${r.chg}%） 高${r.hi} 低${r.lo} 换手${r.turnover}% 量比${r.vr} 额${(r.amount / 10000).toFixed(1)}亿`);
    console.log(`  ${r.z.gua.label} ${r.z.yaoName}爻动 → 变 ${r.z.bian.label}｜互 ${r.z.hu.label}`);
    console.log(`  卦辞：${r.z.gua.data.t}`);
    console.log(`  爻辞：${r.z.yaoText}`);
    console.log(`  体${r.z.ti.n}${r.z.ti.wx} 用${r.z.yong.n}${r.z.yong.wx} ${r.z.relTxt.label}｜时令${r.z.strength}｜共振${r.reso}｜四维 ${[r.z.subs.A, r.z.subs.B, r.z.subs.C, r.z.subs.D].map(v => v.toFixed(0)).join('/')}`);
    console.log(`  买${r.pts.b1} 次${r.pts.b2} 损${r.pts.stop} 目标${r.pts.t1}/${r.pts.t2}｜涨停${r.limitUp}｜仓位≤${r.posMax}成`);
  });
})();
