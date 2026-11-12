// Local performer reply file contract. No DOM, storage, renderer or network access.
// All strings are untrusted plain text: consumers MUST use textContent / canvas text.
// context is the existing per-scene studySceneKeys SHA-256, NOT proof of identity.
(function (root) {
  'use strict';
  const FORMAT = 'stage-sketch-study-reply', VERSION = 1;
  const MIME_TYPE = 'application/json';
  const LIMITS = Object.freeze({ bytes: 8 * 1024 * 1024, scenes: 60, text: 2000,
    stickies: 16, stickyText: 200, strokes: 64, points: 512, imageChars: 180000,
    imagePixels: 2 * 960 * 960 }); // Twice the maximum 960×960 export in stage-study-pen.js.
  const ID = /^[A-Za-z0-9_-]{1,100}$/;
  const HASH = /^[a-f0-9]{64}$/;
  const REPLY_ID = /^reply-[a-f0-9]{32}$/;
  const JPEG = 'data:image/jpeg;base64,';
  const VIEWS = ['front', 'plan'];
  const PARTS = ['name', 'showId', 'showTitle', 'scenes'];
  const FIELDS = ['format', 'version', 'id', 'createdAt', ...PARTS];
  const encoder = new TextEncoder();
  const fail = (code, path) => { throw Object.assign(new Error(code), { code, path }); };
  const caught = error => ({ ok: false, code: error.code || 'invalid-input', path: error.path || '$' });
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function fields(value, required, optional, path) {
    if (!record(value)) fail('object-required', path);
    for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) fail('unknown-field', path + '.' + key);
    for (const key of required) if (!Object.hasOwn(value, key)) fail('missing-field', path + '.' + key);
  }
  function string(value, max, path, nonempty = false) {
    // UTF-16 code units, matching the existing private-note limits. Never truncate.
    if (typeof value !== 'string' || value.length > max || (nonempty && !value.trim())) fail('invalid-text', path);
  }
  function identifier(value, path) {
    if (typeof value !== 'string' || !ID.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) fail('invalid-id', path);
  }
  function range(value, min, max, path) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail('invalid-number', path);
  }
  function coordinate(value, path) {
    range(value, 0, 1, path);
    if (Math.round(value * 10000) / 10000 !== value) fail('coordinate-precision', path);
  }
  function list(value, min, max, path) {
    if (!Array.isArray(value) || value.length < min || value.length > max) fail('invalid-count', path);
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, i) => key !== String(i))) fail('invalid-array', path);
  }
  function view(value, path) { if (!VIEWS.includes(value)) fail('invalid-view', path); }
  function jpeg(value, path) {
    if (typeof value !== 'string' || value.length > LIMITS.imageChars) fail('image-size', path);
    if (!value.startsWith(JPEG)) fail('image-type', path);
    const base64 = value.slice(JPEG.length);
    if (!base64.length || base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) fail('image-base64', path);
    let binary;
    try { binary = root.atob(base64); } catch { fail('image-base64', path); }
    if (root.btoa(binary) !== base64) fail('image-base64', path);
    // Check JPEG SOI + marker prefix and EOI. This is not an image decoder;
    // S5 must also handle decode failure before displaying/retaining a preview.
    if (binary.length < 5 || binary.charCodeAt(0) !== 255 || binary.charCodeAt(1) !== 216
      || binary.charCodeAt(2) !== 255 || binary.charCodeAt(binary.length - 2) !== 255
      || binary.charCodeAt(binary.length - 1) !== 217) fail('image-signature', path);
    // Read marker lengths and SOF dimensions without allocating a decoded bitmap.
    // Scan entropy bytes too, so a later frame or DNL cannot override the bound.
    const byte = offset => binary.charCodeAt(offset);
    const word = offset => byte(offset) * 256 + byte(offset + 1);
    let offset = 2, frame = false, scan = false;
    while (offset < binary.length) {
      if (scan) {
        offset = binary.indexOf('\xff', offset);
        if (offset < 0) fail('image-signature', path);
      }
      if (byte(offset++) !== 255) fail('image-signature', path);
      while (byte(offset) === 255) offset++;
      const marker = byte(offset++);
      if (scan && (marker === 0 || (marker >= 0xd0 && marker <= 0xd7))) continue;
      scan = false;
      if (marker === 0xd9) {
        if (!frame || offset !== binary.length) fail('image-signature', path);
        return;
      }
      if (marker === 0x01) continue;
      if (!marker || marker === 0xd8 || marker === 0xdc || (marker >= 0xd0 && marker <= 0xd7)
        || offset + 2 > binary.length) fail('image-signature', path);
      const length = word(offset);
      if (length < 2 || offset + length > binary.length) fail('image-signature', path);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        if (frame || length < 8 || !byte(offset + 7) || length !== 8 + 3 * byte(offset + 7)) fail('image-signature', path);
        const height = word(offset + 3), width = word(offset + 5);
        if (!width || !height) fail('image-signature', path);
        if (width * height > LIMITS.imagePixels) fail('image-size', path);
        frame = true;
      }
      if (marker === 0xda) {
        if (!frame) fail('image-signature', path);
        scan = true;
      }
      offset += length;
    }
    fail('image-signature', path);
  }
  function scene(value, path) {
    fields(value, ['sceneId', 'sceneTitle', 'revision', 'context', 'text', 'strokes', 'stickies', 'backgrounds'], [], path);
    identifier(value.sceneId, path + '.sceneId'); string(value.sceneTitle, 300, path + '.sceneTitle');
    if (!Number.isSafeInteger(value.revision) || value.revision < 1) fail('invalid-revision', path + '.revision');
    if (typeof value.context !== 'string' || !HASH.test(value.context)) fail('invalid-context', path + '.context');
    string(value.text, LIMITS.text, path + '.text');
    list(value.strokes, 0, LIMITS.strokes, path + '.strokes');
    value.strokes.forEach((stroke, i) => {
      const p = path + '.strokes[' + i + ']';
      fields(stroke, ['view', 'points'], [], p); view(stroke.view, p + '.view');
      list(stroke.points, 1, LIMITS.points, p + '.points');
      stroke.points.forEach((point, j) => {
        const q = p + '.points[' + j + ']'; list(point, 2, 2, q);
        coordinate(point[0], q + '[0]'); coordinate(point[1], q + '[1]');
      });
    });
    list(value.stickies, 0, LIMITS.stickies, path + '.stickies');
    const ids = new Set();
    value.stickies.forEach((note, i) => {
      const p = path + '.stickies[' + i + ']';
      fields(note, ['id', 'view', 'text', 'x', 'y'], ['shape', 'color', 'backgroundOpacity', 'width', 'height'], p);
      identifier(note.id, p + '.id');
      if (ids.has(note.id)) fail('duplicate-id', p + '.id'); ids.add(note.id);
      view(note.view, p + '.view'); string(note.text, LIMITS.stickyText, p + '.text');
      coordinate(note.x, p + '.x'); coordinate(note.y, p + '.y');
      if (Object.hasOwn(note, 'shape') && !['rect', 'rounded', 'bubble'].includes(note.shape)) fail('invalid-shape', p + '.shape');
      if (Object.hasOwn(note, 'color') && !['desk', 'paper', 'yellow', 'rose', 'sage', 'blue'].includes(note.color)) fail('invalid-color', p + '.color');
      for (const [key, min, max] of [['backgroundOpacity', 0, 1], ['width', 120, 400], ['height', 44, 320]]) {
        if (Object.hasOwn(note, key)) range(note[key], min, max, p + '.' + key);
      }
    });
    fields(value.backgrounds, VIEWS, [], path + '.backgrounds');
    for (const v of VIEWS) {
      const p = path + '.backgrounds.' + v, background = value.backgrounds[v];
      fields(background, ['dataUrl', 'annotationWidth', 'annotationHeight'], [], p);
      jpeg(background.dataUrl, p + '.dataUrl');
      // Uncropped canvas CSS dimensions at capture, for scaling sticky pixel sizes.
      for (const key of ['annotationWidth', 'annotationHeight']) range(background[key], 1, 16384, p + '.' + key);
    }
  }
  function checkParts(parts) {
    fields(parts, PARTS, [], '$');
    string(parts.name, 100, '$.name', true); identifier(parts.showId, '$.showId');
    string(parts.showTitle, 300, '$.showTitle'); list(parts.scenes, 1, LIMITS.scenes, '$.scenes');
    const ids = new Set();
    parts.scenes.forEach((s, i) => {
      scene(s, '$.scenes[' + i + ']');
      if (ids.has(s.sceneId)) fail('duplicate-id', '$.scenes[' + i + '].sceneId'); ids.add(s.sceneId);
    });
  }
  function checkReply(reply) {
    if (!record(reply) || reply.format !== FORMAT) fail('unsupported-format', '$.format');
    if (reply.version !== VERSION) fail('unsupported-version', '$.version');
    fields(reply, FIELDS, [], '$');
    if (typeof reply.id !== 'string' || !REPLY_ID.test(reply.id)) fail('invalid-reply-id', '$.id');
    if (typeof reply.createdAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(reply.createdAt)
      || !Number.isFinite(Date.parse(reply.createdAt)) || new Date(reply.createdAt).toISOString() !== reply.createdAt) fail('invalid-date', '$.createdAt');
    checkParts(Object.fromEntries(PARTS.map(key => [key, reply[key]])));
  }
  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (record(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }
  function documentFrom(parts, id, createdAt) {
    checkParts(parts);
    return { format: FORMAT, version: VERSION, id, createdAt, ...parts };
  }
  function measure(parts) {
    // Generated IDs and UTC timestamps have fixed serialized lengths.
    const reply = documentFrom(parts, 'reply-' + '0'.repeat(32), '2000-01-01T00:00:00.000Z');
    return { reply, bytes: encoder.encode(stable(reply)).byteLength };
  }
  function buildReply(parts) {
    try {
      const estimate = measure(parts);
      if (estimate.bytes > LIMITS.bytes) return { ok: false, code: 'file-too-large', path: '$', bytes: estimate.bytes, limit: LIMITS.bytes };
      if (!root.crypto?.getRandomValues) fail('crypto-unavailable', '$');
      const random = root.crypto.getRandomValues(new Uint8Array(16));
      const id = 'reply-' + Array.from(random, n => n.toString(16).padStart(2, '0')).join('');
      const text = stable({ ...estimate.reply, id, createdAt: new Date().toISOString() });
      // Detached snapshot: later edits to parts cannot change the saved reply.
      return { ok: true, reply: JSON.parse(text), text, bytes: encoder.encode(text).byteLength };
    } catch (error) { return caught(error); }
  }
  function validateStudyReply(input) {
    let text, bytes;
    try {
      if (typeof input === 'string') {
        // Reject before encoding or JSON.parse. UTF-8 is never shorter than UTF-16 length.
        if (input.length > LIMITS.bytes) return { ok: false, code: 'file-too-large', path: '$', limit: LIMITS.bytes };
        bytes = encoder.encode(input).byteLength; text = input;
      } else {
        const buffer = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
        if (!(buffer instanceof Uint8Array)) fail('input-type', '$');
        bytes = buffer.byteLength;
        if (bytes <= LIMITS.bytes) {
          try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer); }
          catch { fail('invalid-utf8', '$'); }
        }
      }
      if (bytes > LIMITS.bytes) return { ok: false, code: 'file-too-large', path: '$', bytes, limit: LIMITS.bytes };
      let reply;
      try { reply = JSON.parse(text); } catch { fail('invalid-json', '$'); }
      checkReply(reply);
      return { ok: true, reply, bytes };
    } catch (error) { return caught(error); }
  }
  function estimateReplySize(parts) {
    try { const { bytes } = measure(parts); return { ok: true, bytes, limit: LIMITS.bytes, fits: bytes <= LIMITS.bytes }; }
    catch (error) { return caught(error); }
  }
  function suggestReplyScenes(parts) {
    try {
      const { bytes } = measure(parts);
      const scenes = parts.scenes.map(s => ({ sceneId: s.sceneId, sceneTitle: s.sceneTitle,
        bytes: encoder.encode(stable(s)).byteLength }));
      // Largest scenes first minimizes the number removed. This is a suggestion only.
      // Account for array separators, including when the last scene would be removed.
      let remainingBytes = bytes, remainingCount = scenes.length;
      const removeSceneIds = [];
      for (const s of [...scenes].sort((a, b) => b.bytes - a.bytes)) {
        if (remainingBytes <= LIMITS.bytes) break;
        remainingBytes -= s.bytes + (remainingCount > 1 ? 1 : 0); remainingCount--;
        removeSceneIds.push(s.sceneId);
      }
      return { ok: true, bytes, limit: LIMITS.bytes, fits: bytes <= LIMITS.bytes, scenes,
        removeSceneIds, remainingBytes, canFit: remainingCount > 0 && remainingBytes <= LIMITS.bytes };
    } catch (error) { return caught(error); }
  }
  async function replyImportKey(reply) {
    try {
      checkReply(reply);
      const text = stable(reply), checked = validateStudyReply(text);
      if (!checked.ok) return checked;
      if (!root.crypto?.subtle) fail('crypto-unavailable', '$');
      const digest = await root.crypto.subtle.digest('SHA-256', encoder.encode(text));
      const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
      return { ok: true, id: checked.reply.id, hash, key: checked.reply.id + ':' + hash };
    } catch (error) { return caught(error); }
  }
  function replyFileName(reply) {
    checkReply(reply);
    // Like ROS releaseId + '-reply.json'; no user text or path components in the name.
    return reply.showId + '-study-' + reply.id + '.json';
  }
  const api = Object.freeze({ FORMAT, VERSION, MIME_TYPE, LIMITS, buildReply, validateStudyReply,
    estimateReplySize, suggestReplyScenes, replyImportKey, replyFileName });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SHOSAI_STUDY_REPLY = api;
})(globalThis);
