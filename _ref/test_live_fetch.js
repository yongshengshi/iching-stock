const { chromium } = require('playwright');
const LIVE = 'https://xuanxue-stock.app.workbuddy.host/?sharecode=OYYVCCG5LE';

(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });

  // A. 正常
  const c1 = await b.newContext({ viewport: { width: 1280, height: 950 }, ignoreHTTPSErrors: true });
  const p1 = await c1.newPage();
  const e1 = []; p1.on('pageerror', x => e1.push(x.message));
  await p1.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p1.waitForTimeout(1800);
  await p1.fill('#stockCode', '002303'); await p1.click('#btnDivine'); await p1.waitForTimeout(4000);
  console.log('A 正常     :', (await p1.locator('.res-head').innerText()).replace(/\n/g, ' '));

  // B. 阻断主接口（线上 https 源下验证备用通道 CORS）
  const c2 = await b.newContext({ viewport: { width: 1280, height: 950 }, ignoreHTTPSErrors: true });
  await c2.route(u => new URL(u).hostname === 'qt.gtimg.cn', r => r.abort());
  const p2 = await c2.newPage();
  const hit = [];
  p2.on('request', r => { if (r.url().includes('gtimg')) hit.push(new URL(r.url()).hostname); });
  await p2.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p2.waitForTimeout(1800);
  await p2.fill('#stockCode', '002303'); await p2.click('#btnDivine'); await p2.waitForTimeout(6000);
  console.log('B 主域名被拦:', (await p2.locator('.res-head').innerText()).replace(/\n/g, ' '));
  console.log('B 走的通道 :', [...new Set(hit)].join(' → '));

  // C. 全阻断
  const c3 = await b.newContext({ viewport: { width: 1280, height: 950 }, ignoreHTTPSErrors: true });
  await c3.route(u => new URL(u).hostname.endsWith('gtimg.cn'), r => r.abort());
  const p3 = await c3.newPage();
  await p3.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p3.waitForTimeout(1800);
  await p3.fill('#stockCode', '002303'); await p3.click('#btnDivine'); await p3.waitForTimeout(8000);
  console.log('C 全阻断   :', (await p3.locator('.res-head').innerText()).replace(/\n/g, ' '));
  console.log('C 提示     :', await p3.locator('#toast').innerText());
  await p3.locator('#resultArea').screenshot({ path: 'v16_live_snap.png' });

  console.log('JS 错误    :', e1.length ? e1 : 'none');
  await b.close();
})();
