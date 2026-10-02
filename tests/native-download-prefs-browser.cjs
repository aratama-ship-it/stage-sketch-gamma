'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const requireRegression = createRequire(path.join(root, 'tests/regression/package.json'));
const { chromium, webkit } = requireRegression('playwright');
const output = process.env.GAMMA_OUT || '/private/tmp/gamma-native-download-prefs';
fs.mkdirSync(output, { recursive: true });

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
const makeServer = () => http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(response);
});
const listen = (server, port) => new Promise((resolve, reject) => server.once('error', reject).listen(port, '127.0.0.1', resolve));
const RELEASE_PREFIX = 'https://github.com/aratama-ship-it/stage-sketch-gamma/releases/download/';
const latestPage = 'https://github.com/aratama-ship-it/stage-sketch-gamma/releases/latest';

async function openPrefs(page, base) {
  await page.goto(`${base}/stage.html`);
  await page.locator('#stage-prefs-btn').waitFor();
  await page.locator('#stage-prefs-btn').click();
  await page.locator('#stage-pref-guide > summary').click();
}

(async () => {
  const server = makeServer();
  await listen(server, 0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const results = [];
  const shellServer = makeServer();
  let shellPort = null;
  for (const port of [8957, 8958]) { try { await listen(shellServer, port); shellPort = port; break; } catch (e) { /* port busy */ } }
  try {
    for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
      const browser = await engine.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewportSize: { width: 1440, height: 900 }, locale: 'ja-JP' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const published = JSON.parse(fs.readFileSync(path.join(root, 'native-latest.json'), 'utf8'));
        await openPrefs(page, base);
        await page.locator('#stage-native-version').filter({ hasText: published.version }).waitFor();
        assert.equal(await page.locator('#stage-native-download').getAttribute('href'), published.zip);
        assert(published.zip.startsWith(RELEASE_PREFIX));
        assert.equal(await page.locator('#stage-native-note').isHidden(), true);
        assert.equal(await page.locator('#stage-pref-native').isVisible(), true);
        assert.match(await page.locator('#stage-pref-native').innerText(), /最新のMac版をダウンロード/);
        assert.equal(await page.locator('#stage-pref-native a[href$="/download/"]').count(), 1);
        await page.locator('#stage-pref-native').screenshot({ path: path.join(output, `${name}-block.png`) });
        await page.close();

        const evil = await browser.newPage({ viewportSize: { width: 1440, height: 900 }, locale: 'ja-JP' });
        await evil.route('**/native-latest.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: '0.9.9', zip: 'https://example.com/x.zip' }) }));
        await openPrefs(evil, base);
        await evil.locator('#stage-native-version').filter({ hasText: '0.9.9' }).waitFor();
        assert.equal(await evil.locator('#stage-native-download').getAttribute('href'), latestPage);
        await evil.close();

        const bad = await browser.newPage({ viewportSize: { width: 1440, height: 900 }, locale: 'ja-JP' });
        await bad.route('**/native-latest.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: '<img src=x>' }) }));
        await openPrefs(bad, base);
        await bad.locator('#stage-native-note').waitFor({ state: 'visible' });
        assert.equal(await bad.locator('#stage-native-version').isHidden(), true);
        assert.equal(await bad.locator('#stage-native-download').getAttribute('href'), latestPage);
        await bad.close();

        const offline = await browser.newPage({ viewportSize: { width: 1440, height: 900 }, locale: 'ja-JP' });
        await offline.route('**/native-latest.json', route => route.abort());
        await openPrefs(offline, base);
        await offline.locator('#stage-native-note').waitFor({ state: 'visible' });
        assert.equal(await offline.locator('#stage-native-download').getAttribute('href'), latestPage);
        await offline.close();

        const en = await browser.newPage({ viewportSize: { width: 1440, height: 900 }, locale: 'en-US' });
        await openPrefs(en, base);
        await en.locator('#stage-native-version').filter({ hasText: published.version }).waitFor();
        const enText = await en.locator('#stage-pref-native').innerText();
        assert.match(enText, /Download the latest Mac app/i, enText);
        assert.doesNotMatch(enText, /[ぁ-ん]/, enText);
        await en.close();

        if (shellPort) {
          const shell = await browser.newPage({ viewportSize: { width: 1440, height: 900 }, locale: 'ja-JP' });
          await openPrefs(shell, `http://127.0.0.1:${shellPort}`);
          assert.equal(await shell.locator('#stage-pref-native').isHidden(), true);
          await shell.close();
        }
        assert.deepEqual(errors, []);
        results.push({ browser: name, status: 'pass', shellChecked: Boolean(shellPort) });
      } finally { await browser.close(); }
    }
  } finally { server.close(); shellServer.close(); }
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(results, null, 2));
  console.log(`PASS: native-download prefs ${JSON.stringify(results)}`);
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
