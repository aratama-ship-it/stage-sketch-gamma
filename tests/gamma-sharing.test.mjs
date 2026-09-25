import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../worker.js';
import { StudyLinks, STUDY_PUBLIC_ASSETS } from '../study-links.js';

const origin = 'https://gamma.example';
const sample = JSON.parse(await readFile(new URL('../stage-samples/feature-test-show.json', import.meta.url), 'utf8'));
const scene = sample.project.scenes.find(row => row.kind === 'scene' && /^J-2/.test(row.title));
assert.ok(scene, '同梱試験場の J-2 が必要');

function setup({ anonymous = true, credentials = true } = {}) {
  const saved = new Map();
  const storage = {
    get: async key => structuredClone(saved.get(key)),
    put: async (key, value) => saved.set(key, structuredClone(value)),
    delete: async key => saved.delete(key),
    list: async ({ prefix = '' } = {}) => new Map([...saved].filter(([key]) => key.startsWith(prefix))),
  };
  let queue = Promise.resolve();
  storage.transaction = fn => { const next = queue.then(() => fn(storage)); queue = next.catch(() => {}); return next; };
  let links = new StudyLinks({ storage });
  let roomOwner = '';
  const env = {
    ...(credentials ? { SITE_USER: 'owner', SITE_PASS: 'test-secret', GUEST_ACCOUNTS: JSON.stringify([{ user: 'guest', pass: 'guest-secret' }]) } : {}),
    STUDY_ALLOW_ANONYMOUS: anonymous ? 'true' : 'false',
    STUDY_LINKS: { idFromName: name => name, get: () => ({ fetch: request => links.fetch(request) }) },
    SESSION_ROOM: { idFromName: name => name, get: () => ({ fetch: async (input, init) => {
      const request = new Request(input, init);
      roomOwner = request.headers.get('X-Shosai-Session-Owner');
      if (new URL(request.url).pathname === '/new') return Response.json({ ok: true, hostKey: 'test-host-key' });
      return Response.json({ ok: roomOwner === 'owner' });
    } }) },
    ASSETS: { fetch: async request => new Response(new URL(request.url).pathname, { headers: { 'Content-Type': 'text/html' } }) },
  };
  const call = (path, { user, method = 'GET', body, headers = {} } = {}) => worker.fetch(new Request(origin + path, {
    method,
    headers: { Origin: origin, ...(user ? { Authorization: `Basic ${btoa(`${user}:${user === 'owner' ? 'test-secret' : 'guest-secret'}`)}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), env, {});
  return { call, env, saved, restart() { links = new StudyLinks({ storage }); }, get roomOwner() { return roomOwner; } };
}

test('J-2: 編集者が明示発行した試験場ショーだけが演者リンクで読める', async () => {
  const s = setup();
  const before = await s.call(`/study/api/owner/shows/${sample.project.id}`, { user: 'owner' });
  assert.deepEqual(await before.json(), { link: null });
  const issued = await s.call(`/study/api/owner/shows/${sample.project.id}`, {
    user: 'owner', method: 'POST', body: { document: sample },
  });
  assert.equal(issued.status, 201);
  const token = (await issued.json()).link.token;
  assert.match(token, /^[a-f0-9]{48}$/);
  const me = await (await s.call('/study/api/me')).json();
  assert.equal(me.identity, null);
  assert.equal(me.allowAnonymous, true);
  const view = await s.call(`/study/api/view/${token}`);
  assert.equal(view.status, 200);
  const data = await view.json();
  assert.equal(data.document.project.id, sample.project.id);
  assert.ok(data.document.project.scenes.some(row => row.id === scene.id));
  assert.equal(data.document.project.scenes.length, sample.project.scenes.length);
  assert.equal(view.headers.get('Cache-Control'), 'private, no-store');
  const changed = structuredClone(sample);
  changed.project.title = '試験場 J-2・共有更新';
  assert.equal((await (await s.call(`/study/api/view/${token}`)).json()).document.project.title, sample.project.title,
    '編集内容は明示更新まで公開されない');
  const updated = await s.call(`/study/api/owner/links/${token}`, {
    user: 'owner', method: 'PUT', body: { document: changed },
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).link.token, token);
  assert.equal((await (await s.call(`/study/api/view/${token}`)).json()).document.project.title, changed.project.title);
  s.restart();
  assert.equal((await s.call(`/study/api/view/${token}`)).status, 200);
  assert.equal((await s.call(`/study/api/owner/links/${token}`, { user: 'owner', method: 'DELETE' })).status, 200);
  assert.equal((await s.call(`/study/api/view/${token}`)).status, 404);
});

test('J-2: 閲覧リンクでは管理操作と他のファイルへ進めない', async () => {
  const s = setup();
  const issue = await s.call(`/study/api/owner/shows/${sample.project.id}`, { user: 'owner', method: 'POST', body: { document: sample } });
  const token = (await issue.json()).link.token;
  for (const path of ['/stage.html', '/stage-study-owner.js', '/db.js', '/study-assets/roster.js']) {
    assert.ok([401, 404].includes((await s.call(path)).status), path);
  }
  for (const path of STUDY_PUBLIC_ASSETS) assert.equal((await s.call(path)).status, 200, path);
  assert.equal((await s.call(`/study/api/owner/links/${token}`, { headers: { 'X-Study-Owner': 'account:owner' } })).status, 401);
  assert.equal((await s.call(`/study/api/owner/links/${token}`, { user: 'guest', headers: { 'X-Study-Owner': 'account:owner' } })).status, 404);
  assert.equal((await s.call(`/study/api/view/${token}`, { method: 'PUT', body: { document: sample } })).status, 404);
  assert.equal((await s.call(`/study/api/view/${token}/notes`, { method: 'POST', body: { name: 'A', sceneId: scene.id, text: '見えます', revision: 1 }, headers: { Origin: 'https://evil.example' } })).status, 403);
});

test('J-2: ログインなし・設定不備は閉じ、γとβの認証Cookieを混ぜない', async () => {
  const s = setup();
  assert.equal((await s.call('/session/new', { method: 'POST' })).status, 401);
  assert.equal((await s.call('/stage.html', { headers: { 'Sec-Fetch-Mode': 'navigate' } })).status, 302);
  assert.equal((await s.call('/session/new', { method: 'POST', headers: { Cookie: '__Host-shosai-session=beta-token' } })).status, 401);
  const signed = await worker.fetch(new Request(origin + '/sign-in', {
    method: 'POST', body: new URLSearchParams({ user: 'owner', pass: 'test-secret', next: '/stage.html' }),
  }), s.env, {});
  assert.equal(signed.status, 303);
  const cookie = signed.headers.get('Set-Cookie');
  assert.match(cookie, /^__Host-gamma-session=/);
  assert.equal((await s.call('/whoami', { headers: { Cookie: cookie.split(';')[0] } })).status, 200);
  const session = await s.call('/session/new', { user: 'owner', method: 'POST', headers: { 'X-Shosai-Session-Owner': 'forged' } });
  assert.equal(session.status, 200);
  assert.equal(s.roomOwner, 'owner');
  assert.match((await session.json()).roomId, /^[a-z2-9]{8}$/);
  const misconfigured = setup({ credentials: false });
  assert.equal((await misconfigured.call('/stage.html')).status, 503);
  const closed = setup({ anonymous: false });
  assert.equal((await (await closed.call('/study/api/me')).json()).allowAnonymous, false);
});
