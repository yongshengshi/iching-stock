const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1.4 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));

  await page.goto('file:///' + path.resolve('../周易玄学选股.html').replace(/\\/g, '/'));
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'shot1_top.png', fullPage: false });

  // 个股测算
  await page.fill('#stockCode', '600519');
  await page.click('#btnDivine');
  await page.waitForTimeout(700);
  const res = await page.locator('#resultArea').boundingBox();
  await page.screenshot({ path: 'shot2_stock.png', fullPage: false, clip: { x: 0, y: Math.max(0, res.y - 40), width: 1280, height: Math.min(900, res.height + 80) } });

  // 批量
  await page.click('#btnScanAll');
  await page.waitForTimeout(800);
  const b = await page.locator('#batchResult').boundingBox();
  await page.screenshot({ path: 'shot3_batch.png', fullPage: false, clip: { x: 0, y: Math.max(0, b.y - 30), width: 1280, height: Math.min(1000, b.height + 60) } });

  // 错误输入
  await page.fill('#stockCode', '300750');
  await page.click('#btnDivine');
  await page.waitForTimeout(400);
  const toastTxt = await page.locator('#toast').textContent();

  console.log('console errors:', errs.length ? errs : 'none');
  console.log('toast:', toastTxt);
  console.log('result visible:', await page.locator('#resultArea').isVisible());
  await browser.close();
})();
