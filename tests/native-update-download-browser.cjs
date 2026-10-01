'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const requireRegression = createRequire(path.join(root, 'tests/regression/package.json'));
const { chromium, webkit } = requireRegression('playwright');
const output = process.env.GAMMA_OUT || '/private/tmp/gamma-native-download-browser';
fs.mkdirSync(output, { recursive: true });

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const relative = pathname.endsWith('/')
    ? `${decodeURIComponent(pathname).replace(/^\//, '')}index.html`
    : decodeURIComponent(pathname).replace(/^\//, '');
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404).end(); return;
  }
  response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(response);
});

(async () => {
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/download/`;
  const results = [];
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const page = await browser.newPage({ viewportSize: viewport, locale: 'ja-JP' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(url);
        await page.locator('#native-version').filter({ hasText: '0.2.71' }).waitFor();
        assert.equal(await page.getByRole('link', { name: 'ダウンロード（GitHub Releases）' }).getAttribute('href'), 'https://github.com/aratama-ship-it/stage-sketch-gamma/releases/latest');
        assert.equal(await page.getByRole('link', { name: 'ブラウザ版はこちら' }).getAttribute('href'), '../stage.html');
        assert.match(await page.locator('body').innerText(), /右クリックして「開く」/);
        assert.match(await page.locator('body').innerText(), /WebView保存領域/);
        const layout = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          actionHeight: document.querySelector('.download-action').getBoundingClientRect().height,
          title: document.title
        }));
        assert.equal(layout.scrollWidth, layout.clientWidth, 'horizontal overflow');
        assert(layout.actionHeight >= 44, 'download action is too short');
        assert.equal(layout.title, '舞台スケッチγ Mac版をダウンロード');
        assert.deepEqual(errors, []);
        await page.screenshot({ path: path.join(output, `${name}-${viewport.width}.png`), fullPage: true });
        results.push({ browser: name, width: viewport.width, status: 'pass', layout });
        await page.close();
      }
      const fallback = await browser.newPage({ viewportSize: { width: 900, height: 700 }, locale: 'ja-JP' });
      await fallback.route('**/native-latest.json', route => route.abort());
      await fallback.goto(url);
      assert.equal(await fallback.locator('#native-version').innerText(), '最新版は GitHub Releases でご確認ください。');
      await fallback.close();
    } finally {
      await browser.close();
    }
  }
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(results, null, 2));
  console.log(`PASS: ${results.length} download-page browser conditions at ${url}`);
})().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(() => server.close());
