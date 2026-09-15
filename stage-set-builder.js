(function () {
  "use strict";

  const STORAGE_KEY = "gamma:shosai-stage-models-v1";
  const API = () => window.SHOSAI_STAGE_MODELS;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const tm = (group, id, ja) => {
    const lang = document.documentElement.lang || "ja";
    if (lang === "ja") return ja;
    const packs = window.SHOSAI_I18N_PACKS || {};
    return (packs[lang] && packs[lang].maps && packs[lang].maps[group] && packs[lang].maps[group][id])
      || (packs.en && packs.en.maps && packs.en.maps[group] && packs.en.maps[group][id])
      || ja;
  };
  const t = (value) => tm("setBuilder", value, value);

  let library = { version: 1, models: [] };
  let modelId = null;
  let partId = null;
  let elements = null;
  let saveTimer = 0;
  let view = { yaw: -35, pitch: 28, zoom: 78 };
  let drag = null;

  function loadLibrary() {
    try {
      const parsed = API().parseLibrary(localStorage.getItem(STORAGE_KEY) || "");
      library = parsed || { version: 1, models: [] };
    } catch (_) {
      library = { version: 1, models: [] };
    }
    if (!library.models.length) library.models.push(API().emptyModel(t("新しいセット")));
    modelId = library.models[0].id;
    partId = library.models[0].parts[0] && library.models[0].parts[0].id || null;
  }

  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    try { localStorage.setItem(STORAGE_KEY, API().serializeLibrary(library)); } catch (_) { /* 保存不能でも編集は続ける */ }
    window.dispatchEvent(new CustomEvent("shosai-stage-models-change"));
  }

  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveNow, 120);
  }

  function selectedModel() {
    return library.models.find((model) => model.id === modelId) || null;
  }

  function selectedPart() {
    const model = selectedModel();
    return model && model.parts.find((part) => part.id === partId) || null;
  }

  function touchModel() {
    const model = selectedModel();
    if (model) model.updatedAt = new Date().toISOString();
    saveSoon();
  }

  function button(label, className, onClick) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = className || "";
    node.textContent = t(label);
    node.addEventListener("click", onClick);
    return node;
  }

  function ensureDom() {
    if (elements) return elements;
    const root = document.createElement("div");
    root.className = "stage-model-builder";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");

    const head = document.createElement("header");
    head.className = "stage-model-builder-head";
    const title = document.createElement("h2");
    title.textContent = t("セットビルダー");
    const closeButton = button("閉じる", "stage-model-builder-close", close);
    head.append(title, closeButton);

    const body = document.createElement("div");
    body.className = "stage-model-builder-body";
    const left = document.createElement("section");
    left.className = "stage-model-builder-side is-left";
    const leftTitle = document.createElement("h3"); leftTitle.textContent = t("モデル");
    const modelList = document.createElement("div"); modelList.className = "stage-model-list";
    const modelActions = document.createElement("div"); modelActions.className = "stage-model-actions";
    modelActions.append(
      button("新規", "", addModel), button("複製", "", duplicateModel),
      button("名前変更", "", renameModel), button("削除", "is-danger", removeModel)
    );
    const noteLabel = document.createElement("label"); noteLabel.textContent = t("覚え書き");
    const note = document.createElement("textarea"); note.rows = 3; note.maxLength = 500;
    note.addEventListener("input", () => {
      const model = selectedModel(); if (!model) return;
      model.note = note.value.slice(0, 500); touchModel();
    });
    const transfer = document.createElement("div"); transfer.className = "stage-model-actions stage-model-transfer";
    const file = document.createElement("input"); file.type = "file"; file.accept = ".json,application/json"; file.hidden = true;
    file.addEventListener("change", importLibrary);
    transfer.append(button("JSONで書き出す", "", exportLibrary), button("読み込む", "", () => file.click()), file);
    left.append(leftTitle, modelList, modelActions, noteLabel, note, transfer);

    const center = document.createElement("section"); center.className = "stage-model-builder-preview";
    const previewTitle = document.createElement("h3"); previewTitle.textContent = t("プレビュー");
    const canvas = document.createElement("canvas"); canvas.width = 900; canvas.height = 700;
    canvas.addEventListener("pointerdown", beginViewDrag);
    canvas.addEventListener("pointermove", moveViewDrag);
    canvas.addEventListener("pointerup", endViewDrag);
    canvas.addEventListener("pointercancel", endViewDrag);
    canvas.addEventListener("wheel", zoomView, { passive: false });
    center.append(previewTitle, canvas);

    const right = document.createElement("section"); right.className = "stage-model-builder-side is-right";
    const rightTitle = document.createElement("h3"); rightTitle.textContent = t("部品");
    const partList = document.createElement("div"); partList.className = "stage-model-part-list";
    const partActions = document.createElement("div"); partActions.className = "stage-model-actions";
    partActions.append(button("追加", "", addPart), button("複製", "", duplicatePart),
      button("削除", "is-danger", removePart), button("上へ", "", () => movePart(-1)),
      button("下へ", "", () => movePart(1)));
    const controls = document.createElement("div"); controls.className = "stage-model-controls";
    right.append(rightTitle, partList, partActions, controls);

    body.append(left, center, right);
    root.append(head, body);
    document.body.append(root);
    elements = { root, title, closeButton, modelList, note, file, previewTitle, canvas, partList, controls };
    return elements;
  }

  function renderAll() {
    if (!elements) return;
    renderModels(); renderParts(); renderControls(); drawPreview();
  }

  function renderModels() {
    elements.modelList.innerHTML = "";
    library.models.forEach((model) => {
      const row = button(model.name, model.id === modelId ? "is-selected" : "", () => {
        modelId = model.id; partId = model.parts[0] && model.parts[0].id || null; renderAll();
      });
      row.title = model.note || model.name;
      elements.modelList.append(row);
    });
    const model = selectedModel();
    elements.note.value = model ? model.note : "";
  }

  function renderParts() {
    elements.partList.innerHTML = "";
    const model = selectedModel();
    (model && model.parts || []).forEach((part, index) => {
      const fallback = t(({ box: "箱", panel: "パネル", cylinder: "円柱", sphere: "球", step: "階段", ramp: "斜面" }[part.shape]));
      const row = button(`${index + 1}. ${part.name || fallback}`, part.id === partId ? "is-selected" : "", () => {
        partId = part.id; renderParts(); renderControls(); drawPreview();
      });
      elements.partList.append(row);
    });
  }

  function field(label, key, options) {
    const part = selectedPart();
    const wrap = document.createElement("label");
    const text = document.createElement("span"); text.textContent = t(label);
    const input = document.createElement("input"); input.type = "number";
    input.min = String(options.min); input.max = String(options.max); input.step = String(options.step);
    input.value = String(options.cm ? Math.round(part[key] * 1000) / 10 : part[key]);
    input.addEventListener("input", () => {
      const value = finite(input.value, options.cm ? part[key] * 100 : part[key]);
      part[key] = options.cm ? value / 100 : value;
      Object.assign(part, API().normalizePart(part));
      touchModel(); renderParts(); drawPreview();
    });
    wrap.append(text, input);
    if (options.suffix) { const suffix = document.createElement("i"); suffix.textContent = options.suffix; wrap.append(suffix); }
    elements.controls.append(wrap);
  }

  function renderControls() {
    elements.controls.innerHTML = "";
    const part = selectedPart();
    if (!part) { elements.controls.textContent = t("選択した部品はありません"); return; }
    const nameLabel = document.createElement("label");
    const nameText = document.createElement("span"); nameText.textContent = t("名前");
    const name = document.createElement("input"); name.type = "text"; name.maxLength = 24; name.value = part.name;
    name.autocomplete = "off"; name.setAttribute("data-1p-ignore", "true");
    name.addEventListener("input", () => { part.name = name.value.slice(0, 24); touchModel(); renderParts(); });
    nameLabel.append(nameText, name); elements.controls.append(nameLabel);
    const shapeLabel = document.createElement("label");
    const shapeText = document.createElement("span"); shapeText.textContent = t("種類");
    const shape = document.createElement("select");
    [["box", "box"], ["panel", "panel"], ["cylinder", "cylinder"], ["sphere", "sphere"], ["step", "step"], ["ramp", "ramp"]]
      .forEach(([value, label]) => { const option = document.createElement("option"); option.value = value; option.textContent = label; shape.append(option); });
    shape.value = part.shape;
    shape.addEventListener("change", () => {
      const was = part.shape; part.shape = shape.value;
      if (shape.value === "panel" && was !== "panel" && part.d === 1) part.d = 0.05;
      Object.assign(part, API().normalizePart(part)); touchModel(); renderParts(); renderControls(); drawPreview();
    });
    shapeLabel.append(shapeText, shape); elements.controls.append(shapeLabel);
    const positionTitle = document.createElement("h4"); positionTitle.textContent = t("位置"); elements.controls.append(positionTitle);
    field("x", "x", { min: -3000, max: 3000, step: 1, cm: true, suffix: "cm" });
    field("y", "y", { min: 0, max: 3000, step: 1, cm: true, suffix: "cm" });
    field("z", "z", { min: -3000, max: 3000, step: 1, cm: true, suffix: "cm" });
    const dimensionTitle = document.createElement("h4"); dimensionTitle.textContent = t("寸法"); elements.controls.append(dimensionTitle);
    if (part.shape === "cylinder" || part.shape === "sphere") field("直径", "dia", { min: 1, max: 3000, step: 1, cm: true, suffix: "cm" });
    if (part.shape !== "sphere") field("高さ", "h", { min: 1, max: 3000, step: 1, cm: true, suffix: "cm" });
    if (!["cylinder", "sphere"].includes(part.shape)) {
      field("幅", "w", { min: 1, max: 3000, step: 1, cm: true, suffix: "cm" });
      field("奥行き", "d", { min: 1, max: 3000, step: 1, cm: true, suffix: "cm" });
    }
    field("回転", "rotY", { min: -180, max: 180, step: 1, suffix: "°" });
    if (part.shape === "step") field("段数", "steps", { min: 2, max: 12, step: 1 });
    field("明暗", "tint", { min: 0.5, max: 1.2, step: 0.05 });
  }

  function addModel() {
    const model = API().emptyModel(t("新しいセット"));
    library.models.push(model); modelId = model.id; partId = model.parts[0].id; saveNow(); renderAll();
  }

  function duplicateModel() {
    const source = selectedModel(); if (!source) return;
    const copy = API().normalizeModel({ ...source, id: uid("model"), name: `${source.name}${t("の複製")}`,
      updatedAt: new Date().toISOString(), parts: source.parts.map((part) => ({ ...part, id: uid("part") })) });
    library.models.push(copy); modelId = copy.id; partId = copy.parts[0] && copy.parts[0].id || null; saveNow(); renderAll();
  }

  function renameModel() {
    const model = selectedModel(); if (!model) return;
    const value = window.prompt(t("モデル名"), model.name);
    if (value === null || !value.trim()) return;
    model.name = value.trim().slice(0, 24); touchModel(); renderModels();
  }

  function removeModel() {
    const model = selectedModel(); if (!model || !window.confirm(t("このモデルを削除しますか？"))) return;
    library.models = library.models.filter((item) => item.id !== model.id);
    const next = library.models[0] || null; modelId = next && next.id; partId = next && next.parts[0] && next.parts[0].id || null;
    saveNow(); renderAll();
  }

  function addPart() {
    const model = selectedModel(); if (!model || model.parts.length >= 64) return;
    const part = API().normalizePart({ id: uid("part"), shape: "box" });
    model.parts.push(part); partId = part.id; touchModel(); renderAll();
  }

  function duplicatePart() {
    const model = selectedModel(); const part = selectedPart();
    if (!model || !part || model.parts.length >= 64) return;
    const copy = API().normalizePart({ ...part, id: uid("part"), x: part.x + 0.1, z: part.z + 0.1 });
    model.parts.push(copy); partId = copy.id; touchModel(); renderAll();
  }

  function removePart() {
    const model = selectedModel(); const part = selectedPart();
    if (!model || !part || !window.confirm(t("部品を削除しますか？"))) return;
    const at = model.parts.indexOf(part); model.parts.splice(at, 1);
    partId = model.parts[Math.min(at, model.parts.length - 1)] && model.parts[Math.min(at, model.parts.length - 1)].id || null;
    touchModel(); renderAll();
  }

  function movePart(direction) {
    const model = selectedModel(); const part = selectedPart(); if (!model || !part) return;
    const at = model.parts.indexOf(part); const next = clamp(at + direction, 0, model.parts.length - 1);
    if (at === next) return;
    model.parts.splice(at, 1); model.parts.splice(next, 0, part); touchModel(); renderParts();
  }

  function exportLibrary() {
    try {
      const blob = new Blob([API().serializeLibrary(library)], { type: "application/json" });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
      link.download = "shosai-stage-models.json"; document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (error) {
      console.error("set builder export: 書き出せませんでした", error);
      window.alert(t("セットモデルを書き出せませんでした。もう一度お試しください。"));
    }
  }

  async function importLibrary(event) {
    const file = event.target.files && event.target.files[0]; event.target.value = ""; if (!file) return;
    const parsed = API().parseLibrary(await file.text());
    if (!parsed || !parsed.models.length) { window.alert(t("読み込めるセットモデルがありません。")); return; }
    const imported = parsed.models.map((model) => API().normalizeModel({ ...model, id: uid("model"),
      updatedAt: new Date().toISOString(), parts: model.parts.map((part) => ({ ...part, id: uid("part") })) }));
    library.models.push(...imported); modelId = imported[0].id; partId = imported[0].parts[0] && imported[0].parts[0].id || null;
    saveNow(); renderAll();
  }

  function project(point, width, height) {
    const yaw = view.yaw * Math.PI / 180; const pitch = view.pitch * Math.PI / 180;
    const x1 = point.x * Math.cos(yaw) - point.z * Math.sin(yaw);
    const z1 = point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
    return { x: width / 2 + x1 * view.zoom, y: height * 0.62 - (point.y * Math.cos(pitch) - z1 * Math.sin(pitch)) * view.zoom,
      depth: point.y * Math.sin(pitch) + z1 * Math.cos(pitch) };
  }

  function boxFaces(box, index) {
    const angle = box.rotY * Math.PI / 180; const cos = Math.cos(angle); const sin = Math.sin(angle);
    const corner = (sx, sy, sz) => ({ x: box.ox + sx * box.w / 2 * cos - sz * box.d / 2 * sin,
      y: box.lift + sy * box.h, z: box.oz + sx * box.w / 2 * sin + sz * box.d / 2 * cos });
    const points = [corner(-1, 0, -1), corner(1, 0, -1), corner(1, 0, 1), corner(-1, 0, 1),
      corner(-1, 1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(-1, 1, 1)];
    return [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7]].map((ids, face) => ({
      points: ids.map((id) => points[id]), tint: box.tint, selected: index === selectedBoxIndex(), face,
    }));
  }

  function selectedBoxIndex() {
    const model = selectedModel(); if (!model) return -1;
    let index = 0;
    for (const part of model.parts) {
      if (part.id === partId) return index;
      index += API().partBoxes(part).length;
    }
    return -1;
  }

  function drawPreview() {
    if (!elements) return;
    const canvas = elements.canvas; const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1; const width = Math.max(320, rect.width || 900); const height = Math.max(300, rect.height || 700);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    }
    const ctx = canvas.getContext("2d"); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#171411"; ctx.fillRect(0, 0, width, height);
    const line = (a, b, color, lineWidth = 1) => { const p = project(a, width, height); const q = project(b, width, height);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.stroke(); };
    for (let grid = -5; grid <= 5; grid += 1) {
      line({ x: grid, y: 0, z: -5 }, { x: grid, y: 0, z: 5 }, grid === 0 ? "rgba(232,226,212,.32)" : "rgba(232,226,212,.13)");
      line({ x: -5, y: 0, z: grid }, { x: 5, y: 0, z: grid }, grid === 0 ? "rgba(232,226,212,.32)" : "rgba(232,226,212,.13)");
    }
    const model = selectedModel(); const boxes = model ? API().modelBoxes(model) : [];
    const faces = boxes.flatMap((box, index) => boxFaces(box, index)).map((face) => {
      const points = face.points.map((point) => project(point, width, height));
      return { ...face, points, depth: points.reduce((sum, point) => sum + point.depth, 0) / points.length };
    }).sort((a, b) => a.depth - b.depth);
    faces.forEach((face) => {
      ctx.beginPath(); face.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.closePath();
      const alpha = clamp((face.face === 4 ? 0.76 : face.face % 2 ? 0.48 : 0.58) * face.tint, 0.18, 0.96);
      ctx.fillStyle = `rgba(151,126,93,${alpha})`; ctx.fill();
      ctx.strokeStyle = face.selected ? "#fff0a8" : "rgba(235,224,202,.35)"; ctx.lineWidth = face.selected ? 2.5 : 1; ctx.stroke();
    });
    // 1.65mの人。モデル原点の横へ置き、頭・胴・手足の輪郭だけで尺度を示す。
    const humanX = -1.2; const head = project({ x: humanX, y: 1.55, z: 0 }, width, height);
    ctx.beginPath(); ctx.arc(head.x, head.y, Math.max(4, view.zoom * .1), 0, Math.PI * 2); ctx.strokeStyle = "rgba(232,226,212,.82)"; ctx.lineWidth = 2; ctx.stroke();
    line({ x: humanX, y: 1.45, z: 0 }, { x: humanX, y: .72, z: 0 }, "rgba(232,226,212,.82)", 2);
    line({ x: humanX, y: 1.25, z: 0 }, { x: humanX - .35, y: .88, z: 0 }, "rgba(232,226,212,.82)", 2);
    line({ x: humanX, y: 1.25, z: 0 }, { x: humanX + .35, y: .88, z: 0 }, "rgba(232,226,212,.82)", 2);
    line({ x: humanX, y: .72, z: 0 }, { x: humanX - .2, y: 0, z: 0 }, "rgba(232,226,212,.82)", 2);
    line({ x: humanX, y: .72, z: 0 }, { x: humanX + .2, y: 0, z: 0 }, "rgba(232,226,212,.82)", 2);
    ctx.fillStyle = "rgba(232,226,212,.72)"; ctx.font = "12px sans-serif"; const label = project({ x: humanX, y: 1.8, z: 0 }, width, height);
    ctx.fillText("1.65m", label.x - 18, label.y);
  }

  function beginViewDrag(event) { drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: view.yaw, pitch: view.pitch };
    elements.canvas.setPointerCapture && elements.canvas.setPointerCapture(event.pointerId); }
  function moveViewDrag(event) { if (!drag || drag.id !== event.pointerId) return;
    view.yaw = drag.yaw + (event.clientX - drag.x) * 0.45; view.pitch = clamp(drag.pitch - (event.clientY - drag.y) * 0.35, 8, 78); drawPreview(); }
  function endViewDrag(event) { if (drag && drag.id === event.pointerId) drag = null; }
  function zoomView(event) { event.preventDefault(); view.zoom = clamp(view.zoom * (event.deltaY > 0 ? 0.9 : 1.1), 24, 220); drawPreview(); }

  function open() {
    if (!API()) return false;
    ensureDom(); loadLibrary();
    elements.title.textContent = t("セットビルダー"); elements.closeButton.textContent = t("閉じる");
    elements.previewTitle.textContent = t("プレビュー"); elements.root.hidden = false; renderAll();
    window.addEventListener("keydown", onKeyDown, true); window.addEventListener("resize", drawPreview); return true;
  }

  function close() {
    if (!elements || elements.root.hidden) return;
    saveNow(); elements.root.hidden = true; drag = null;
    window.removeEventListener("keydown", onKeyDown, true); window.removeEventListener("resize", drawPreview);
  }

  function onKeyDown(event) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key === "Delete" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement && document.activeElement.tagName)) {
      event.preventDefault(); removePart();
    }
  }

  window.SHOSAI_STAGE_BUILDER = Object.freeze({ open, close });
})();
