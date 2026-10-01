'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const requireFromRegression = createRequire(path.join(root, 'tests/regression/package.json'));
const { chromium, webkit } = requireFromRegression('playwright');
const H = require(path.join(root, 'tests/regression/browser-helpers.cjs'));

function mime(file) {
  return ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream';
}

function server() {
  const instance = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const relative = pathname === '/' ? 'stage.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(root, relative);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
      else response.writeHead(200, { 'content-type': mime(file), 'cache-control': 'no-store' }).end(data);
    });
  });
  return instance;
}

const counts = (document) => ({
  id: document.project.id,
  scenes: document.project.scenes.filter((row) => row.kind === 'scene').length,
  performers: document.project.cast.length,
});

async function confirmVenueIfShown(page) {
  const include = page.locator('#stage-venue-export-include');
  if (await include.isVisible()) await include.click();
}

async function exportDownload(page, directory) {
  await page.locator('#stage-export-json').click();
  await page.locator('#stage-project-export-modal').waitFor({ state: 'visible' });
  assert.match(await page.locator('#stage-project-export-name').inputValue(), /\.stagesketch$/);
  const pending = page.waitForEvent('download');
  await page.locator('#stage-project-export-form button[type=submit]').click();
  await confirmVenueIfShown(page);
  const download = await pending;
  assert.match(download.suggestedFilename(), /\.stagesketch$/);
  const destination = path.join(directory, download.suggestedFilename());
  await download.saveAs(destination);
  return destination;
}

async function importAndReplace(page, file) {
  await page.locator('#stage-import-json').setInputFiles(file);
  await page.locator('#stage-import-modal').waitFor({ state: 'visible' });
  await page.locator('#stage-import-replace').click();
  await page.locator('#stage-import-modal').waitFor({ state: 'hidden' });
}

async function verifyEngine(engine, launcher, baseURL, directory) {
  const browser = await launcher.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ja-JP', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await H.boot(page, baseURL);
    assert.equal(fixture.scene, 'C-1');
    await page.evaluate(() => { window.showSaveFilePicker = undefined; });
    const before = await H.documentValue(page);
    const expected = counts(before);

    const stagesketch = await exportDownload(page, directory);
    const exported = JSON.parse(fs.readFileSync(stagesketch, 'utf8'));
    assert.equal(exported.kind, 'shosai-stage-sketch');
    assert.equal(exported.version, 4);
    await importAndReplace(page, stagesketch);
    const afterStagesketch = await H.documentValue(page);
    assert.deepEqual(counts(afterStagesketch), expected, `${engine} .stagesketch roundtrip`);

    const jsonFixturePath = path.join(root, 'stage-samples/feature-test-show.json');
    const jsonFixture = JSON.parse(fs.readFileSync(jsonFixturePath, 'utf8'));
    await importAndReplace(page, jsonFixturePath);
    const afterJson = await H.documentValue(page);
    const afterJsonCounts = counts(afterJson);
    assert.equal(afterJson.project.title, jsonFixture.project.title, `${engine} .json title`);
    assert.deepEqual(
      { scenes: counts(afterJson).scenes, performers: counts(afterJson).performers },
      { scenes: expected.scenes, performers: expected.performers },
      `${engine} .json import`,
    );

    await page.locator('#stage-import-json').setInputFiles({
      name: 'wrong.lightdesign.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'shosai.light-design', version: 1, rig: { fixtures: [], trusses: [] }, scenes: [] })),
    });
    const notice = page.locator('#stage-import-notice');
    await notice.waitFor({ state: 'visible' });
    assert.equal(await notice.textContent(), 'これは照明デザインの書類です。照明の画面から読み込んでください。');
    assert.deepEqual(counts(await H.documentValue(page)), afterJsonCounts, `${engine} wrong document keeps show`);
    assert.deepEqual(errors, [], `${engine} page errors`);
    await context.close();
  } finally {
    await browser.close();
  }
}

async function verifyChromiumPicker(baseURL) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ja-JP', serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__stageSketchPickerOptions = null;
      window.showSaveFilePicker = async (options) => {
        window.__stageSketchPickerOptions = options;
        return { createWritable: async () => ({ write: async () => {}, close: async () => {} }) };
      };
    });
    await H.boot(page, baseURL);
    await page.locator('#stage-export-json').click();
    await page.locator('#stage-project-export-form button[type=submit]').click();
    await confirmVenueIfShown(page);
    await page.waitForFunction(() => window.__stageSketchPickerOptions !== null);
    const options = await page.evaluate(() => window.__stageSketchPickerOptions);
    assert.match(options.suggestedName, /\.stagesketch$/);
    assert.deepEqual(options.types.map((type) => type.accept['application/json']), [['.stagesketch'], ['.json']]);
    await context.close();

    const english = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-GB', serviceWorkers: 'block' });
    const englishPage = await english.newPage();
    await englishPage.addInitScript(() => {
      localStorage.setItem('gamma:shosai-stage-tour-v1', 'done');
      localStorage.setItem('gamma:shosai-stage-lang', 'en');
    });
    await englishPage.goto(baseURL);
    await englishPage.waitForFunction(() => Boolean(window.GAMMA_WORKSPACE));
    await englishPage.locator('#stage-prefs-btn').click();
    await englishPage.locator('#stage-lang').selectOption('en');
    assert.equal(await englishPage.locator('.stage-project-import-note').textContent(), 'JSON files exported from the beta version can also be imported.');
    await english.close();
  } finally {
    await browser.close();
  }
}

(async () => {
  const instance = server();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gamma-w5-'));
  try {
    await new Promise((resolve) => instance.listen(0, '127.0.0.1', resolve));
    const baseURL = `http://127.0.0.1:${instance.address().port}/stage.html`;
    await verifyEngine('Chromium', chromium, baseURL, directory);
    await verifyEngine('WebKit', webkit, baseURL, directory);
    await verifyChromiumPicker(baseURL);
    console.log('Chromium and WebKit passed at 1440x1000 (feature test C-1)');
  } finally {
    await new Promise((resolve) => instance.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
