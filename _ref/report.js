const fs = require('fs');
const d = JSON.parse(fs.readFileSync('scan_all.json', 'utf8'));
const html = fs.readFileSync('../周易玄学选股.html', 'utf8');
global.window = {};
eval(html.match(/<script id="engine-script">([\s\S]*?)<\/script>/)[1]);
const X = global.window.Xuan;
const num = { '乾': 1, '兑': 2, '离': 3, '震': 4, '巽': 5, '坎': 6, '艮': 7, '坤': 8 };
const t1 = new Date(2026, 9, 20, 15, 0, 0);
const fmt = n => n.toFixed(2);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function detail(code) {
  const r = d.list.find(x => x.code === code);
  const a = X.analyze(code, t1, r.price);
  const z = a.zhu;
  const days = num[z.ti.n] + num[z.yong.n] + z.moving;
  let dd = new Date(t1), n = 0;
  while (n < days) { dd.setDate(dd.getDate() + 1); if (dd.getDay() !== 0 && dd.getDay() !== 6) n++; }
  return { r, a, z, days, date: dd.toISOString().slice(0, 10) };
}

const main = detail('002777'), alt = detail('000778');
const top = d.list.slice(0, 30);

const rows = top.map((r, i) => `<tr>
  <td class="c"><span class="rk ${i < 3 ? 'hot' : ''}">${i + 1}</span></td>
  <td><b>${esc(r.name)}</b></td>
  <td class="c mono muted">${r.code}</td>
  <td class="c mono">${fmt(r.price)}</td>
  <td class="c mono ${r.pct > 0 ? 'up' : r.pct < 0 ? 'down' : ''}">${r.pct > 0 ? '+' : ''}${r.pct}%</td>
  <td class="c">${r.gua}</td>
  <td class="c muted">${r.yao}</td>
  <td class="c">${r.ti}</td>
  <td class="c ${r.rel === '用生体' ? 'up' : r.rel === '用克体' ? 'down' : ''}">${r.rel}</td>
  <td class="c mono"><b>${r.mix.toFixed(0)}</b></td>
  <td class="c mono muted">${r.s1.toFixed(0)}/${r.s2.toFixed(0)}</td>
  <td class="c mono up">${fmt(r.b1)}</td>
  <td class="c mono down">${fmt(r.stop)}</td>
  <td class="c mono" style="color:#a9812f">${fmt(r.t1)}</td>
  <td class="c mono muted">${(r.amount / 10000).toFixed(1)}</td>
</tr>`).join('');

const card = (o, tag) => {
  const { r, a, z, days, date } = o;
  return `<div class="pick">
  <div class="pick-h">
    <span class="tag">${tag}</span>
    <span class="nm">${esc(r.name)}</span>
    <span class="cd mono">${r.code}</span>
    <span class="px mono ${r.pct > 0 ? 'up' : 'down'}">${fmt(r.price)}　${r.pct > 0 ? '+' : ''}${r.pct}%</span>
    <span class="sc mono">${r.mix.toFixed(0)}<small>分 · 今${r.s1.toFixed(0)}／明${r.s2.toFixed(0)}</small></span>
  </div>
  <div class="pick-b">
    <div>
      <div class="lbl">本卦 · ${z.gua.label}　${z.yaoName}爻动 → 变 ${z.bian.label}</div>
      <div class="q">「${esc(z.yaoText)}」</div>
      <div class="lbl" style="margin-top:10px">体用</div>
      <div class="q2">体${z.ti.n}（${z.ti.wx}）· 用${z.yong.n}（${z.yong.wx}）→ <b>${z.relTxt.label}</b>，${z.relTxt.desc}；体卦${z.strength}于戌月。</div>
      <div class="lbl" style="margin-top:10px">变卦</div>
      <div class="q2">${z.bian.label}：「${esc(z.bian.data.t)}」</div>
    </div>
    <div class="grid">
      <div class="cell"><span>入场挂单</span><b class="up">${fmt(a.pts.b1)}</b><i>次档 ${fmt(a.pts.b2)}</i></div>
      <div class="cell"><span>止损</span><b class="down">${fmt(a.pts.stop)}</b><i>收盘破则走</i></div>
      <div class="cell"><span>目标一</span><b style="color:#a9812f">${fmt(a.pts.t1)}</b><i>目标二 ${fmt(a.pts.t2)}</i></div>
      <div class="cell"><span>应期</span><b>${days}日</b><i>${date}</i></div>
      <div class="cell"><span>吉时</span><b style="font-size:15px">${a.hour.name}</b><i>${a.hour.span}</i></div>
      <div class="cell"><span>建议仓位</span><b style="font-size:15px">≤ 2 成</b><i>卦位 ${a.grade.pos}，天时弱故折减</i></div>
    </div>
  </div>
</div>`;
};

const page = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>全市场玄学选股 · 2026-10-20</title>
<style>
:root{--paper:#f7f2e7;--panel:#fffdf7;--panel2:#fbf6ea;--ink:#241f1a;--ink2:#5f5749;--ink3:#8b8172;--line:#e3d8c2;--red:#b3341f;--green:#1a7a5c;--gold:#a9812f}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--ink);background:radial-gradient(1100px 500px at 8% -8%,#fffdf6,rgba(255,253,246,0) 60%),var(--paper);padding:30px 20px 70px}
.wrap{max-width:1180px;margin:0 auto}
h1{font-family:"Songti SC","SimSun",serif;font-size:27px;letter-spacing:5px;font-weight:600}
.sub{font-size:12px;color:var(--ink3);letter-spacing:2px;margin-top:8px}
.hd{border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:22px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px}
.meta{font-size:12px;color:var(--ink2);line-height:1.9;text-align:right}
.meta b{color:var(--red)}
.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:22px}
.st{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:12px 14px}
.st span{font-size:11px;color:var(--ink3);letter-spacing:1px}
.st b{display:block;font-family:"Songti SC",serif;font-size:22px;margin-top:4px}
.st b i{font-size:11px;font-style:normal;color:var(--ink3);margin-left:3px}
h2{font-family:"Songti SC",serif;font-size:18px;letter-spacing:3px;margin:26px 0 12px;display:flex;align-items:center;gap:9px}
h2::before{content:"";width:4px;height:17px;background:var(--red);border-radius:2px}
.note{background:rgba(179,52,31,.045);border:1px solid rgba(179,52,31,.18);border-radius:10px;padding:13px 16px;font-size:13px;line-height:1.95;color:#7a3125}
.pick{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:14px;box-shadow:0 10px 30px -20px rgba(90,70,40,.5)}
.pick-h{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;border-bottom:1px dashed var(--line);padding-bottom:12px;margin-bottom:13px}
.tag{background:var(--red);color:#fff;font-size:11px;padding:3px 9px;border-radius:5px;letter-spacing:1px}
.tag.alt{background:var(--gold)}
.nm{font-family:"Songti SC",serif;font-size:20px;font-weight:600;letter-spacing:1px}
.cd{font-size:12px;color:var(--ink3)}
.px{font-family:"Songti SC",serif;font-size:16px;font-weight:600}
.sc{margin-left:auto;font-family:"Songti SC",serif;font-size:30px;color:var(--red);font-weight:600}
.sc small{font-size:11px;color:var(--ink3);margin-left:2px}
.pick-b{display:grid;grid-template-columns:1.25fr 1fr;gap:20px}
@media(max-width:820px){.pick-b{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}}
.lbl{font-size:11px;color:var(--red);letter-spacing:1.5px;margin-bottom:4px}
.q{font-family:"Songti SC",serif;font-size:16px;line-height:1.8}
.q2{font-size:13px;line-height:1.85;color:var(--ink2)}
.q2 b{color:var(--ink)}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;align-content:start}
.cell{background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:9px 11px}
.cell span{font-size:10.5px;color:var(--ink3);display:block}
.cell b{font-family:"Songti SC",serif;font-size:18px;display:block;margin-top:2px}
.cell i{font-size:10px;font-style:normal;color:var(--ink3);display:block;margin-top:2px}
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:12.5px}
th{background:var(--panel2);font-weight:500;font-size:11px;color:var(--ink3);letter-spacing:.5px;padding:9px 8px;text-align:left;white-space:nowrap}
td{padding:8px;border-top:1px solid #f0e9da;white-space:nowrap}
td.c,th.c{text-align:center}
.mono{font-variant-numeric:tabular-nums;font-family:"SFMono-Regular",Consolas,monospace;font-size:12px}
.muted{color:var(--ink3)}
.up{color:var(--red)} .down{color:var(--green)}
.rk{display:inline-grid;place-items:center;width:19px;height:19px;border-radius:50%;font-size:10.5px;color:#fff;background:#c9bda4;font-family:sans-serif}
.rk.hot{background:var(--red)}
.foot{margin-top:24px;font-size:11.5px;color:var(--ink3);line-height:2;text-align:center}
</style></head><body><div class="wrap">
<div class="hd">
  <div><h1>全市场玄学选股</h1><div class="sub">周易 · 梅花易数 · 五行体用 · 沪深主板全量扫描</div></div>
  <div class="meta">
    扫描日 <b>2026-10-20（收盘）</b><br>
    今日四柱 ${d.meta.gz1}<br>
    明日四柱 ${d.meta.gz2}<br>
    天时：今日 ${d.meta.shi1.label}${d.meta.shi1.yao}爻动 ${d.meta.shi1.score.toFixed(0)}分 ／ 明日 ${d.meta.shi2.label}${d.meta.shi2.yao}爻动 ${d.meta.shi2.score.toFixed(0)}分
  </div>
</div>

<div class="stats">
  <div class="st"><span>抓取有效行情</span><b>${d.meta.total}<i>只</i></b></div>
  <div class="st"><span>流动性入围</span><b>${d.meta.pool}<i>只</i></b></div>
  <div class="st"><span>双时空≥58分</span><b>${d.dualCount}<i>只</i></b></div>
  <div class="st"><span>去重后卦断</span><b>${d.uniqCount}<i>种</i></b></div>
  <div class="st"><span>明日天时</span><b style="color:var(--green)">${d.meta.shi2.score.toFixed(0)}<i>分 · 偏弱</i></b></div>
</div>

<div class="note"><b>天时先看：</b>今日收盘卦【${d.meta.shi1.label}】${d.meta.shi1.yao}爻动，仅 ${d.meta.shi1.score.toFixed(0)} 分；明日巳时卦【${d.meta.shi2.label}】${d.meta.shi2.yao}爻动 —— <b>「归妹愆期，迟归有时」</b>：期未至，宜等不宜追。故本表所有标的<b>只列卦气、不给重仓</b>，单只建议不超过 2 成，总仓不超过 3 成。</div>

<h2>主选 · 备选</h2>
${card(main, '主选')}
${card(alt, '备选')}

<h2>双时空印证 · 前 30 种卦断</h2>
<table><thead><tr>
<th class="c">#</th><th>名称</th><th class="c">代码</th><th class="c">收盘</th><th class="c">涨跌</th>
<th class="c">本卦</th><th class="c">动爻</th><th class="c">体卦</th><th class="c">体用</th><th class="c">综合</th><th class="c">今/明</th>
<th class="c">买入</th><th class="c">止损</th><th class="c">目标</th><th class="c">成交额亿</th>
</tr></thead><tbody>${rows}</tbody></table>

<div class="note" style="margin-top:16px">
<b>为何主选不是第一名：</b>榜首【胜利精密 002426】综合 89 分、泽地萃六二「引吉，无咎」本是好爻，但<b>变卦为「困」</b>——萃极而困，聚人之后受困，是「先热后冷」之象；且股价仅 2.33 元，回撤弹性大。<b>主选【久远银海 002777】</b>取的是卦体更正：乾为天九五「飞龙在天，利见大人」，变卦「火天大有」卦辞仅「元亨」二字，是最干净的向上之象；且今日 81／明日 79，双时空最均衡，戌月乾金得旺。明日转「天山遁」，遁者退也——故明日只许低吸 13.57，不许追高。
</div>

<div class="note" style="margin-top:12px">
<b>扫描口径：</b>穷举沪深主板 8000 个代码段取得 3125 只有效行情 → 剔除 ST／退市／停牌／涨跌停／成交额＜5000 万／换手异常 → 2030 只入围 → 以「今日收盘（申时）」与「明日巳时」两个时空分别起卦，取两卦均 ≥58 分者 512 只 → 同卦同动爻视为同一卦断，去重后按综合分排序。<br>
<b>读表须知：</b>分数只由「卦辞判词＋动爻判词＋体用生克＋时令旺衰」四项合成，<b>卦名本身不计分</b>。因此「否」「困」「蹇」「讼」这类卦名不吉者，若动爻辞带吉语，仍可能拿到高分——看到这两类卦名（否／困／蹇／讼／剥）请直接降级处理，这是本模型的已知偏差。
</div>

<div class="foot">
卦以八除，爻以六除，余零取八或六<br>
本页由《周易》梅花易数规则程序化生成，属传统文化研究与娱乐实验，<b>不构成投资建议</b>
</div>
</div></body></html>`;

fs.writeFileSync('../玄学选股报告-2026-10-20.html', page);
console.log('report written', page.length);
