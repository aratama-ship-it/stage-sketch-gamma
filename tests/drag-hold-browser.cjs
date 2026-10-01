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
const listen = () => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));

async function project(page) {
  return page.evaluate(() => JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project);
}

async function planPoint(page, u, v) {
  return page.evaluate(({ u, v }) => {
    const doc = JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project;
    const venue = SHOSAI_VENUES.byId(doc.venue);
    const size = { ...SHOSAI_VENUES.sizeById(venue, doc.venueSize), ...doc.venueDims };
    const fit = SHOSAI_STAGE_PLAN_FIT.rect({ W: 1280, H: 720, venue, size });
    const canvas = document.querySelector("#stage-plan-canvas");
    const rect = canvas.getBoundingClientRect();
    const m = window.__planMatrix;
    return {
      x: rect.x + (m.a * (fit.x + u * fit.w) + m.e) * rect.width / canvas.width,
      y: rect.y + (m.d * (fit.y + v * fit.h) + m.f) * rect.height / canvas.height,
    };
  }, { u, v });
}

async function pieceBy(page, key) {
  const doc = await project(page);
  const scene = doc.scenes.find((row) => row.id === "ft-scene-c2");
  return scene.pieces.find((piece) => piece.id === key || piece.setId === key || piece.castId === key);
}

async function dragPlan(page, key, u, v, expectPreview = false) {
  const piece = await pieceBy(page, key);
  const anchor = await planPoint(page, piece.u, piece.v);
  const target = await planPoint(page, u, v);
  await page.evaluate(() => { delete window.__selectionBoxes["stage-plan-canvas"]; });
  await page.mouse.click(anchor.x, anchor.y);
  await page.waitForTimeout(50);
  const selected = await page.evaluate(() => {
    const canvas = document.querySelector("#stage-plan-canvas");
    return { box: window.__selectionBoxes["stage-plan-canvas"], rect: canvas.getBoundingClientRect().toJSON(), width: canvas.width, height: canvas.height };
  });
  const from = selected.box ? {
    x: selected.rect.x + (selected.box.x + selected.box.w / 2) * selected.rect.width / selected.width,
    y: selected.rect.y + (selected.box.y + selected.box.h / 2) * selected.rect.height / selected.height,
  } : anchor;
  const to = { x: from.x + target.x - anchor.x, y: from.y + target.y - anchor.y };
  const rings = await page.evaluate(() => window.__holdRings);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  if (expectPreview) assert.ok(await page.evaluate(() => window.__holdRings) > rings, "離す前に手元の輪が描かれる");
}

async function undo(page) {
  await page.locator("#stage-undo").click();
  await page.waitForTimeout(100);
}

async function dragSelectedPlan(page, key, u, v) {
  const piece = await pieceBy(page, key);
  const anchor = await planPoint(page, piece.u, piece.v);
  const target = await planPoint(page, u, v);
  const selected = await page.evaluate(() => {
    const canvas = document.querySelector("#stage-plan-canvas");
    return { box: window.__selectionBoxes["stage-plan-canvas"], rect: canvas.getBoundingClientRect().toJSON(), width: canvas.width, height: canvas.height };
  });
  assert.ok(selected.box, `${key} の選択枠を保ったまま外す`);
  const from = {
    x: selected.rect.x + (selected.box.x + selected.box.w / 2) * selected.rect.width / selected.width,
    y: selected.rect.y + (selected.box.y + selected.box.h / 2) * selected.rect.height / selected.height,
  };
  const to = { x: from.x + target.x - anchor.x, y: from.y + target.y - anchor.y };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}

async function frontFloorPoint(page, u, v) {
  return page.evaluate(({ u, v }) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280; canvas.height = 720;
    return SHOSAI_STAGE_VIEW.renderFront(canvas.getContext("2d"), { hideLightPieces: true }).point(u, v, 0);
  }, { u, v });
}

async function dragFront(page, key, targetU, targetV, expectPreview = false) {
  const piece = await pieceBy(page, key);
  const fromFloor = await frontFloorPoint(page, piece.u, piece.v);
  const toFloor = await frontFloorPoint(page, targetU, targetV);
  const data = await page.evaluate(() => {
    const canvas = document.querySelector("#stage-canvas");
    return { rect: canvas.getBoundingClientRect().toJSON() };
  });
  const start = {
    x: data.rect.x + fromFloor.x * data.rect.width / 1280,
    y: data.rect.y + fromFloor.y * data.rect.height / 720 - 5,
  };
  const end = {
    x: start.x + (toFloor.x - fromFloor.x) * data.rect.width / 1280,
    y: start.y + (toFloor.y - fromFloor.y) * data.rect.height / 720,
  };
  const rings = await page.evaluate(() => window.__holdRings);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  if (expectPreview) assert.ok(await page.evaluate(() => window.__holdRings) > rings, "正面図でも手元の輪が描かれる");
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
        window.__selectionBoxes = {};
        window.__holdRings = 0;
        const proto = CanvasRenderingContext2D.prototype;
        const setTransform = proto.setTransform;
        proto.setTransform = function (...args) {
          const values = args.length === 1
            ? [args[0].a, args[0].b, args[0].c, args[0].d, args[0].e, args[0].f] : args;
          if (this.canvas && this.canvas.id === "stage-plan-canvas" && values.length >= 6) {
            window.__planMatrix = { a: values[0], b: values[1], c: values[2], d: values[3], e: values[4], f: values[5] };
          }
          return setTransform.apply(this, args);
        };
        const strokeRect = proto.strokeRect;
        proto.strokeRect = function (x, y, w, h) {
          if (this.canvas && this.canvas.id && this.getLineDash().join(",") === "8,7") {
            const m = this.getTransform();
            window.__selectionBoxes[this.canvas.id] = { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f, w: w * m.a, h: h * m.d };
          }
          return strokeRect.call(this, x, y, w, h);
        };
        const arc = proto.arc;
        proto.arc = function (x, y, radius, ...rest) {
          if (radius === 15 && this.shadowBlur === 10) window.__holdRings += 1;
          return arc.call(this, x, y, radius, ...rest);
        };
      });
      await page.goto(`http://127.0.0.1:${port}/stage.html?feature-test`);
      await page.waitForFunction(() => window.SHOSAI_STAGE_SESSION_BRIDGE
        && JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id === "gamma-feature-test-v28");
      await page.evaluate(() => { GAMMA_WORKSPACE.normal(); SHOSAI_STAGE_SESSION_BRIDGE.openSceneById("ft-scene-c2"); });
      await page.locator("#stage-plan-canvas").scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);

      const p04 = await pieceBy(page, "ft-cast-p04");
      await dragPlan(page, "ft-set-instrument-guitar", p04.u - 0.03, p04.v, true);
      let guitar = await pieceBy(page, "ft-set-instrument-guitar");
      assert.equal(guitar.heldBy, p04.id, "複数人のいる C-2 で最寄りの演者04が持つ");
      assert.equal(guitar.holdSide, "L", "離した側の左手を優先する");
      await dragSelectedPlan(page, "ft-set-instrument-guitar", p04.u - 0.15, p04.v);
      guitar = await pieceBy(page, "ft-set-instrument-guitar");
      assert.equal(guitar.heldBy, null, "0.9mより離して持ち物を置く");
      await undo(page);
      guitar = await pieceBy(page, "ft-set-instrument-guitar");
      assert.equal(guitar.heldBy, p04.id, "外す操作を1回で元の持ち手へ戻す");
      await undo(page);
      guitar = await pieceBy(page, "ft-set-instrument-guitar");
      assert.equal(guitar.heldBy, null, "持たせる操作を1回で取り消す");

      await dragPlan(page, "ft-set-prop-box", 0.45, 0.20, false);
      const farBox = await pieceBy(page, "ft-set-prop-box");
      assert.equal(farBox.heldBy, null, "遠い位置では持たせない");
      assert.ok(Math.abs(farBox.u - 0.45) < 0.03 && Math.abs(farBox.v - 0.20) < 0.03,
        "遠い位置まで実際にドラッグする");
      await undo(page);

      await page.locator("#stage-plan-zoom-in").click();
      await dragPlan(page, "ft-set-instrument-guitar", p04.u + 0.03, p04.v, true);
      guitar = await pieceBy(page, "ft-set-instrument-guitar");
      assert.equal(guitar.heldBy, p04.id, "拡大中も世界座標で持たせる");
      assert.equal(guitar.holdSide, "R", "拡大中も離した側の右手を優先する");
      await undo(page);
      await page.locator("#stage-plan-zoom").click();

      const p01 = await pieceBy(page, "ft-cast-p01");
      await dragPlan(page, "ft-set-prop-box", p01.u - 0.03, p01.v, true);
      assert.equal((await pieceBy(page, "ft-set-prop-box")).heldBy, p01.id, "空いている左手で箱を持つ");
      await dragPlan(page, "ft-set-instrument-guitar", p01.u + 0.03, p01.v, true);
      assert.equal((await pieceBy(page, "ft-set-instrument-guitar")).heldBy, null, "両手がふさがった演者には持たせない");
      await undo(page);
      await undo(page);

      guitar = await pieceBy(page, "ft-set-instrument-guitar");
      await dragFront(page, "ft-set-instrument-guitar", p04.u + 0.03, guitar.v, false);
      guitar = await pieceBy(page, "ft-set-instrument-guitar");
      assert.equal(guitar.heldBy, null, "正面図で左右が近くても奥行きが違えば持たせない");
      assert.ok(Math.hypot((guitar.u - 0.12) * 12, (guitar.v - 0.83) * 9) > 0.1,
        "正面図でも小道具を実際にドラッグする");
      await undo(page);
      await dragFront(page, "ft-set-instrument-guitar", p04.u + 0.03, p04.v, true);
      assert.equal((await pieceBy(page, "ft-set-instrument-guitar")).heldBy, p04.id, "正面図で左右・奥行きが近い演者へ持たせる");
      await undo(page);

      assert.deepEqual(errors, []);
      const width = await page.locator("#stage-plan-canvas").evaluate((node) => Math.round(node.getBoundingClientRect().width));
      results.push({ browser: name, cssWidth: width, scene: "C-2", attachM: 0.6, detachM: 0.9 });
      await browser.close();
    }
  } finally {
    server.close();
  }
  console.log(JSON.stringify(results));
})().catch((error) => { console.error(error); server.close(); process.exit(1); });
