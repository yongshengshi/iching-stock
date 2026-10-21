/* 全市场主板玄学扫描：今日收盘时空 + 明日巳时 双时空印证 */
const fs = require('fs');

/* ---------- 引擎 ---------- */
const html = fs.readFileSync('../周易玄学选股.html', 'utf8');
global.window = {};
eval(html.match(/<script id="engine-script">([\s\S]*?)<\/script>/)[1]);
const X = global.window.Xuan;

/* ---------- 候选代码段（仅沪深主板） ---------- */
const ranges = [];
for (const base of [600000, 601000, 603000, 605000]) ranges.push(['sh', base, 1000]);
for (const base of [0, 1000, 2000, 3000]) ranges.push(['sz', base, 1000]);
const codes = [];
for (const [p, base, n] of ranges) for (let i = 0; i < n; i++) codes.push(p + String(base + i).padStart(6, '0'));

const BATCH = 100, CONC = 8;
const batches = [];
for (let i = 0; i < codes.length; i += BATCH) batches.push(codes.slice(i, i + BATCH));

const dec = new TextDecoder('gbk');
const rows = [];
let done = 0, failed = 0;

async function fetchBatch(list) {
  const url = 'https://qt.gtimg.cn/q=' + list.join(',');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(url, { signal: ctrl.signal });
      const buf = Buffer.from(await res.arrayBuffer());
      clearTimeout(t);
      return dec.decode(buf);
    } catch (e) {
      if (attempt === 2) { failed++; return ''; }
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
    }
  }
}

function parse(txt) {
  for (const line of txt.split('\n')) {
    const m = line.match(/v_([a-z]{2}\d{6})="([^"]*)"/);
    if (!m || !m[2]) continue;
    const p = m[2].split('~');
    if (p.length < 46) continue;
    const code = m[1].slice(2), name = p[1].replace(/\s/g, '');
    const price = +p[3], pc = +p[4];
    if (!price || price <= 0 || !pc) continue;
    if (/ST|退/.test(name)) continue;
    rows.push({
      code, name, price, pc,
      pct: +p[32], hi: +p[33], lo: +p[34],
      amount: +p[37],          // 成交额（万元）
      turnover: +p[38],
      pe: +p[39],
      volratio: +p[49]
    });
  }
}

(async () => {
  console.log('候选代码', codes.length, '批次数', batches.length);
  const t0 = Date.now();
  let idx = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (idx < batches.length) {
      const k = idx++;
      const txt = await fetchBatch(batches[k]);
      parse(txt);
      done++;
      if (done % 20 === 0) process.stdout.write(`  ${done}/${batches.length}\r`);
    }
  }));
  console.log(`\n抓取完成 ${((Date.now() - t0) / 1000).toFixed(1)}s 失败批次 ${failed}，有效行情 ${rows.length} 只`);

  /* ---------- 过滤 ---------- */
  const pool = rows.filter(r => r.amount >= 5000 && Math.abs(r.pct) < 9.6 && r.price >= 2 && r.turnover >= 0.4 && r.turnover <= 18);
  console.log('流动性/涨跌停过滤后', pool.length, '只');

  /* ---------- 双时空起卦 ---------- */
  const t1 = new Date(2026, 9, 20, 15, 0, 0);      // 今日收盘（未时末）
  const t2 = new Date(2026, 9, 21, 9, 45, 0);      // 明日巳时（拟入场）
  const i1 = X.nowInfo(t1), i2 = X.nowInfo(t2);
  const shi1 = X.timeGua(i1), shi2 = X.timeGua(i2);
  console.log('今日收盘时空', i1.dayGz + i1.hourGz, '天时卦', shi1.gua.label, shi1.yaoName + '爻动', shi1.base.toFixed(0), '分');
  console.log('明日巳时时空', i2.dayGz + i2.hourGz, '天时卦', shi2.gua.label, shi2.yaoName + '爻动', shi2.base.toFixed(0), '分');

  const out = [];
  for (const r of pool) {
    const a = X.analyze(r.code, t1, r.price);
    if (a.error) continue;
    const b = X.analyze(r.code, t2, r.price);
    const s2 = Math.max(1, Math.min(100, b.S));
    const both = Math.min(a.S, s2) >= 58;
    out.push({
      ...r,
      s1: a.S, s2,
      mix: a.S * 0.5 + s2 * 0.5,
      both,
      gua: a.zhu.gua.label, gua2: b.zhu.gua.label,
      yao: a.zhu.yaoName, rel: a.zhu.relTxt.label,
      ti: a.zhu.ti.n + a.zhu.ti.wx,
      reso: a.reso,
      b1: a.pts.b1, b2: a.pts.b2, stop: a.pts.stop, t1: a.pts.t1, t2: a.pts.t2,
      hour: a.hour.name + ' ' + a.hour.span,
      grade: a.grade.t, pos: a.grade.pos
    });
  }
  out.sort((x, y) => y.mix - x.mix || (x.price - x.b1) - (y.price - y.b1));
  const dual = out.filter(r => r.both);
  console.log('双时空均 ≥58 分：', dual.length, '只');
  // 卦象去重：同卦同动爻视为同一"卦断"，只留最易执行的一只
  const seen = new Set(), uniq = [];
  for (const r of dual) {
    const k = r.gua + '|' + r.yao;
    if (seen.has(k)) continue;
    seen.add(k); uniq.push(r);
  }
  console.log('卦象去重后：', uniq.length, '种不同卦断');
  console.log('\n== 双时空印证 前20 ==');
  console.log('排名 名称 代码 收盘 涨跌% 本卦(今日) 动爻 体卦 体用 今分 明分 综合 买一 止损 目标 成交额亿 换手%');
  uniq.slice(0, 20).forEach((r, i) => {
    console.log(`${i + 1} ${r.name} ${r.code} ${r.price} ${r.pct}% ${r.gua} ${r.yao} ${r.ti} ${r.rel} ${r.s1.toFixed(0)} ${r.s2.toFixed(0)} ${r.mix.toFixed(1)} ${r.b1.toFixed(2)} ${r.stop.toFixed(2)} ${r.t1.toFixed(2)} ${(r.amount / 10000).toFixed(1)} ${r.turnover}`);
  });

  fs.writeFileSync('scan_all.json', JSON.stringify({
    meta: { at: t1.toISOString(), total: rows.length, pool: pool.length, dual: dual.length,
      shi1: { label: shi1.gua.label, yao: shi1.yaoName, score: shi1.base },
      shi2: { label: shi2.gua.label, yao: shi2.yaoName, score: shi2.base },
      gz1: i1.yearGz + '年 ' + i1.monthGz + '月 ' + i1.dayGz + '日 ' + i1.hourGz + '时',
      gz2: i2.yearGz + '年 ' + i2.monthGz + '月 ' + i2.dayGz + '日 ' + i2.hourGz + '时' },
    list: uniq.slice(0, 120), dualCount: dual.length, uniqCount: uniq.length
  }, null, 0));
  console.log('\nscan_all.json 已写入');
})();
