import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import worker, { createSessionToken, isEditorAssetPath, EDITOR_ASSET_PATHS } from '../worker.js';
import { STUDY_PUBLIC_ASSETS } from '../study-links.js';
import { read } from './security-harness.mjs';
const origin = 'https://gamma.example';
const accounts = [['owner','fixture-owner'], ['legacy','fixture-legacy'], ['guest4','fixture-guest']];
function env() {
  const fetched = [];
  return { SITE_USER: accounts[0][0], SITE_PASS: accounts[0][1], GUEST_USER: accounts[1][0], GUEST_PASS: accounts[1][1],
    GUEST_ACCOUNTS: JSON.stringify([{ user: accounts[2][0], pass: accounts[2][1] }]), fetched,
    ASSETS: { fetch: async req => { fetched.push(new URL(req.url).pathname); return new Response(req.method === 'HEAD' ? null : 'fixture asset'); } } };
}
const request = (path, auth, method = 'GET') => new Request(origin + path, { method, headers: auth });
const blocked = ['/tests/a.js','/tools/deploy.sh','/docs/private.json','/docs/plan.html','/README.md','/package.json',
  '/stage-samples/README.md','/stage-samples/build-feature-test-show.mjs','/light-design/private.json',
  '/run-of-show/private.js','/run-of-show/TOKEN_SHEET.md','/run-of-show/INTEGRATION.md','/run-of-show/verification/manifest.json',
  '/stage-secret.js','/stage-sketch_backup_old.js','/.claude/settings.json','/.git/config','/.env',
  '/worker.js','/wrangler.toml','/assets/brand/provenance.json','/public/ai-json/README.md','/icons/private.md',
  '/private.webmanifest','/manual-gamma/.private.json','/manual-gamma/%2e%2e/tools/a.js',
  '/%73tage.html','/stage.html%2f..%2ftools/a.js','/manual-gamma/x%5cprivate.js','/manual-gamma/x%00.js'];
for (const account of accounts) {
  test(`${account[0]}: Basic and existing Cookie reject assets outside the allowlist before ASSETS`, async () => {
    const token = await createSessionToken(...account, Math.floor(Date.now()/1000) - 60);
    for (const auth of [{ Authorization: 'Basic ' + btoa(account.join(':')) }, { Cookie: '__Host-gamma-session=' + token }]) {
      const e = env();
      for (const method of ['GET','HEAD']) for (const path of blocked) {
        const response = await worker.fetch(request(path, auth, method), e, {});
        assert.equal(response.status, 403, `${method} ${path}`);
        assert.match(response.headers.get('Cache-Control'), /no-store/);
      }
      assert.deepEqual(e.fetched, []);
      for (const path of ['/stage.html','/style.css']) assert.equal((await worker.fetch(request(path,auth,'POST'), e, {})).status,403);
    }
  });
}
test('evaluated SW shell and local HTML dependency closure are allowed', async () => {
  const c = { self: { location: { href: origin + '/stage-sw.js' }, addEventListener() {} }, URL };
  vm.runInNewContext(read('stage-sw.js').split('/* 配信層')[0] + '; this.shell=APP_SHELL;', c);
  const paths = new Set(c.shell.map(p => new URL(p,origin).pathname));
  paths.add('/stage-sw.js'); paths.add('/storage-recovery.html');
  const documents = ['stage.html','storage-recovery.html','light-design/index.html','formation/presets/editor.html','manual-gamma/index.html','public/ai-json/index.html','run-of-show/index.html'];
  for (const file of documents) {
    paths.add('/'+file);
    for (const m of read(file).matchAll(/(?:src|href)="([^"#]+)"/g)) {
      const u = new URL(m[1], origin+'/'+file);
      if (u.origin === origin) paths.add(u.pathname);
    }
  }
  const e = env(); const auth = { Authorization: 'Basic '+btoa(accounts[2].join(':')) };
  for (const path of paths) {
    assert.ok(isEditorAssetPath(path), path);
    assert.equal((await worker.fetch(request(path,auth),e,{})).status,200,path);
    if (path.endsWith('.html')) {
      const clean = path.endsWith('/index.html') ? path.slice(0,-10) : path.slice(0,-5);
      assert.ok(isEditorAssetPath(clean), `Static-host clean URL ${clean}`);
      assert.equal((await worker.fetch(request(clean,auth),e,{})).status,200,clean);
    }
  }
  for (const path of EDITOR_ASSET_PATHS) {
    if (!path.endsWith('/') && /\.[a-z]+$/i.test(path)) assert.ok(fs.existsSync(new URL('..'+path, import.meta.url)), `Missing permitted asset ${path}`);
  }
});
test('Viewer routes keep their public API contract and new parsing dependency', async () => {
  const e = env();
  for (const path of STUDY_PUBLIC_ASSETS) {
    assert.equal((await worker.fetch(request(path,{}),e,{})).status,200,path);
  }
  assert.ok(STUDY_PUBLIC_ASSETS.has('/study-assets/stage-data-safety.js'));
  const frame = read('study-frame.html');
  assert.ok(frame.indexOf('stage-data-safety.js') < frame.indexOf('<script src="/study-assets/stage-sketch.js'));
  assert.equal((await worker.fetch(request('/whoami',{Authorization:'Basic '+btoa(accounts[2].join(':'))}),e,{})).status,200);
  assert.equal((await worker.fetch(request('/beta-status',{}),e,{})).status,200);
});
test('public shell exception does not reveal arbitrary manifests or hidden icons', async () => {
  const e = env();
  for (const p of ['/private.webmanifest','/icons/.private.svg']) assert.equal((await worker.fetch(request(p,{}),e,{})).status,401);
  assert.deepEqual(e.fetched,[]);
  for (const p of ['/stage-sketch.webmanifest','/icons/stage-sketch-icon.svg']) assert.equal((await worker.fetch(request(p,{}),e,{})).status,200);
});
