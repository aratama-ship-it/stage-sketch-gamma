const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const requireFromRoot = createRequire(path.join(root, 'package.json'));
const { chromium, webkit } = requireFromRoot('./tests/regression/node_modules/playwright');
const mime = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function serve() {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
    const filename = path.resolve(root, pathname || 'stage.html');
    if (!filename.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end();
    fs.stat(filename, (error, stat) => {
      if (error || !stat.isFile()) return response.writeHead(404).end();
      response.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream');
      fs.createReadStream(filename).pipe(response);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function boot(page, base) {
  await page.addInitScript(() => {
    localStorage.setItem('gamma:shosai-stage-tour-v1', 'done');
    localStorage.setItem('gamma:shosai-stage-lang', 'ja');
  });
  await page.goto(`${base}/stage.html?feature-test`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.GAMMA_ICON_TIPS && window.GAMMA_WORKSPACE && window.SHOSAI_STAGE_SESSION_BRIDGE);
  const backup = page.locator('#stage-launch-backup-close');
  if (await backup.isVisible().catch(() => false)) await backup.click();
  await page.waitForFunction(() => JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id === 'gamma-feature-test-v31');
  await page.evaluate(() => {
    GAMMA_WORKSPACE.normal();
    if (!SHOSAI_STAGE_SESSION_BRIDGE.openSceneById('ft-scene-a1')) throw new Error('A-1を開けません');
  });
  await page.waitForTimeout(300);
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const summary = [];
  try {
    for (const [engine, browserType] of Object.entries({ chromium, webkit })) {
      const browser = await browserType.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, locale: 'ja-JP' });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await boot(page, base);
        const candidates = await page.evaluate(() => {
          const rows = [];
          [...document.querySelectorAll("button, a, label, [role='button']")].forEach((element, index) => {
            if (!GAMMA_ICON_TIPS.isTarget(element)) return;
            const id = `icon-tip-probe-${index}`;
            element.dataset.iconTipProbe = id;
            rows.push({ id, name: element.id || String(element.className), hadTitle: element.hasAttribute('title') });
          });
          return rows;
        });
        assert.ok(candidates.length >= 40, `${engine}: 候補が少なすぎます (${candidates.length})`);
        const missing = [];
        for (const candidate of candidates) {
          const locator = page.locator(`[data-icon-tip-probe="${candidate.id}"]`);
          const focused = await locator.evaluate((operation) => {
            const target = operation.matches('label')
              ? operation.querySelector('input, button, a, [tabindex]')
              : operation;
            if (!target || target.disabled) return false;
            if (target.tabIndex < 0) target.setAttribute('tabindex', '-1');
            target.focus();
            return document.activeElement === target;
          });
          if (!focused) await locator.dispatchEvent('pointerover', { pointerType: 'mouse', bubbles: true });
          await page.waitForTimeout(25);
          const result = await page.evaluate((id) => {
            const operation = document.querySelector(`[data-icon-tip-probe="${id}"]`);
            const tip = document.querySelector('.stage-tip');
            return { shown: Boolean(tip && !tip.hidden && tip.classList.contains('is-on') && tip.textContent.trim()), title: operation?.getAttribute('title'), savedTitle: operation?.dataset.tipTitle || '' };
          }, candidate.id);
          if (!result.shown || result.title !== null || (candidate.hadTitle && !result.savedTitle)) missing.push({ ...candidate, ...result });
          await locator.evaluate((operation) => {
            const target = operation.matches('label')
              ? operation.querySelector('input, button, a, [tabindex]')
              : operation;
            target?.blur();
          });
          if (!focused) await locator.dispatchEvent('pointerout', { pointerType: 'mouse', bubbles: true });
        }
        const ordinaryTextButton = page.locator('#stage-feedback-open');
        if (await ordinaryTextButton.isVisible()) {
          await page.mouse.move(1, 1);
          await page.waitForTimeout(25);
          await ordinaryTextButton.hover({ force: true });
          await page.waitForTimeout(25);
          assert.equal(await page.locator('.stage-tip.is-on').count(), 0, `${engine}: 文字ボタンに吹き出しが出ました`);
        }
        assert.deepEqual(missing, [], `${engine}: 吹き出し未対応`);
        assert.deepEqual(errors, [], `${engine}: pageerror`);
        summary.push({ engine, scene: 'A-1', candidates: candidates.length, missing: missing.length });
        await page.close();
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(JSON.stringify(summary, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
