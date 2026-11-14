'use strict';
/* Testy powiadomień push aplikacji Android (Worker → FCM HTTP v1, tematy).
   Uruchomienie (z katalogu repo): node --test testy/worker-push.test.js
   Bez sieci: fetch do Google jest atrapą; podpis JWT sprawdzamy prawdziwym kluczem publicznym RSA wygenerowanym w teście. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
// Worker leży w repozytorium strony (radar-epwr). Ścieżka: zmienna WORKER_JS albo sąsiedni folder „RADAR EPWR”.
const WORKER_JS = process.env.WORKER_JS || path.join(__dirname, '..', '..', 'RADAR EPWR', 'cloudflare-worker-adsb.js');

const store = new Map();
globalThis.caches = {
  default: {
    async match(req) { const r = store.get(typeof req === 'string' ? req : req.url); return r ? r.clone() : undefined; },
    async put(req, res) { store.set(typeof req === 'string' ? req : req.url, res.clone()); },
    async delete(req) { return store.delete(typeof req === 'string' ? req : req.url); }
  }
};

// Atrapa fetch: token Google i wysyłka FCM; zapisuje wszystkie wywołania
let calls = [];
let fcmStatus = 200;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  calls.push({ url: u, init });
  if (u === 'https://oauth2.googleapis.com/token') return new Response(JSON.stringify({ access_token: 'ya29.TEST', expires_in: 3600 }), { status: 200 });
  if (u.startsWith('https://fcm.googleapis.com/')) return new Response('{}', { status: fcmStatus });
  return new Response('nie', { status: 404 });
};
const fcmCalls = () => calls.filter((c) => c.url.startsWith('https://fcm.googleapis.com/')).map((c) => JSON.parse(c.init.body).message);

let W, SA, PUB;
test.before(async () => {
  const src = fs.readFileSync(WORKER_JS, 'utf8');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-push-'));
  const file = path.join(dir, 'worker.mjs');
  fs.writeFileSync(file, src);
  W = await import(file);
  const kp = await webcrypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const der = Buffer.from(await webcrypto.subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  PUB = kp.publicKey;
  SA = JSON.stringify({ type: 'service_account', project_id: 'radar-epwr-test', client_email: 'push@radar-epwr-test.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\n' + der.match(/.{1,64}/g).join('\n') + '\n-----END PRIVATE KEY-----\n' });
});
test.beforeEach(() => { calls = []; store.clear(); fcmStatus = 200; W.fcmReset(); });

function kv() { const m = new Map(); return { get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); } }; }
const ENV = (extra) => ({ ALERTS_TOKEN: 'tok-n8n', FCM_SERVICE_ACCOUNT: SA, FLIGHTS_KV: kv(), ...extra });
function ctxs() { const p = []; return { ctx: { waitUntil: (x) => p.push(x) }, done: () => Promise.all(p) }; }
const postAlerts = (body, token) => new Request('https://w.test/alerts', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token !== null ? { Authorization: 'Bearer ' + (token || 'tok-n8n') } : {}) }, body: JSON.stringify(body)
});
const now = () => Date.now();

test('nowy alarm (kod czerwony) → temat „alarmy”, kanał alarmy, priorytet HIGH, link do samolotu', async () => {
  const env = ENV(), c = ctxs();
  const r = await W.handleAlerts(postAlerts({ id: 'e1', ts: now(), rule: 'emergency', title: '🚨 Squawk 7700', ident: 'RYR1AB · EI-ABC', where: 'nad Wrocławiem', hex: 'abc123' }), env, c.ctx, {});
  assert.equal(r.status, 200);
  await c.done();
  const m = fcmCalls();
  assert.equal(m.length, 1);
  assert.equal(m[0].topic, 'alarmy');
  assert.equal(m[0].android.priority, 'HIGH');
  assert.equal(m[0].android.notification.channel_id, 'alarmy');
  assert.equal(m[0].notification.title, '🚨 Squawk 7700');
  assert.equal(m[0].notification.body, 'RYR1AB · EI-ABC · nad Wrocławiem');
  assert.equal(m[0].data.url, '/app/#radar?hex=abc123');
  const send = calls.find((x) => x.url.startsWith('https://fcm.googleapis.com/'));
  assert.equal(send.url, 'https://fcm.googleapis.com/v1/projects/radar-epwr-test/messages:send');
  assert.equal(send.init.headers.Authorization, 'Bearer ya29.TEST');
});

test('JWT do Google jest poprawnie podpisany (RS256) i ma zakres firebase.messaging', async () => {
  const env = ENV(), c = ctxs();
  await W.handleAlerts(postAlerts({ id: 'e-jwt', ts: now(), rule: 'goaround', title: 'Odejście na drugi krąg' }), env, c.ctx, {});
  await c.done();
  const tokCall = calls.find((x) => x.url === 'https://oauth2.googleapis.com/token');
  const jwt = new URLSearchParams(tokCall.init.body).get('assertion');
  const [h, p, s] = jwt.split('.');
  const dec = (x) => Buffer.from(x.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const ok = await webcrypto.subtle.verify('RSASSA-PKCS1-v1_5', PUB, dec(s), new TextEncoder().encode(h + '.' + p));
  assert.equal(ok, true);
  const claim = JSON.parse(dec(p).toString());
  assert.equal(claim.scope, 'https://www.googleapis.com/auth/firebase.messaging');
  assert.equal(claim.aud, 'https://oauth2.googleapis.com/token');
  assert.ok(claim.exp - claim.iat <= 3600);
});

test('token Google jest w cache – drugie zdarzenie nie pyta o nowy', async () => {
  const env = ENV();
  let c = ctxs();
  await W.handleAlerts(postAlerts({ id: 't1', ts: now(), rule: 'holding', title: 'Holding' }), env, c.ctx, {}); await c.done();
  c = ctxs();
  await W.handleAlerts(postAlerts({ id: 't2', ts: now(), rule: 'holding', title: 'Holding 2' }), env, c.ctx, {}); await c.done();
  assert.equal(calls.filter((x) => x.url === 'https://oauth2.googleapis.com/token').length, 1);
  assert.equal(fcmCalls().length, 2);
});

test('to samo zdarzenie wysłane ponownie (aktualizacja z n8n) – bez drugiego powiadomienia', async () => {
  const env = ENV();
  let c = ctxs();
  await W.handleAlerts(postAlerts({ id: 'dup', ts: now(), rule: 'diversion', title: 'Przekierowanie' }), env, c.ctx, {}); await c.done();
  c = ctxs();
  await W.handleAlerts(postAlerts({ id: 'dup', ts: now(), rule: 'diversion', title: 'Przekierowanie (aktualizacja)' }), env, c.ctx, {}); await c.done();
  assert.equal(fcmCalls().length, 1);
});

test('zdarzenie zwykłe → temat „zdarzenia”, priorytet NORMAL, link do listy', async () => {
  const env = ENV(), c = ctxs();
  await W.handleAlerts(postAlerts({ id: 'f1', ts: now(), rule: 'military', title: 'Wojskowy C-130', desc: 'Przelot nad lotniskiem\nlinia 2' }), env, c.ctx, {});
  await c.done();
  const m = fcmCalls();
  assert.equal(m.length, 1);
  assert.equal(m[0].topic, 'zdarzenia');
  assert.equal(m[0].android.priority, 'NORMAL');
  assert.equal(m[0].notification.body, 'Przelot nad lotniskiem');
  assert.equal(m[0].data.url, '/app/#zdarzenia');
});

test('zdarzenie testowe → tylko temat „test”; wątpliwe (unverified) i stare – bez powiadomienia', async () => {
  const env = ENV(), c = ctxs();
  await W.handleAlerts(postAlerts([
    { id: 'x1', ts: now(), rule: 'emergency', title: 'Test 7700', test: true },
    { id: 'x2', ts: now(), rule: 'unverified', title: 'Wątpliwe' },
    { id: 'x3', ts: now() - 40 * 60000, rule: 'goaround', title: 'Stare' }
  ]), env, c.ctx, {});
  await c.done();
  const m = fcmCalls();
  assert.equal(m.length, 1);
  assert.equal(m[0].topic, 'test');
  assert.equal(m[0].android.priority, 'NORMAL');
  assert.match(m[0].notification.title, /^\[TEST\]/);
});

test('najwyżej 5 powiadomień z jednego POST (ochrona przed zalewem)', async () => {
  const env = ENV(), c = ctxs();
  const many = Array.from({ length: 9 }, (_, i) => ({ id: 'm' + i, ts: now(), rule: 'cargo', title: 'Gość ' + i }));
  await W.handleAlerts(postAlerts(many), env, c.ctx, {});
  await c.done();
  assert.equal(fcmCalls().length, 5);
});

test('bez sekretu FCM_SERVICE_ACCOUNT – alert zapisany, zero połączeń z Google', async () => {
  const env = ENV({ FCM_SERVICE_ACCOUNT: undefined }), c = ctxs();
  const r = await W.handleAlerts(postAlerts({ id: 'n1', ts: now(), rule: 'emergency', title: 'X' }), env, c.ctx, {});
  await c.done();
  assert.equal(r.status, 200);
  assert.equal(calls.length, 0);
  assert.equal(JSON.parse(await env.FLIGHTS_KV.get('alerts:latest')).length, 1);
});

test('bez tokenu n8n – 403 i żadnego powiadomienia (nikt obcy nie wyśle push)', async () => {
  const env = ENV(), c = ctxs();
  const r = await W.handleAlerts(postAlerts({ id: 'h1', ts: now(), rule: 'emergency', title: 'Fałszywy alarm' }, 'zly-token'), env, c.ctx, {});
  await c.done();
  assert.equal(r.status, 403);
  assert.equal(calls.length, 0);
});

test('błąd FCM nie psuje zapisu alertu', async () => {
  fcmStatus = 500;
  const env = ENV(), c = ctxs();
  const r = await W.handleAlerts(postAlerts({ id: 'b1', ts: now(), rule: 'emergency', title: 'X' }), env, c.ctx, {});
  await c.done();
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(await env.FLIGHTS_KV.get('alerts:latest'))[0].id, 'b1');
});

test('/push/test: bez tokenu 403, z tokenem – powiadomienie na temat „test”', async () => {
  const env = ENV();
  const bad = await W.handlePushTest(new Request('https://w.test/push/test', { method: 'POST' }), env, {});
  assert.equal(bad.status, 403);
  const ok = await W.handlePushTest(new Request('https://w.test/push/test', { method: 'POST', headers: { Authorization: 'Bearer tok-n8n' } }), env, {});
  assert.equal(ok.status, 200);
  assert.equal(fcmCalls()[0].topic, 'test');
});

test('start transmisji w panelu /live → jedno powiadomienie „transmisja” (ponowne włączenie w ciągu 30 min – bez)', async () => {
  const env = ENV({ LIVE_PIN: 'TESTPIN-12345', LIVE_SECRET: 'x'.repeat(40) });
  const tok = await W.signToken(env.LIVE_SECRET, Date.now() + 60000);
  const toggle = async (live) => {
    const c = ctxs();
    const req = new Request('https://w.test/studio/toggle', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ live }) });
    const r = await W.handleStudio(req, new URL(req.url), env, c.ctx, {});
    await c.done();
    return r.status;
  };
  assert.equal(await toggle(true), 200);
  assert.equal(await toggle(true), 200);     // już na żywo – bez drugiego
  assert.equal(await toggle(false), 200);
  assert.equal(await toggle(true), 200);     // ponownie w ciągu 30 min – blokada
  const m = fcmCalls();
  assert.equal(m.length, 1);
  assert.equal(m[0].topic, 'transmisja');
  assert.equal(m[0].android.notification.channel_id, 'transmisja');
});

test('przy limicie 5 kod czerwony/żółty ma pierwszeństwo przed zwykłymi zdarzeniami', async () => {
  const env = ENV(), c = ctxs();
  const list = Array.from({ length: 6 }, (_, i) => ({ id: 'z' + i, ts: now(), rule: 'cargo', title: 'Gość ' + i }));
  list.push({ id: 'alarm', ts: now() - 60000, rule: 'emergency', title: 'Squawk 7700' });
  await W.handleAlerts(postAlerts(list), env, c.ctx, {});
  await c.done();
  const m = fcmCalls();
  assert.equal(m.length, 5);
  assert.equal(m[0].topic, 'alarmy');
});

test('FCM 401 (odrzucony token) – następna wysyłka pobiera nowy token Google', async () => {
  const env = ENV();
  fcmStatus = 401;
  let c = ctxs();
  await W.handleAlerts(postAlerts({ id: 'u1', ts: now(), rule: 'holding', title: 'H1' }), env, c.ctx, {}); await c.done();
  fcmStatus = 200;
  c = ctxs();
  await W.handleAlerts(postAlerts({ id: 'u2', ts: now(), rule: 'holding', title: 'H2' }), env, c.ctx, {}); await c.done();
  assert.equal(calls.filter((x) => x.url === 'https://oauth2.googleapis.com/token').length, 2);
});
