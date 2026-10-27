/* 换仓决策卦：卖美盈森 → 买长江电力（6个月+） */
const fs = require('fs');
const html = fs.readFileSync('../卜卦选股.html', 'utf8');
global.window = {};
eval(html.match(/<script id="engine-script">([\s\S]*?)<\/script>/)[1]);
const X = global.window.Xuan;
const gbk = new TextDecoder('gbk');

async function quote(code) {
  try {
    const r = await fetch('https://qt.gtimg.cn/q=' + (code[0] === '6' ? 'sh' : 'sz') + code + '&_t=' + Date.now(), { cache: 'no-store' });
    const m = gbk.decode(await r.arrayBuffer()).match(/="([^"]+)"/);
    const p = m[1].split('~');
    return { name: p[1].replace(/\s/g, ''), price: +p[3], chg: +p[32], hi: +p[33], lo: +p[34], time: String(p[30] || '').slice(8, 12) };
  } catch (e) { return null; }
}

(async () => {
  const now = new Date();
  const info = X.nowInfo(now);
  const shi = X.timeGua(info);
  const sc = Math.round(Math.max(1, Math.min(100, shi.base)));

  const bao1 = 1 + Math.floor(Math.random() * 999);
  let bao2 = 1 + Math.floor(Math.random() * 999);
  for (let k = 0; k < 20 && Math.abs(bao2 - bao1) % 8 === 0; k++) bao2 = 1 + Math.floor(Math.random() * 999);

  const g1 = X.stockGua('000000', info, bao1);
  const g2 = X.stockGua('000000', info, bao2);
  const s1 = Math.round(0.32 * g1.subs.A + 0.30 * g1.subs.B + 0.23 * g1.subs.C + 0.15 * g1.subs.D);
  const s2 = Math.round(0.32 * g2.subs.A + 0.30 * g2.subs.B + 0.23 * g2.subs.C + 0.15 * g2.subs.D);

  console.log('='.repeat(62));
  console.log(`【换仓卦】问：卖美盈森，换长江电力长持 6 个月以上`);
  console.log(`时空：${info.yearGz}年 ${info.monthGz}月 ${info.dayGz}日 ${info.hourGz}时 ｜ 时运卦 ${shi.gua.label} ${sc}分`);
  console.log('-'.repeat(62));
  console.log(`初占（报 ${bao1}）：${g1.gua.label} ${g1.yaoName}动 → ${g1.bian.label}`);
  console.log(`  ${s1} 分 ｜ 体${g1.ti.n}${g1.ti.wx} 用${g1.yong.n}${g1.yong.wx} ${g1.relTxt.label} ｜ 时令${g1.strength}`);
  console.log(`  卦辞：「${g1.gua.data.t}」`);
  console.log(`  爻辞：「${g1.yaoText}」`);
  console.log(`  变卦辞：「${g1.bian.data.t}」`);
  console.log(`再占（报 ${bao2}）：${g2.gua.label} ${g2.yaoName}动 → ${g2.bian.label}`);
  console.log(`  ${s2} 分 ｜ 体${g2.ti.n}${g2.ti.wx} 用${g2.yong.n}${g2.yong.wx} ${g2.relTxt.label} ｜ 时令${g2.strength}`);
  console.log(`  爻辞：「${g2.yaoText}」`);
  console.log(`  对照：初占 ${s1} → 再占 ${s2}（${s2 - s1 > 0 ? '+' : ''}${s2 - s1}）`);

  const q1 = await quote('002303');
  const q2 = await quote('600900');
  console.log('\n' + '-'.repeat(62));
  console.log(`美盈森 ${q1 ? q1.price + ' ' + (q1.chg > 0 ? '+' : '') + q1.chg + '% [' + q1.time + ']' : '取不到'}`);
  console.log(`长电   ${q2 ? q2.price + ' ' + (q2.chg > 0 ? '+' : '') + q2.chg + '% [' + q2.time + ']' : '取不到'}`);
  console.log('='.repeat(62));
})();
