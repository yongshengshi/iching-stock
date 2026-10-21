const { chromium } = require('playwright');
const path = require('path');
const url = 'file:///' + path.resolve('../site/index.html').replace(/\\/g, '/');

(async () => {
  const b = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });

  // A. 正常
  const p1 = await b.newPage({ viewport: { width: 1280, height: 950 }, deviceScaleFactor: 1.3 });
  await p1.goto(url); await p1.waitForTimeout(700);
  await p1.fill('#stockCode', '002303'); await p1.click('#btnDivine'); await p1.waitForTimeout(3500);
  console.log('A 正常       :', (await p1.locator('.res-head').innerText()).replace(/\n/g, ' '));

  // B. 只阻断主域名 qt.gtimg.cn，看是否自动切到 sqt
  const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } });
  await ctx.route(u => new URL(u).hostname === 'qt.gtimg.cn', r => r.abort());
  const p2 = await ctx.newPage();
  const hit = [];
  p2.on('request', r => { if (r.url().includes('gtimg')) hit.push(new URL(r.url()).hostname + new URL(r.url()).pathname); });
  await p2.goto(url); await p2.waitForTimeout(700);
  await p2.fill('#stockCode', '002303'); await p2.click('#btnDivine'); await p2.waitForTimeout(6000);
  console.log('B 主域名被阻 :', (await p2.locator('.res-head').innerText()).replace(/\n/g, ' '));
  console.log('B 请求顺序   :', [...new Set(hit)].join('  |  '));

  // C. 全阻断
  const ctx3 = await b.newContext({ viewport: { width: 1280, height: 950 } });
  await ctx3.route(u => new URL(u).hostname.endsWith('gtimg.cn'), r => r.abort());
  const p3 = await ctx3.newPage();
  await p3.goto(url); await p3.waitForTimeout(700);
  await p3.fill('#stockCode', '002303'); await p3.click('#btnDivine'); await p3.waitForTimeout(7000);
  console.log('C 全阻断     :', (await p3.locator('.res-head').innerText()).replace(/\n/g, ' '));
  console.log('C toast      :', await p3.locator('#toast').innerText());
  await p3.locator('#resultArea').screenshot({ path: 'v15_snap.png' });

  await b.close();
})();
