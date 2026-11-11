(function (root) {
  'use strict';
  // Public copies contain only visible cells of one department, never a show document.
  const LIMITS = Object.freeze({ bytes: 98304, rows: 1000, columns: 12, cell: 2000, label: 160, title: 300, version: 80 });
  const FIELDS = Object.freeze({ light: ['scene','cue','time','trigger','memo','on','off','level'], music: ['scene','cue','memo'], dialogue: ['scene','cue','memo'], stage: ['scene','machinery','sets','note','timing'], props: ['scene','props','handoffs'], marks: ['scene','marks'] });
  const fail = () => { throw Object.assign(new Error('invalid-q-sheet'), { status: 400 }); };
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const exact = (value, keys) => { if (!object(value) || Object.keys(value).some(k => !keys.includes(k))) fail(); };
  const string = (value, max) => { if (typeof value !== 'string' || value.length > max) fail(); return value; };
  function validate(value) {
    let json; try { json = JSON.stringify(value); } catch { fail(); }
    if (typeof json !== 'string') fail();
    if (new TextEncoder().encode(json).length > LIMITS.bytes) throw Object.assign(new Error('q-sheet-too-large'), { status: 413 });
    exact(value, ['schema','department','language','title','showTitle','versionLabel','columns','rows','legend']);
    if (value.schema !== 1 || !Object.hasOwn(FIELDS, value.department) || !['ja','en','ko','zh-Hans','zh-Hant'].includes(value.language)) fail();
    string(value.title, LIMITS.title); string(value.showTitle, LIMITS.title); string(value.versionLabel, LIMITS.version); string(value.legend, LIMITS.cell);
    if (!Array.isArray(value.columns) || !value.columns.length || value.columns.length > LIMITS.columns || !Array.isArray(value.rows) || value.rows.length > LIMITS.rows) fail();
    const allowed = [...FIELDS[value.department], 'timecode'], seen = new Set();
    for (const c of value.columns) {
      exact(c, ['key','label']); if (!allowed.includes(c.key) || seen.has(c.key)) fail(); seen.add(c.key); string(c.label, LIMITS.label);
    }
    if (value.columns[0].key !== 'scene' || FIELDS[value.department].some(key => !seen.has(key))) fail();
    for (const row of value.rows) {
      if (!Array.isArray(row) || row.length !== value.columns.length) fail();
      row.forEach(cell => string(cell, LIMITS.cell));
    }
    return JSON.parse(json); // A detached, plain JSON value; no caller-owned objects survive.
  }
  function fromSheet(sheet, language = 'ja') {
    if (sheet?.kind !== 'department') fail();
    return validate({ schema: 1, department: sheet.key, language, title: sheet.title, showTitle: sheet.showTitle, versionLabel: sheet.versionLabel,
      columns: sheet.columns.map(({key,label}) => ({key,label})), rows: sheet.rows.map(row => sheet.columns.map(c => String(row[c.key] ?? ''))), legend: sheet.legend || '' });
  }
  function toSheet(value) {
    const copy = validate(value);
    return { kind: 'department', key: copy.department, title: copy.title, showTitle: copy.showTitle, versionLabel: copy.versionLabel,
      columns: copy.columns, rows: copy.rows.map(cells => Object.fromEntries(copy.columns.map((c,i) => [c.key,cells[i]]))), legend: copy.legend, footnotes: [] };
  }
  const api = Object.freeze({ LIMITS, FIELDS, validate, fromSheet, toSheet });
  root.STAGE_Q_LINK_MODEL = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
