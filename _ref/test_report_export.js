const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 950 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///' + path.resolve('../site/index.html').replace(/\\/g, '/'));
  await p.waitForTimeout(800);

  // 先跑全量扫描
  await p.click('#btnScanAll');
  await p.waitForSelector('#batchResult table', { timeout: 90000 });
  await p.waitForTimeout(400);

  // 导出报告
  const dl = p.waitForEvent('download');
  await p.click('#btnReport');
  const d = await dl;
  const out = path.resolve('report_export.html');
  await d.saveAs(out);
  console.log('文件名:', d.suggestedFilename(), '| 大小', (fs.statSync(out).size / 1024).toFixed(0) + 'KB');

  // 打开导出的报告
  const p2 = await ctx.newPage();
  const e2 = []; p2.on('pageerror', x => e2.push(x.message));
  await p2.goto('file:///' + out.replace(/\\/g, '/'));
  await p2.waitForTimeout(400);
  console.log('报告标题:', await p2.title());
  console.log('主选卡:', (await p2.locator('.pick').first().innerText()).replace(/\n/g, ' ').slice(0, 90));
  console.log('表格行数:', await p2.locator('tbody tr').count());
  console.log('统计卡:', (await p2.locator('.stats').innerText()).replace(/\n/g, ' '));
  console.log('JS 错误:', errs.concat(e2).length ? errs.concat(e2) : 'none');
  await p2.screenshot({ path: 'v18_report.png' });
  await b.close();
})();
