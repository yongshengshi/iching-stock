/* 生成站点：首页=个股诊断，旧版玄学→xuanxue.html，历史报告→report.html */
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..');
const out = path.join(src, 'site');
if (!fs.existsSync(out)) fs.mkdirSync(out);

/* 1. 首页：卜卦选股（两阶段流程） */
const idx = fs.readFileSync(path.join(src, '卜卦选股.html'), 'utf8');
fs.writeFileSync(path.join(out, 'index.html'), idx);

/* 2. 旧版玄学选股 → xuanxue.html，并加返回链接 */
let xu = fs.readFileSync(path.join(src, '周易玄学选股.html'), 'utf8');
xu = xu.replace('</header>',
  '</header>\n  <a href="index.html" id="backDiag" style="display:inline-block;margin:-6px 0 14px;font-size:12px;color:#5f5749;text-decoration:none;border-bottom:1px solid #e3d8c2;padding-bottom:2px">← 个股诊断</a>');
const xuScript = `<script>(function(){var a=document.getElementById('backDiag');if(a&&location.search)a.href='index.html'+location.search;})();</script>\n</body>`;
const xuLast = xu.lastIndexOf('</body>');
xu = xu.slice(0, xuLast) + xuScript + xu.slice(xuLast + 7);
fs.writeFileSync(path.join(out, 'xuanxue.html'), xu);

/* 2.4 决策台账 */
const ledPage = fs.readFileSync(path.join(src, '台账.html'), 'utf8');
fs.writeFileSync(path.join(out, '台账.html'), ledPage);

/* 2.5 清理旧的诊断页 */
const oldDiag = path.join(out, 'diag.html');
if (fs.existsSync(oldDiag)) fs.unlinkSync(oldDiag);

/* 3. 历史报告 */
let rep = fs.readFileSync(path.join(src, '玄学选股报告-2026-10-20.html'), 'utf8');
rep = rep.replace('<title>全市场玄学选股 · 2026-10-20</title>', '<title>全市场扫描快照 · 2026-10-20（历史）</title>');
rep = rep.replace('<div><h1>全市场玄学选股</h1><div class="sub">周易 · 梅花易数 · 五行体用 · 沪深主板全量扫描</div></div>',
  '<div><h1>全市场玄学选股 · 历史快照</h1><div class="sub">2026-10-20 收盘 · 主板 3051 只 · 非今日数据</div></div>');
rep = rep.replace('<div class="wrap">', `<div class="wrap">
<div style="background:#b3341f;color:#fff;padding:13px 18px;border-radius:10px;font-size:13px;line-height:1.85;margin-bottom:18px">
  <b>⚠ 这是 2026-10-20 收盘的历史快照，不是今日数据。</b><br>
  要看今天的数据，请回<a href="index.html" style="color:#fff;text-decoration:underline">个股诊断</a>，或进<a href="xuanxue.html" style="color:#fff;text-decoration:underline">玄学全量选股</a>跑一次现场扫描。
</div>`, 1);
const repScript = `<script>document.querySelectorAll('a[href^="index.html"],a[href^="xuanxue.html"]').forEach(function(a){if(location.search&&!a.getAttribute('href').includes('?'))a.href+=location.search;});</script>\n</body>`;
const repLast = rep.lastIndexOf('</body>');
rep = rep.slice(0, repLast) + repScript + rep.slice(repLast + 7);
fs.writeFileSync(path.join(out, 'report.html'), rep);

/* 4. 清理旧的因子页（已合并进个股诊断） */
const oldFactor = path.join(out, 'factor.html');
if (fs.existsSync(oldFactor)) fs.unlinkSync(oldFactor);

console.log('site 已生成：index / xuanxue / report');
