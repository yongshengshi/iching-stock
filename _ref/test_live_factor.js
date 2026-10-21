const { chromium } = require('playwright');
const LIVE = 'https://xuanxue-stock.app.workbuddy.host/?sharecode=OYYVCCG5LE';
(async () => {
  const b = await chromium.launch({ executablePath: 'C://Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 950 }, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(1800);
  console.log('主站因子入口:', await p.locator('#lnkFactor').getAttribute('href'));
  await p.click('#lnkFactor'); await p.waitForTimeout(1500);
  console.log('因子页:', await p.title());
  console.log('市场温度:', (await p.locator('#metaBar').innerText()).replace(/\n/g, ' '));
  console.log('黑名单行:', await p.locator('#badBody tr').count());
  await p.fill('#code', '002303'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  console.log('美盈森体检:', (await p.locator('#checkArea').innerText()).replace(/\n/g, ' ').slice(0, 100));
  console.log('返回链接:', await p.locator('#backLink').getAttribute('href'));
  // 移动端
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto('https://xuanxue-stock.app.workbuddy.host/factor.html?sharecode=OYYVCCG5LE', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await m.waitForTimeout(1200);
  console.log('移动端溢出:', await m.evaluate(() => document.documentElement.scrollWidth + '/' + document.documentElement.clientWidth));
  console.log('JS 错误:', errs.length ? errs : 'none');
  await b.close();
})();
