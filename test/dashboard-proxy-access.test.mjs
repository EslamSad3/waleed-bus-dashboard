import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function load(file, deps) {
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { module: mod, exports: mod.exports, Buffer, Date, process,
    require: name => deps[name] ?? {},
  });
  return mod.exports;
}
const access = load('../lib/access.ts', {});
const auth = load('../lib/auth.ts', { './access': access });
const id = '02200000-0000-4000-8000-000000000001';
function token(role) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode({ sub: id, email: null, app_role: role, exp: Date.now() / 1000 + 900 })}.signature`;
}
function harness(role, { profile, rotatedRole, origin = true } = {}) {
  let cookie = token(role);
  const calls = [];
  const busFetch = async (path, opts) => {
    calls.push({ path, opts });
    if (path === '/me') {
      if (rotatedRole) cookie = token(rotatedRole);
      return profile ?? { ok: true, status: 200, data: { id, platformPermissions: ['fleet-owners.read'] } };
    }
    return { ok: true, status: 200, data: { items: [], nextCursor: 'next' } };
  };
  const session = load('../lib/dashboard-session.ts', {
    'next/headers': { cookies: async () => ({ get: () => ({ value: cookie }) }) },
    '@/lib/api': { busFetch }, '@/lib/auth': { ...auth, ACCESS_COOKIE: 'sa_access' },
    '@/lib/access': access,
  });
  const route = load('../app/api/[...proxy]/route.ts', {
    'next/server': { NextResponse: { json: (data, opts = {}) => ({ data, status: opts.status ?? 200 }) } },
    '@/lib/dashboard-session': session,
    '@/lib/api': { busFetch }, '@/lib/config': { originAllowed: () => origin },
    '@/lib/errors': { toArabicError: code => code, arabiciseDetails: value => value },
    '@/lib/schemas/p1': { findRegistryEntry: () => undefined }, '@/lib/i18n/t': { t: key => key },
  });
  const req = { nextUrl: { search: '?limit=20' }, headers: { get: () => 'application/json' }, text: async () => '{"name":"Updated"}' };
  return { route, req, calls, ctx: { params: Promise.resolve({ proxy: ['fleet-owners'] }) } };
}

for (const role of ['fleet_owner', 'driver', 'passenger', 'user']) {
  test(`proxy rejects ${role} for reads and writes before forwarding company data`, async () => {
    for (const method of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']) {
      const h = harness(role);
      const res = await h.route[method](h.req, h.ctx);
      assert.equal(res.status, 403);
      assert.deepEqual(h.calls.map(c => c.path), ['/me']);
    }
  });
}
for (const role of ['platform_staff', 'super_admin']) {
  test(`proxy keeps ${role} requests and cursor envelopes intact`, async () => {
    const h = harness(role);
    const res = await h.route.PATCH(h.req, h.ctx);
    assert.equal(res.status, 200);
    assert.equal(res.data.data.nextCursor, 'next');
    assert.equal(h.calls[1].path, '/fleet-owners?limit=20');
    assert.equal(h.calls[1].opts.method, 'PATCH');
    assert.equal(h.calls[1].opts.retryAuth, false);
    assert.equal(h.calls[1].opts.body.name, 'Updated');
  });
}
test('revoked sessions and upstream failures never forward resource requests', async () => {
  for (const status of [401, 503]) {
    const h = harness('super_admin', { profile: { ok: false, status, code: 'AUTHENTICATION_FAILED' } });
    assert.equal((await h.route.GET(h.req, h.ctx)).status, status);
    assert.deepEqual(h.calls.map(c => c.path), ['/me']);
  }
});
test('admission reads the refreshed cookie, so demotion to owner is denied', async () => {
  const h = harness('platform_staff', { rotatedRole: 'fleet_owner' });
  assert.equal((await h.route.POST(h.req, h.ctx)).status, 403);
  assert.deepEqual(h.calls.map(c => c.path), ['/me']);
});
test('identity mismatches fail closed and foreign origins are refused before any fetch', async () => {
  const mismatch = harness('super_admin', { profile: { ok: true, status: 200, data: { id: 'other' } } });
  assert.equal((await mismatch.route.GET(mismatch.req, mismatch.ctx)).status, 401);
  const foreign = harness('super_admin', { origin: false });
  assert.equal((await foreign.route.POST(foreign.req, foreign.ctx)).status, 403);
  assert.equal(foreign.calls.length, 0);
});

test('anonymous session does not reach a shared API resource', async () => {
  const h = harness('super_admin', { profile: { ok: false, status: 401, code: 'AUTHENTICATION_FAILED' } });
  assert.equal((await h.route.GET(h.req, h.ctx)).status, 401);
  assert.deepEqual(h.calls.map(c => c.path), ['/me']);
});
