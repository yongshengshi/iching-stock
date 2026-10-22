/* 单只诊断（命令行版）：node diag_one.js 002303 */
const fs = require('fs');
const html = fs.readFileSync('../卜卦选股.html', 'utf8');
global.window = {};
eval(html.match(/<script id="engine-script">([\s\S]*?)<\/script>/)[1]);
const X = global.window.Xuan;
const F = JSON.parse(fs.readFileSync('factor_data.json', 'utf8'));
const code = process.argv[2] || '002303';

/* ---- 技术面：复刻页面算法 ---- */
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
const tech = FR.find(r => r.code === code);

/* ---- 实时行情 ---- */
const gbk = new TextDecoder('gbk');
const q = (code[0] === '6' ? 'sh' : 'sz') + code;
function parseP(p) {
  if (!p || p.length < 45 || !+p[3]) return null;
  const ts = String(p[30] || ''); const hm = /^\d{14}$/.test(ts) ? ts.slice(8, 10) + ':' + ts.slice(10, 12) : '';
  return { name: p[1].replace(/\s/g, ''), price: +p[3], prevClose: +p[4], chg: +p[32], hi: +p[33], lo: +p[34], amount: +p[37], time: hm };
}
async function quote() {
  try { const r = await fetch('https://qt.gtimg.cn/q=' + q + '&_t=' + Date.now(), { cache: 'no-store' }); const m = gbk.decode(await r.arrayBuffer()).match(/="([^"]+)"/); const x = m && parseP(m[1].split('~')); if (x) return { ...x, src: '腾讯' }; } catch (e) {}
  try { const r = await fetch('https://push2.eastmoney.com/api/qt/stock/get?secid=' + (code[0] === '6' ? '1.' : '0.') + code + '&fields=f43,f44,f45,f58,f59,f60,f86,f170&ut=fa5fd1943c7b386f172d6893dbfba10b'); const d = (await r.json()).data; if (d && d.f43) { const p = Math.pow(10, d.f59 || 2); const t = d.f86 ? new Date(d.f86 * 1000) : null; return { name: d.f58, price: d.f43 / p, prevClose: d.f60 / p, chg: d.f170 / 100, hi: d.f44 / p, lo: d.f45 / p, amount: 0, time: t ? String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') : '', src: '东财' }; } } catch (e) {}
  return null;
}
async function news() {
  const GOOD = ['增持', '回购', '中标', '预增', '扭亏', '签订', '合作', '获批', '分红', '股权激励', '重大合同'];
  const BAD = ['减持', '质押', '诉讼', '仲裁', '问询', '立案', '处罚', '退市', '预亏', '亏损', '终止', '违规', '冻结', '商誉', '风险提示'];
  try {
    const r = await fetch(`https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size=6&page_index=1&ann_type=A&client_source=web&stock_list=${code}&_t=${Date.now()}`, { cache: 'no-store' });
    const j = await r.json();
    return ((j.data && j.data.list) || []).map(it => {
      const t = it.title_ch || it.title || '';
      let tone = 0;
      if (BAD.some(k => t.includes(k))) tone = -1; else if (GOOD.some(k => t.includes(k))) tone = 1;
      return { t, d: (it.notice_date || '').slice(5, 10), tone };
    });
  } catch (e) { return null; }
}

(async () => {
  const now = new Date();
  const info = X.nowInfo(now);
  const shi = X.timeGua(info);
  const mk = Math.max(1, Math.min(100, shi.base));
  const qt = await quote();
  if (!qt) { console.log('行情取不到'); return; }
  const nw = await news();

  const bao1 = 1 + Math.floor(Math.random() * 999);
  let bao2 = 1 + Math.floor(Math.random() * 999);
  for (let k = 0; k < 10 && Math.abs(bao2 - bao1) % 24 === 0; k++) bao2 = 1 + Math.floor(Math.random() * 999);

  const a1 = X.analyze(code, now, qt.price, qt, null, bao1, { tech, mkScore: mk });
  const a2 = X.analyze(code, now, qt.price, qt, null, bao2, { tech, mkScore: mk });
  const z = a1.zhu, z2 = a2.zhu, p = a1.pts;

  console.log('='.repeat(58));
  console.log(`${qt.name} ${code}   ¥${qt.price}  ${qt.chg > 0 ? '+' : ''}${qt.chg}%   [${qt.src} ${qt.time}]`);
  console.log(`日内 ${qt.lo} – ${qt.hi} ｜ 昨收 ${qt.prevClose}`);
  console.log(`时空：${info.yearGz}年 ${info.monthGz}月 ${info.dayGz}日 ${info.hourGz}时 ｜ 天时卦 ${shi.gua.label}${shi.yaoName}动 ${mk.toFixed(0)}分`);
  console.log('-'.repeat(58));
  console.log(`初卦（报 ${bao1}）：${z.gua.label} ${z.yaoName}动 → ${z.bian.label}  ${a1.S.toFixed(0)}分 ${a1.grade.t}`);
  console.log(`  「${z.yaoText}」`);
  console.log(`  体${z.ti.n}${z.ti.wx} 用${z.yong.n}${z.yong.wx} ${z.relTxt.label} ｜ 时令${z.strength}`);
  console.log(`复卦（报 ${bao2}）：${z2.gua.label} ${z2.yaoName}动 → ${z2.bian.label}  ${a2.S.toFixed(0)}分 ${a2.grade.t}  (${(a2.S - a1.S) > 0 ? '+' : ''}${(a2.S - a1.S).toFixed(0)})`);
  console.log(`  「${z2.yaoText}」`);
  if (tech) console.log(`技术面：第 ${tech.tier} 档 / ${tech.rank}名 ｜ 60日波动 ${tech.vol}% ｜ 20日涨幅 ${tech.rev}% ｜ 缩量比 ${tech.vshr}`);
  else console.log('技术面：无数据');
  if (nw) { console.log(`资讯面：近 ${nw.length} 条公告`); nw.slice(0, 4).forEach(n => console.log(`  ${n.d} ${n.tone > 0 ? '[偏多]' : n.tone < 0 ? '[偏空]' : '[中性]'} ${n.t.replace(/^\S+?:/, '').slice(0, 34)}`)); }
  else console.log('资讯面：获取失败');

  /* 四票 */
  const band = v => (v >= 66 ? 1 : v >= 52 ? 0 : -1);
  let v1 = band(a1.S); if (X.isBadGua(z.gua)) v1 -= 1;
  const g1 = band(a1.S), g2 = band(a2.S);
  let v4 = g2; if (g1 * g2 < 0) v4 = 0;
  const v2 = tech ? (tech.tier === 1 ? -1 : tech.tier === 2 ? 0 : 1) : 0;
  let v3 = 0;
  if (nw) { const bad = nw.filter(n => n.tone < 0).length, good = nw.filter(n => n.tone > 0).length; v3 = bad ? -1 : good ? 1 : 0; }
  const total = v1 + v4 + v2 + v3;
  const label = total >= 2 ? '可入场' : total >= 1 ? '轻仓试' : total === 0 ? '观望' : '回避';

  console.log('-'.repeat(58));
  console.log(`四票：初卦 ${v1 > 0 ? '+' : ''}${v1} ｜ 复占 ${v4 > 0 ? '+' : ''}${v4} ｜ 技术 ${v2 > 0 ? '+' : ''}${v2} ｜ 资讯 ${v3 > 0 ? '+' : ''}${v3}   =  ${total > 0 ? '+' : ''}${total}`);
  console.log(`结论：【${label}】`);

  const atr = p.atr, R2 = v => Math.round(v * 100) / 100, cap = a1.limitUp || Infinity;
  const isBuy = total >= 1;
  if (isBuy) {
    console.log(`买入时辰：${a1.hour.name} ${a1.hour.span}`);
    console.log(`买一 ¥${p.b1}（低于现价 ${((1 - p.b1 / qt.price) * 100).toFixed(2)}%）｜ 买二 ¥${p.b2} ｜ 止盈 ¥${p.t1} ｜ 止损 ¥${p.stop}`);
    console.log(`仓位上限：${a1.posMax === 0 ? '空仓' : a1.posMax < 1 ? '半成' : '≤' + a1.posMax + '成'}${a1.posCapped ? '（天时压制）' : ''} ｜ 次日涨停 ${a1.limitUp}`);
  } else {
    const weak = z.rel === 'yongketi' || a1.S < 52;
    let s1 = Math.min(cap, R2(qt.price + atr * 0.35)), s2 = Math.min(cap, R2(qt.price + atr * 0.75));
    const cut = R2(qt.price - atr * 0.9);
    if (s1 <= qt.price) s1 = Math.min(cap, R2(qt.price + 0.01)); if (s2 <= s1) s2 = R2(s1 + 0.01);
    console.log(`卖出时辰：${weak ? '早盘 09:30–10:30（弱股多低开冲高）' : a1.hour.name + ' ' + a1.hour.span}`);
    console.log(`减仓价① ¥${s1}（+${((s1 / qt.price - 1) * 100).toFixed(2)}%）｜ 减仓价② ¥${s2} ｜ 破位清仓 ¥${cut}`);
    console.log('不建议新进；持仓按上方减仓价执行，不补仓摊薄。');
  }
  console.log(`ATR ≈ ¥${atr}（日均波动 ${(p.vol * 100).toFixed(2)}%）｜ 技术面截至 ${F.meta.asOf}`);
  console.log('='.repeat(58));
})();
