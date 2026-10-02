const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { createRequire } = require("node:module");

const root = path.resolve(__dirname, "..");
const requireRegression = createRequire(path.join(root, "tests/regression/package.json"));
const { chromium, webkit } = requireRegression("playwright");

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const relative = pathname === "/" ? "stage.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(root, relative);
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404).end("not found"); return;
  }
  response.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(response);
});

function listen() {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

async function canvasPoint(page, selector, u, v) {
  return page.evaluate(({ selector, u, v }) => {
    const doc = JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project;
    const venue = SHOSAI_VENUES.byId(doc.venue);
    const size = { ...SHOSAI_VENUES.sizeById(venue, doc.venueSize), ...doc.venueDims };
    const fit = SHOSAI_STAGE_PLAN_FIT.rect({ W: 1280, H: 720, venue, size });
    const matrix = window.__planMatrix;
    const canvas = document.querySelector(selector);
    const rect = canvas.getBoundingClientRect();
    const px = matrix.a * (fit.x + u * fit.w) + matrix.e;
    const py = matrix.d * (fit.y + v * fit.h) + matrix.f;
    return { x: rect.x + px * rect.width / canvas.width, y: rect.y + py * rect.height / canvas.height };
  }, { selector, u, v });
}

(async () => {
  const port = await listen();
  const results = [];
  try {
    for (const [name, engine] of [["Chromium", chromium], ["WebKit", webkit]]) {
      const browser = await engine.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, locale: "ja-JP" });
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("dialog", (dialog) => dialog.accept());
      await page.addInitScript(() => {
        localStorage.setItem("gamma:shosai-stage-tour-v1", "done");
        localStorage.setItem("gamma:shosai-stage-lang", "ja");
        const original = CanvasRenderingContext2D.prototype.setTransform;
        CanvasRenderingContext2D.prototype.setTransform = function (...args) {
          const values = args.length === 1
            ? [args[0].a, args[0].b, args[0].c, args[0].d, args[0].e, args[0].f] : args;
          if (this.canvas && this.canvas.id === "stage-plan-canvas" && values.length >= 6) {
            window.__planMatrix = { a: values[0], b: values[1], c: values[2], d: values[3], e: values[4], f: values[5] };
          }
          return original.apply(this, args);
        };
      });
      await page.goto(`http://127.0.0.1:${port}/stage.html?feature-test`);
      await page.waitForFunction(() => window.SHOSAI_STAGE_SESSION_BRIDGE
        && JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id === "gamma-feature-test-v31");
      await page.evaluate(() => {
        GAMMA_WORKSPACE.normal();
        SHOSAI_STAGE_SESSION_BRIDGE.openSceneById("ft-scene-c2");
      });
      const canvas = page.locator("#stage-plan-canvas");
      await canvas.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      assert.equal(await canvas.evaluate((node) => getComputedStyle(node).cursor), "grab");

      const beforePan = await page.evaluate(() => ({ ...window.__planMatrix }));
      const rect = await canvas.boundingBox();
      await page.mouse.move(rect.x + 18, rect.y + 18);
      await page.mouse.down();
      await page.mouse.move(rect.x + 98, rect.y + 68, { steps: 6 });
      await page.mouse.up();
      const afterDrag = await page.evaluate(() => ({ ...window.__planMatrix }));
      assert.ok(Math.abs(afterDrag.e - beforePan.e) > 10 || Math.abs(afterDrag.f - beforePan.f) > 10,
        "空き地の通常ドラッグで描画原点が動く");

      await canvas.dispatchEvent("wheel", { deltaX: -55, deltaY: 35 });
      await page.waitForTimeout(80);
      const afterWheel = await page.evaluate(() => ({ ...window.__planMatrix }));
      assert.notDeepEqual(afterWheel, afterDrag, "修飾なしホイールで平面図が動く");

      await page.locator("#stage-plan-zoom").click();
      const baseScale = await page.evaluate(() => window.__planMatrix.a);
      const b = await canvasPoint(page, "#stage-plan-canvas", 0.18, 0.98);
      await page.keyboard.down("Shift");
      const marqueeStart = { x: rect.x + 6, y: rect.y + 6 };
      await page.mouse.move(marqueeStart.x, marqueeStart.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 8 });
      await page.mouse.up();
      await page.keyboard.up("Shift");
      await page.waitForTimeout(100);
      const marqueeStatus = await page.locator("#stage-multi-select-status").textContent();
      assert.match(marqueeStatus, /([2-9]|[1-9][0-9]+)件選択中/,
        "Shift＋ドラッグで複数の駒を囲い選択する");

      for (let i = 0; i < 4; i += 1) await page.locator("#stage-plan-zoom-out").click();
      const overview = await page.evaluate(() => {
        const doc = JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project;
        const venue = SHOSAI_VENUES.byId(doc.venue);
        const size = { ...SHOSAI_VENUES.sizeById(venue, doc.venueSize), ...doc.venueDims };
        const all = SHOSAI_STAGE_PLAN_FIT.rect({ W: 1280, H: 720, venue, size, mode: "all" });
        const m = window.__planMatrix;
        return {
          matrix: m,
          all: { left: m.a * all.x + m.e, top: m.d * all.y + m.f,
            right: m.a * (all.x + all.w) + m.e, bottom: m.d * (all.y + all.h) + m.f },
          canvasWidth: document.querySelector("#stage-plan-canvas").width,
          canvasHeight: document.querySelector("#stage-plan-canvas").height,
          width: document.querySelector("#stage-plan-canvas").getBoundingClientRect().width,
        };
      });
      assert.ok(overview.matrix.a / baseScale >= 0.399 && overview.matrix.a / baseScale <= 0.401, "最小0.4倍まで縮小できる");
      assert.ok(overview.all.left >= 0 && overview.all.top >= 0
        && overview.all.right <= overview.canvasWidth && overview.all.bottom <= overview.canvasHeight,
      `縮小時に客席を含む全部入り範囲が見える: ${JSON.stringify(overview.all)}`);
      assert.deepEqual(errors, []);
      results.push({ browser: name, cssWidth: Math.round(overview.width), pan: afterDrag, zoom: overview.matrix.a / baseScale });
      await browser.close();
    }
  } finally {
    server.close();
  }
  console.log(JSON.stringify(results));
})().catch((error) => { console.error(error); server.close(); process.exit(1); });
