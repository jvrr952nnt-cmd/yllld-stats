const { chromium } = require('playwright');
const fs = require('fs');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

(async () => {
  const out = {};
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: UA, locale: 'zh-CN', viewport: { width: 1280, height: 900 } });

  const targets = {
    xhs: 'https://www.xiaohongshu.com/user/profile/616d92bc000000000201fca5',
    douyin: 'https://www.douyin.com/user/MS4wLjABAAAAgrTzuFDtOabt3EAIECje9LG1fm4J1L7KyjkGvzkdgb0Wn2MqgKG-YnZDw7y7W44D',
    bili: 'https://space.bilibili.com/3546720686312292',
  };
  for (const [name, url] of Object.entries(targets)) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(12000);
      const text = await page.locator('body').innerText().catch(() => '');
      const title = await page.title().catch(() => '');
      out[name] = { title, url: page.url(), len: text.length, text: text.slice(0, 1600) };
    } catch (e) {
      out[name] = { error: String(e) };
    }
  }
  await browser.close();
  fs.writeFileSync('browser-probe.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
})();
