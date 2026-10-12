import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';

const auth = new URL('../lib/auth.ts', import.meta.url).href;
const accessModule = new URL('../lib/access.ts', import.meta.url).href;
const navModule = new URL('../lib/nav-permissions.ts', import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === auth && specifier === 'next/headers') return { url: 'auth-harness:headers', shortCircuit: true };
    if ((context.parentURL === auth || context.parentURL === navModule) && specifier === './access') return { url: new URL('../lib/access.ts', import.meta.url).href, shortCircuit: true };
    if (context.parentURL === auth && specifier === './config') return { url: 'auth-harness:config', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'auth-harness:headers') return { format: 'module', source: 'export async function cookies() { return globalThis.authIdentityHarness.cookies; }', shortCircuit: true };
    if (url === 'auth-harness:config') return { format: 'module', source: 'export function busApiUrl() { return "http://api.test"; }', shortCircuit: true };
    if ([auth, accessModule, navModule].includes(url)) return { format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText, shortCircuit: true };
    return next(url, context);
  },
});
const { fetchIdentity, readSession, isDashboardRole, can } = await import(auth);
const { canNavigate, NAV_PERMISSIONS } = await import(navModule);
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; delete globalThis.authIdentityHarness; });
const id = '02200000-0000-4000-8000-000000000001';
function token(role = 'super_admin', overrides = {}, alg = 'HS256') {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg, typ: 'JWT' })}.${encode({ sub: id, email: 'admin@example.test', app_role: role, exp: Math.floor(Date.now() / 1000) + 900, ...overrides })}.signature`;
}
function backend(appRole = 'passenger', status = 200, platformPermissions) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: status === 200, json: async () => ({ data: { id, email: 'profile@example.test', appRole, platformPermissions } }) };
  };
  return calls;
}
test('identity uses app_role from the authenticated JWT rather than profile appRole', async () => {
  const calls = backend('super_admin');
  const access = token('fleet_owner');
  assert.deepEqual(await fetchIdentity(access), { id, email: 'admin@example.test', appRole: 'fleet_owner', permissions: [] });
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${access}`);
  assert.equal(calls[0].options.cache, 'no-store');
});
test('shell session reads the JWT identity after live token validation', async () => {
  backend('passenger');
  globalThis.authIdentityHarness = { cookies: { get: () => ({ value: token() }) } };
  assert.equal((await readSession()).appRole, 'super_admin');
});
test('revoked or invalid tokens never become a session from decoded claims', async () => {
  backend('super_admin', 401);
  assert.equal(await fetchIdentity(token()), null);
});
test('malformed, expired and unsupported-algorithm claims fail closed', async () => {
  const calls = backend('super_admin');
  for (const access of ['bad', token(undefined, { app_role: null }), token('super_admin', { exp: 1 }), token('super_admin', {}, 'none')]) {
    assert.equal(await fetchIdentity(access), null);
  }
  assert.equal(calls.length, 0);
});

test('dashboard admission accepts platform staff and super admins only', async () => {
  backend('super_admin');
  for (const role of ['super_admin', 'platform_staff', 'user', 'passenger', 'fleet_owner', 'fleet-manager', 'driver']) {
    const identity = await fetchIdentity(token(role));
    assert.equal(isDashboardRole(identity.appRole), ['super_admin', 'platform_staff'].includes(role));
  }
  assert.equal(isDashboardRole(undefined), false);
});

test('permissions come from /me while appRole remains the JWT claim', async () => {
  backend('passenger', 200, ['users.read', 'notifications.read']);
  const identity = await fetchIdentity(token('platform_staff'));
  assert.deepEqual(identity.permissions, ['users.read', 'notifications.read']);
  assert.equal(identity.appRole, 'platform_staff');
  assert.equal(can(identity, 'users.read'), true);
  assert.equal(can(identity, 'roles.update'), false);
});

test('missing or malformed permission lists default safely', async () => {
  for (const value of [undefined, null, 'users.read', {}]) {
    backend('platform_staff', 200, value);
    const identity = await fetchIdentity(token('platform_staff'));
    assert.deepEqual(identity.permissions, []);
    assert.equal(can(identity, 'users.read'), false);
  }
  backend('platform_staff', 200, ['users.read', null, 42]);
  assert.deepEqual((await fetchIdentity(token('platform_staff'))).permissions, ['users.read']);
});

test('super admins bypass permissions and non-dashboard roles cannot use them', async () => {
  backend('user', 200, ['users.read']);
  assert.equal(can(await fetchIdentity(token()), 'roles.update'), true);
  assert.equal(can(await fetchIdentity(token('user')), 'users.read'), false);
  assert.equal(can(null, 'users.read'), false);
});

 test('navigation uses one permission map and keeps overview available', () => {
  const staff = { appRole: 'platform_staff', permissions: [] };
  assert.equal(canNavigate(staff, '/'), true);
  assert.equal(canNavigate(staff, '/unknown'), false);
  for (const [href, permission] of Object.entries(NAV_PERMISSIONS)) {
    assert.equal(canNavigate({ appRole: 'super_admin', permissions: [] }, href), true);
    if (!permission) continue;
    assert.equal(canNavigate(staff, href), false);
    assert.equal(canNavigate({ ...staff, permissions: [permission] }, href), true);
  }
});
