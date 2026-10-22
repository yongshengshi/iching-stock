/* 今日：大盘卦 + 市场情绪 + 三只候选完整判断 */
const fs = require('fs');
const html = fs.readFileSync('../卜卦选股.html', 'utf8');
global.window = {};
eval(html.match(/<script id="engine-script">([\s\S]*?)<\/script>/)[1]);
const X = global.window.Xuan;
const F = JSON.parse(fs.readFileSync('factor_data.json', 'utf8'));

/* ---------- 技术面（复刻页面算法） ---------- */
const FR = F.list.map(a => ({ code: a[0], name: a[1], vol: a[4], rev: a[5], vshr: a[6], amt: a[7] }));
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const madClamp = v => { const m = median(v), md = median(v.map(x => Math.abs(x - m))) * 1.4826 || 1e-9; return v.map(x => Math.max(m - 3 * md, Math.min(m + 3 * md, x))); };
const zs = v => { const mu = v.reduce((a, b) => a + b, 0) / v.length; const sd = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / v.length) || 1e-9; return v.map(x => (x - mu) / sd); };
const RAW = { lowvol: r => -r.vol, rev: r => -r.rev, vshr: r => -r.vshr };
const KEYS = Object.keys(RAW);
KEYS.forEach(k => { const v = madClamp(FR.map(RAW[k])); FR.forEach((r, i) => r['c_' + k] = v[i]); });
const ord = [...FR].sort((a, b) => a.amt - b.amt);
for (let g = 0; g < 5; g++) {
  const part = ord.slice(Math.floor(g * FR.length / 5), Math.floor((g + 1) * FR.length / 5));
  KEYS.forEach(k => { const z = zs(part.map(r => r['c_' + k])); part.forEach((r, i) => r['z_' + k] = z[i]); });
}
FR.forEach(r => { KEYS.forEach(k => { if (r['z_' + k] == null) r['z_' + k] = 0; }); r.score = (r.z_lowvol + r.z_rev + r.z_vshr) / 3; });
const SORTED = [...FR].sort((a, b) => a.score - b.score);
SORTED.forEach((r, i) => { r.tier = Math.min(10, Math.floor(i / FR.length * 10) + 1); r.rank = i + 1; });
const FMAP = new Map(FR.map(r => [r.code, r]));

/* ---------- 行情 ---------- */
const gbk = new TextDecoder('gbk');
async function quotes(codes) {
  const out = {};
  const batches = [];
  for (let i = 0; i < codes.length; i += 100) batches.push(codes.slice(i, i + 100));
  let idx = 0;
  await Promise.all(Array.from({ length: 10 }, async () => {
    while (idx < batches.length) {
      const list = batches[idx++];
      const pre = list.map(c => (c[0] === '6' ? 'sh' : 'sz') + c).join(',');
      try {
        const r = await fetch('https://qt.gtimg.cn/q=' + pre + '&_t=' + Date.now(), { cache: 'no-store' });
        const txt = gbk.decode(await r.arrayBuffer());
        for (const line of txt.split('\n')) {
          const m = line.match(/v_([a-z]{2}\d{6})="([^"]*)"/);
          if (!m || !m[2]) continue;
          const p = m[2].split('~');
          if (p.length < 46 || !+p[3]) continue;
          out[m[1].slice(2)] = { name: p[1].replace(/\s/g, ''), price: +p[3], pc: +p[4], chg: +p[32], hi: +p[33], lo: +p[34], amt: +p[37], time: String(p[30] || '').slice(8, 12) };
        }
      } catch (e) {}
    }
  }));
  return out;
}

(async () => {
  const now = new Date();
  const info = X.nowInfo(now);
  const shi = X.timeGua(info);
  const mk = Math.max(1, Math.min(100, shi.base));

  /* 1. 大盘卦 */
  console.log('='.repeat(60));
  console.log(`【大盘卦】${info.yearGz}年 ${info.monthGz}月 ${info.dayGz}日 ${info.hourGz}时`);
  console.log(`  ${shi.gua.label} ${shi.yaoName}爻动 ｜ ${mk.toFixed(0)} 分 ｜ 体${shi.ti.n}${shi.ti.wx} 用${shi.yong.n}${shi.yong.wx} ${shi.relTxt.label}`);
  console.log(`  卦辞：「${shi.gua.data.t}」`);
  console.log(`  爻辞：「${shi.yaoText}」`);

  /* 2. 市场情绪（全市场实时） */
  const qm = await quotes(FR.map(r => r.code));
  const arr = Object.values(qm);
  const up = arr.filter(x => x.chg > 0).length, dn = arr.filter(x => x.chg < 0).length;
  const lu = arr.filter(x => x.chg >= 9.8).length, ld = arr.filter(x => x.chg <= -9.8).length;
  const chgs = arr.map(x => x.chg).sort((a, b) => a - b);
  const med = chgs[Math.floor(chgs.length / 2)];
  const amtSum = arr.reduce((s, x) => s + x.amt, 0) / 1e4;
  console.log(`\n【市场情绪】样本 ${arr.length} 只主板`);
  console.log(`  上涨 ${up} ｜ 下跌 ${dn} ｜ 平盘 ${arr.length - up - dn} ｜ 涨停 ${lu} ｜ 跌停 ${ld}`);
  console.log(`  中位涨幅 ${med > 0 ? '+' : ''}${med.toFixed(2)}% ｜ 成交 ${amtSum.toFixed(0)} 亿`);

  /* 3. 报数选三只 */
  const bao = 1 + Math.floor(Math.random() * 999);
  const pre = { info, shi };
  const rows = [];
  for (const r of FR) {
    if (!qm[r.code]) continue;
    const a = X.analyze(r.code, now, 1, { name: r.name, price: 1, prevClose: 1, chg: 0 }, pre, bao);
    if (a.error) continue;
    rows.push({ code: r.code, name: r.name, S: a.S, grade: a.grade.t, z: a.zhu, amt: r.amt });
  }
  rows.sort((x, y) => y.S - x.S || y.amt - x.amt);
  const pool = rows.filter(r => r.S >= 66 && !X.isBadGua(r.z.gua)).slice(0, 120);
  const start = bao % pool.length;
  const seen = new Set(), picks = [];
  for (let k = 0; k < pool.length && picks.length < 3; k++) {
    const r = pool[(start + k) % pool.length];
    if (seen.has(r.z.gua.label)) continue;
    seen.add(r.z.gua.label); picks.push(r);
  }
  console.log(`\n【报数 ${bao}】从吉卦榜第 ${start + 1} 位起取（池内 ${pool.length} 只）`);

  /* 4. 逐一深判 */
  const GOOD = ['增持', '回购', '中标', '预增', '扭亏', '签订', '合作', '获批', '分红', '股权激励', '重大合同'];
  const BAD = ['减持', '质押', '诉讼', '仲裁', '问询', '立案', '处罚', '退市', '预亏', '亏损', '终止', '违规', '冻结', '商誉', '风险提示'];
  async function news(code) {
    try {
      const r = await fetch(`https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size=6&page_index=1&ann_type=A&client_source=web&stock_list=${code}&_t=${Date.now()}`, { cache: 'no-store' });
      const j = await r.json();
      return ((j.data && j.data.list) || []).map(it => {
        const t = it.title_ch || it.title || '';
        let tone = 0; if (BAD.some(k => t.includes(k))) tone = -1; else if (GOOD.some(k => t.includes(k))) tone = 1;
        return { t, d: (it.notice_date || '').slice(5, 10), tone };
      });
    } catch (e) { return null; }
  }
  const band = v => (v >= 66 ? 1 : v >= 52 ? 0 : -1);
  const R2 = v => Math.round(v * 100) / 100;
  const out = [];
  for (const p of picks) {
    const qt = qm[p.code];
    const tech = FMAP.get(p.code) || null;
    let bao2 = 1 + Math.floor(Math.random() * 999);
    for (let k = 0; k < 10 && Math.abs(bao2 - bao) % 24 === 0; k++) bao2 = 1 + Math.floor(Math.random() * 999);
    const a1 = X.analyze(p.code, now, qt.price, { name: qt.name, price: qt.price, prevClose: qt.pc, chg: qt.chg }, null, bao, { tech, mkScore: mk });
    const a2 = X.analyze(p.code, now, qt.price, { name: qt.name, price: qt.price, prevClose: qt.pc, chg: qt.chg }, null, bao2, { tech, mkScore: mk });
    const nw = await news(p.code);
    let v1 = band(a1.S); if (X.isBadGua(a1.zhu.gua)) v1 -= 1;
    const g1 = band(a1.S), g2 = band(a2.S);
    let v4 = g2; if (g1 * g2 < 0) v4 = 0;
    const v2 = tech ? (tech.tier === 1 ? -1 : tech.tier === 2 ? 0 : 1) : 0;
    let v3 = 0, nNote = '公告获取失败';
    if (nw) { const b = nw.filter(x => x.tone < 0), g = nw.filter(x => x.tone > 0); v3 = b.length ? -1 : g.length ? 1 : 0; nNote = b.length ? `偏空 ${b.length} 条` : g.length ? `偏多 ${g.length} 条` : `${nw.length} 条中性`; }
    const total = v1 + v4 + v2 + v3;
    out.push({ p, qt, tech, a1, a2, nw, nNote, v1, v4, v2, v3, total, label: total >= 2 ? '可入场' : total >= 1 ? '轻仓试' : total === 0 ? '观望' : '回避' });
  }
  out.sort((a, b) => b.total - a.total);

  for (const o of out) {
    const { p, qt, tech, a1, a2 } = o;
    const q = a1.pts, atr = q.atr, cap = a1.limitUp || Infinity;
    console.log('\n' + '-'.repeat(60));
    console.log(`【${p.name} ${p.code}】¥${qt.price} ${qt.chg > 0 ? '+' : ''}${qt.chg}% ｜ ${o.label} (${o.total > 0 ? '+' : ''}${o.total} 票)`);
    console.log(`  初卦 报${bao}：${a1.zhu.gua.label} ${a1.zhu.yaoName}动→${a1.zhu.bian.label} ${a1.S.toFixed(0)}分 ${a1.grade.t}｜「${a1.zhu.yaoText}」`);
    console.log(`  复卦 报${a2.zhu && a2 ? '' : ''}${''}${a2 ? '' : ''}`);
    console.log(`  复卦 报：${a2.zhu.gua.label} ${a2.zhu.yaoName}动→${a2.zhu.bian.label} ${a2.S.toFixed(0)}分 ${a2.grade.t}`);
    console.log(`  体用 ${a1.zhu.ti.n}${a1.zhu.ti.wx}/${a1.zhu.yong.n}${a1.zhu.yong.wx} ${a1.zhu.relTxt.label} ｜ 时令 ${a1.zhu.strength}`);
    if (tech) console.log(`  技术 第${tech.tier}档/${tech.rank}名 ｜ 波动${tech.vol}% 20日${tech.rev > 0 ? '+' : ''}${tech.rev}% 缩量${tech.vshr}`);
    console.log(`  资讯 ${o.nNote}`);
    console.log(`  四票 初卦${o.v1 > 0 ? '+' : ''}${o.v1} 复占${o.v4 > 0 ? '+' : ''}${o.v4} 技术${o.v2 > 0 ? '+' : ''}${o.v2} 资讯${o.v3 > 0 ? '+' : ''}${o.v3}`);
    if (o.total >= 1) {
      console.log(`  → 买入时辰 ${a1.hour.name} ${a1.hour.span}`);
      console.log(`  → 买一 ¥${q.b1} ｜ 买二 ¥${q.b2} ｜ 止盈 ¥${q.t1} ｜ 止损 ¥${q.stop} ｜ 仓位 ${a1.posMax === 0 ? '空仓' : a1.posMax < 1 ? '半成' : '≤' + a1.posMax + '成'}`);
    } else {
      const weak = a1.zhu.rel === 'yongketi' || a1.S < 52;
      let s1 = Math.min(cap, R2(qt.price + atr * 0.35)), s2 = Math.min(cap, R2(qt.price + atr * 0.75));
      const cut = R2(qt.price - atr * 0.9);
      if (s1 <= qt.price) s1 = Math.min(cap, R2(qt.price + 0.01)); if (s2 <= s1) s2 = R2(s1 + 0.01);
      console.log(`  → 卖出时辰 ${weak ? '早盘 09:30–10:30' : a1.hour.name + ' ' + a1.hour.span} ｜ 减①¥${s1} 减②¥${s2} 破位¥${cut}`);
      console.log('  → 不建议新进；持仓按上方减仓价');
    }
  }
  console.log('\n' + '='.repeat(60));
})();
