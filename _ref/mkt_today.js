/* 今日大盘卦（与页面同口径：报数起卦 + 实时盘面） */
const fs = require('fs');
const html = fs.readFileSync('../卜卦选股.html', 'utf8');
global.window = {};
eval(html.match(/<script id="engine-script">([\s\S]*?)<\/script>/)[1]);
const X = global.window.Xuan;
const F = JSON.parse(fs.readFileSync('factor_data.json', 'utf8'));
const MKT_IDX = '000000';

const gbk = new TextDecoder('gbk');
const score = g => Math.round(0.32 * g.subs.A + 0.30 * g.subs.B + 0.23 * g.subs.C + 0.15 * g.subs.D);

async function batchQt(list) {
  const pre = list.map(c => (c[0] === '6' ? 'sh' : 'sz') + c).join(',');
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  let r;
  try { r = await fetch('https://qt.gtimg.cn/q=' + pre + '&_t=' + Date.now(), { cache: 'no-store', signal: ctl.signal }); }
  finally { clearTimeout(t); }
  if (!r || !r.ok) return null;
  const txt = gbk.decode(await r.arrayBuffer());
  const out = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/v_([a-z]{2}\d{6})="([^"]*)"/);
    if (!m || !m[2]) continue;
    const p = m[2].split('~');
    if (p.length < 46 || !+p[3]) continue;
    out[m[1].slice(2)] = { chg: +p[32], amt: +p[37] };
  }
  return Object.keys(out).length ? out : null;
}
async function batchEm(list) {
  const secids = list.map(c => (c[0] === '6' ? '1.' : '0.') + c).join(',');
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  let r;
  try { r = await fetch('https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=' + secids + '&fields=f2,f3,f6,f12&ut=fa5fd1943c7b386f172d6893dbfba10b&_t=' + Date.now(), { cache: 'no-store', signal: ctl.signal }); }
  finally { clearTimeout(t); }
  if (!r || !r.ok) return null;
  const j = await r.json();
  const out = {};
  ((j.data && j.data.diff) || []).forEach(d => {
    if (d && d.f12 && typeof d.f3 === 'number') out[d.f12] = { chg: d.f3, amt: (d.f6 || 0) / 1e4 };
  });
  return Object.keys(out).length ? out : null;
}

(async () => {
  const now = new Date();
  const info = X.nowInfo(now);
  const shi = X.timeGua(info);

  console.log('='.repeat(62));
  console.log(`【时空】${info.yearGz}年 ${info.monthGz}月 ${info.dayGz}日 ${info.hourGz}时 ｜ 农历${info.lunar.m}月${info.lunar.d}日`);
  console.log(`【时运参考】${shi.gua.label} ${shi.yaoName}动 ${Math.round(Math.max(1, Math.min(100, shi.base)))}分（时辰卦，仅作背景）`);

  /* 报数起卦 */
  const bao = 1 + Math.floor(Math.random() * 999);
  const g = X.stockGua(MKT_IDX, info, bao);
  const s1 = score(g);
  console.log('\n' + '='.repeat(62));
  console.log(`【大盘卦】报 ${bao}`);
  console.log(`  ${g.gua.label}　${g.yaoName}爻动 → ${g.bian.label}　互 ${g.hu.label}`);
  console.log(`  上${g.gua.data.up} 下${g.gua.data.lo} ｜ 体${g.ti.n}${g.ti.wx} 用${g.yong.n}${g.yong.wx} ｜ ${g.relTxt.label} ｜ 时令${g.strength}`);
  console.log(`  卦辞：「${g.gua.data.t}」`);
  console.log(`  爻辞：「${g.yaoText}」`);
  console.log(`  四维 A${g.subs.A.toFixed(0)} B${g.subs.B.toFixed(0)} C${g.subs.C.toFixed(0)} D${g.subs.D.toFixed(0)} → ${s1} 分`);
  console.log(`  变卦：「${g.bian.data.t}」`);

  /* 再占一卦 */
  let bao2 = 1 + Math.floor(Math.random() * 999);
  for (let k = 0; k < 20 && Math.abs(bao2 - bao) % 8 === 0; k++) bao2 = 1 + Math.floor(Math.random() * 999);
  const g2 = X.stockGua(MKT_IDX, info, bao2);
  const s2 = score(g2);
  console.log('\n' + '-'.repeat(62));
  console.log(`【再占】报 ${bao2}`);
  console.log(`  ${g2.gua.label}　${g2.yaoName}动 → ${g2.bian.label} ｜ 体${g2.ti.n}${g2.ti.wx} 用${g2.yong.n}${g2.yong.wx} ${g2.relTxt.label}`);
  console.log(`  爻辞：「${g2.yaoText}」`);
  console.log(`  → ${s2} 分 ｜ 与初占 ${s2 - s1 > 0 ? '+' : ''}${s2 - s1}`);

  /* 盘面 */
  const codes = F.list.map(r => r[0]);
  const SIZE = 40, batches = [];
  for (let i = 0; i < codes.length; i += SIZE) batches.push(codes.slice(i, i + SIZE));
  const res = {}; let idx = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (idx < batches.length) {
      const list = batches[idx++];
      let got = null;
      try { got = await batchQt(list); } catch (e) {}
      if (!got) { try { got = await batchEm(list); } catch (e) {} }
      if (got) Object.assign(res, got);
    }
  }));
  const arr = Object.values(res);
  if (!arr.length) { console.log('\n盘面数据取不到'); return; }
  const up = arr.filter(x => x.chg > 0).length, dn = arr.filter(x => x.chg < 0).length;
  const lu = arr.filter(x => x.chg >= 9.8).length, ld = arr.filter(x => x.chg <= -9.8).length;
  const chgs = arr.map(x => x.chg).sort((a, b) => a - b);
  const med = chgs[Math.floor(chgs.length / 2)];
  const amt = arr.reduce((s, x) => s + x.amt, 0) / 1e4;
  const up5 = arr.filter(x => x.chg >= 5).length, dn5 = arr.filter(x => x.chg <= -5).length;

  console.log('\n' + '='.repeat(62));
  console.log(`【盘面】样本 ${arr.length} 只主板`);
  console.log(`  上涨 ${up} ｜ 下跌 ${dn} ｜ 平盘 ${arr.length - up - dn} ｜ 涨跌比 ${(up / (up + dn) * 100).toFixed(1)}%`);
  console.log(`  涨停 ${lu} ｜ 跌停 ${ld} ｜ 涨超5% ${up5} ｜ 跌超5% ${dn5}`);
  console.log(`  中位涨幅 ${med > 0 ? '+' : ''}${med.toFixed(2)}% ｜ 成交 ${amt.toFixed(0)} 亿`);
  console.log('='.repeat(62));
})();
