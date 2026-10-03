"use strict";
// Independent projection: never mutates editor data, source rows, or saved profiles.
window.ROSPages = (() => {
  const LIMIT = 200;
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const clone = node => {
    const copy = node.cloneNode(true);
    for (const el of [copy, ...copy.querySelectorAll("[id]")]) el.removeAttribute("id");
    return copy;
  };
  function sliceNode(node, start, end) {
    if (start === 0 && end === node.textContent.length) return clone(node);
    const copy = node.cloneNode(false), walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const points = []; let text, offset = 0;
    while ((text = walker.nextNode())) {
      points.push({node: text, start: offset, end: offset + text.length}); offset += text.length;
    }
    const a = points.find(p => start < p.end), b = points.find(p => end <= p.end && end > p.start);
    if (a && b) {
      const range = document.createRange();
      range.setStart(a.node, start - a.start); range.setEnd(b.node, end - b.start);
      copy.append(range.cloneContents());
    }
    return copy;
  }
  function blocks(cell, rowId) {
    return Array.from(cell.childNodes).filter(n => n.nodeType === 1 || n.textContent.length).map((n, i) => {
      const node = n.nodeType === 1 ? clone(n) : make("span", "", n.textContent);
      const text = node.textContent, atomic = node.tagName === "FIGURE";
      const ends = [0];
      if (!atomic) {
        if (typeof Intl.Segmenter === "function") {
          for (const part of new Intl.Segmenter(undefined, {granularity: "grapheme"}).segment(text)) ends.push(part.index + part.segment.length);
        } else { for (const char of text) ends.push(ends.at(-1) + char.length); }
      }
      return {node, text, atomic, ends, start: 0, key: `${rowId}/${cell.dataset.columnId}/${i}`};
    });
  }
  async function render({source, table, mount, portrait, scope, context, isCurrent = () => true}) {
    await document.fonts.ready;
    const images = [...table.querySelectorAll("img")];
    await Promise.all(images.map(async img => {
      try { await img.decode(); } catch { throw new Error("画像を読み込めません。詳細・備考の画像を確認してください。"); }
      if (!img.naturalWidth || !img.naturalHeight) throw new Error("画像の寸法を確認できません。");
    }));
    if (!isCurrent()) return null;
    const columns = Array.from(table.querySelectorAll("thead th")).filter(c => !c.hidden).map(th => ({
      id: th.dataset.columnId, label: th.firstChild.textContent + (th.querySelector("small") ? " / " + th.querySelector("small").textContent : ""), heading: clone(th),
      width: table.querySelectorAll("col")[th.cellIndex].style.width,
      compact: ["no", "start", "duration", "item"].includes(th.dataset.columnId)
    }));
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    const pages = [];
    mount.replaceChildren(); mount.hidden = false; mount.dataset.portrait = String(portrait);
    const weights = columns.map(c => `${parseFloat(c.width)}fr`).join(" ");
    function newPage() {
      if (pages.length >= LIMIT) throw new Error(`200ページを超えます。項目数や長文を見直してください。編集内容は保持しています。`);
      const page = make("article", "output-page"), header = clone(source.querySelector(".paper-header"));
      header.className = "page-heading";
      const intro = make("div", "page-intro"), body = make("div", "page-body"), content = make("div", "page-content");
      if (scope) intro.append(make("p", "", scope));
      if (context) intro.append(make("p", "", context));
      if (!portrait) {
        content.setAttribute("role", "table"); content.setAttribute("aria-label", "進行表");
        const labels = make("div", "pg-labels"); labels.setAttribute("role", "row"); labels.style.gridTemplateColumns = weights;
        for (const col of columns) { const label = make("div", "pg-label"); label.dataset.columnId = col.id; label.setAttribute("role", "columnheader"); label.append(...clone(col.heading).childNodes); labels.append(label); }
        content.append(labels);
      }
      body.append(content);
      const foot = make("footer", "page-footer");
      foot.append(make("span", "", "LX＝照明 · SD＝音響 · VID＝映像 · STG＝舞台（略号）"), make("span", "page-number", "000 / 000"));
      page.append(header, intro, body, foot); mount.append(page);
      const state = {page, body, content, count: 0, number: pages.length + 1}; pages.push(state);
      return state;
    }
    let page = newPage();
    const slack = parseFloat(getComputedStyle(mount).getPropertyValue("--page-fit-slack"));
    const fits = () => page.content.getBoundingClientRect().bottom <= page.body.getBoundingClientRect().bottom - slack;
    function rowShell(rowId, part, firstPage, no) {
      const fragment = make("div", "pg-row"); fragment.dataset.rowId = rowId; fragment.dataset.part = part;
      const cells = new Map();
      if (part > 1) fragment.append(make("div", "pg-continuation", `${no} · 続き ${part} / CONTINUED · 先頭 p.${firstPage}`));
      const grid = make("div", "pg-grid"), summary = make("div", "pg-summary"), fields = make("div", "pg-fields");
      if (!portrait) { grid.style.gridTemplateColumns = weights; grid.setAttribute("role", "row"); fragment.setAttribute("role", "rowgroup"); }
      for (const col of columns) {
        const field = make("div", `pg-cell${col.compact ? " compact" : ""}`); field.dataset.columnId = col.id; if (!portrait) field.setAttribute("role", "cell");
        if (portrait) field.append(make("div", "pg-field-label", col.label));
        const content = make("div", "pg-cell-content"); field.append(content); cells.set(col.id, content);
        (portrait ? (col.compact ? summary : fields) : grid).append(field);
      }
      if (portrait) { if (summary.children.length) grid.append(summary); if (fields.children.length) grid.append(fields); }
      fragment.append(grid); page.content.append(fragment);
      return {fragment, cells};
    }
    function output(block, end = block.text.length) {
      const node = block.atomic ? clone(block.node) : sliceNode(block.node, block.start, end);
      node.classList.add("pg-block"); node.dataset.sourceBlock = block.key;
      node.dataset.sourceStart = block.start; node.dataset.sourceEnd = end;
      // Reserve intrinsic geometry before a cloned image's decode microtask.
      for (const img of node.querySelectorAll("img")) {
        const original = images.find(x => x.src === img.src);
        if (original) { img.width = original.naturalWidth; img.height = original.naturalHeight; }
      }
      return node;
    }
    let continuationCount = 0;
    try {
      for (const [index, row] of rows.entries()) {
        if (!isCurrent()) { mount.replaceChildren(); return null; }
        const id = row.dataset.rowId || `call-${index + 1}`;
        const visible = Array.from(row.cells).filter(c => !c.hidden), no = visible.find(c => ["no", "call"].includes(c.dataset.columnId))?.textContent || String(index + 1);
        const queues = new Map(visible.map(cell => [cell.dataset.columnId, blocks(cell, id)]));
        let part = 1, firstPage = page.number;
        let shell = rowShell(id, part, firstPage, no);
        for (const [colId, queue] of queues) for (const block of queue) shell.cells.get(colId).append(output(block));
        if (fits()) { page.count++; continue; }
        shell.fragment.remove();
        // Keep a short item whole, and start oversized items on a fresh page.
        if (page.count) { page = newPage(); firstPage = page.number; }
        shell = rowShell(id, part, firstPage, no);
        for (const [colId, queue] of queues) for (const block of queue) shell.cells.get(colId).append(output(block));
        if (fits()) { page.count++; continue; }
        shell.fragment.remove();
        while ([...queues.values()].some(q => q.length)) {
          shell = rowShell(id, part, firstPage, no);
          let progress = 0;
          if (part > 1) {
            for (const cell of visible) {
              const colId = cell.dataset.columnId;
              const repeated = ["no", "call", "start", "duration"].includes(colId) || (["trigger", "standby", "go"].includes(colId) && cell.textContent.length <= 120);
              if (repeated && !queues.get(colId).length) {
                const content = shell.cells.get(colId), repeat = make("div", "pg-repeat"); repeat.dataset.repeat = "true";
                repeat.append(...clone(cell).childNodes); content.append(repeat);
                if (!fits()) repeat.remove();
              }
            }
          }
          for (const [colId, queue] of queues) {
            const cell = shell.cells.get(colId);
            while (queue.length) {
              const block = queue[0], candidate = output(block); cell.append(candidate);
              if (fits()) { queue.shift(); progress++; continue; }
              candidate.remove();
              if (block.atomic) break;
              const ends = block.ends.filter(e => e > block.start);
              let low = 0, high = ends.length - 1, best = block.start;
              while (low <= high) {
                const middle = (low + high) >> 1, node = output(block, ends[middle]); cell.append(node);
                if (fits()) { best = ends[middle]; low = middle + 1; } else high = middle - 1;
                node.remove();
              }
              if (best > block.start) {
                // Prefer complete paragraphs. If one paragraph is taller than a page,
                // divide at grapheme boundaries without losing or duplicating bytes.
                const paragraph = block.text.lastIndexOf("\n", best - 1) + 1;
                if (paragraph > block.start) best = paragraph;
                cell.append(output(block, best)); block.start = best; progress++;
              }
              break;
            }
          }
          if (!progress) {
            const colId = [...queues].find(([, q]) => q.length)?.[0];
            const col = columns.find(c => c.id === colId);
            throw new Error(`${no}の「${col?.label || colId}」が1ページに収まりません。画像の説明文などを短くするか、詳細・備考へ分けてください。内容は省略していません。`);
          }
          page.count++;
          if ([...queues.values()].some(q => q.length)) { part++; continuationCount++; page = newPage(); }
        }
        // Let a browser paint between source rows on large documents.
        if (index % 10 === 9) await new Promise(resolve => requestAnimationFrame(resolve));
      }
      if (!isCurrent()) return null;
      pages.forEach((p, index) => {
        p.page.dataset.page = index + 1; p.page.setAttribute("aria-label", `${index + 1} / ${pages.length}ページ`);
        p.page.querySelector(".page-number").textContent = `${index + 1} / ${pages.length}`;
      });
      return {pages: pages.length, continuations: continuationCount};
    } catch (error) { mount.replaceChildren(); throw error; }
  }
  return Object.freeze({render, LIMIT});
})();
