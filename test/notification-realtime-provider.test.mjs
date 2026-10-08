import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';

// Exercise the real shell effect with controlled external transports and clock.
// No browser session or provider credentials are needed by this harness.
const component = new URL('../components/notifications/notification-realtime.tsx', import.meta.url).href;
const helpers = new URL('../lib/notification-realtime.ts', import.meta.url).href;
const virtual = {
  react: 'export const useEffect = effect => globalThis.notificationHarness.effects.push(effect);',
  sonner: 'export const toast = (...args) => globalThis.notificationHarness.toasts.push(args);',
  'next/navigation': 'export const useRouter = () => ({ push: (href) => globalThis.notificationHarness.navigations.push(href) });',
  '@/lib/actions/notifications': "export const fetchMyNotifications = async () => ({ ok: true, data: { items: [{ id: globalThis.notificationHarness.lastNotificationId, title: 'Stored title', body: 'Stored body' }], nextCursor: null } }); export const markNotificationRead = async () => ({ ok: true });",
  '@/lib/notification-sound': 'export const playNotificationSound = () => { globalThis.notificationHarness.sounds++; }; export const unlockNotificationSound = () => {};',
  '@/lib/queries': 'export const useQueryClient = () => globalThis.notificationHarness.client;',
  '@/lib/i18n/t': 'export const t = key => key;',
  ably: 'export const Realtime = class {constructor(options) {return globalThis.notificationHarness.makeRealtime(options)}};',
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === component && specifier in virtual) return { url: `notification-harness:${specifier}`, shortCircuit: true };
    if (context.parentURL === component && specifier === '@/lib/notification-realtime') return { url: helpers, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('notification-harness:')) return { format: 'module', source: virtual[url.slice('notification-harness:'.length)], shortCircuit: true };
    if (url === component) return { format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText, shortCircuit: true };
    return next(url, context);
  },
});
const { NotificationRealtime } = await import(component);
const originalFetch = globalThis.fetch;
let cleanup;
afterEach(() => { cleanup?.(); cleanup = undefined; globalThis.fetch = originalFetch; delete globalThis.window; delete globalThis.document; delete globalThis.notificationHarness; });
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); };

function setup(ok = true) {
  const userId = randomUUID();
  const state = { userId, version: 1, ok, effects: [], toasts: [], navigations: [], sounds: 0, lastNotificationId: null, invalidations: [], requests: [], instances: [], channels: new Map(), listeners: new Map(), timer: null, cleared: false };
  state.client = { invalidateQueries: async (options) => { state.invalidations.push(options); } };
  state.makeRealtime = (options) => {
    const instance = { options, closed: 0, connection: { on: (name, listener) => state.listeners.set(`ably:${name}`, listener) },
      close: () => instance.closed++, channels: { get: (name) => {
        if (!state.channels.has(name)) state.channels.set(name, { name, unsubscribed: 0, detached: 0, subscribe: async (event, receive) => { const ch = state.channels.get(name); ch.event = event; ch.receive = receive; }, unsubscribe: () => { state.channels.get(name).unsubscribed++; }, detach: async () => { state.channels.get(name).detached++; } });
        return state.channels.get(name);
      } } };
    state.instances.push(instance);
    return instance;
  };
  globalThis.notificationHarness = state;
  globalThis.fetch = async (url, options) => { state.requests.push({ url, options }); return { ok: state.ok, json: async () => ({ data: { channel: `notifications:user:${userId}:v${state.version}`, tokenRequest: { clientId: userId, ttl: 300000 } } }) }; };
  globalThis.window = { addEventListener: () => {}, removeEventListener: () => {}, setInterval: (fn, milliseconds) => { state.timer = { fn, milliseconds }; return 1; }, clearInterval: () => { state.cleared = true; } };
  globalThis.document = { visibilityState: 'visible', addEventListener: (name, listener) => state.listeners.set(name, listener), removeEventListener: (name) => state.listeners.delete(name) };
  NotificationRealtime({ userId });
  cleanup = state.effects[0]();
  return state;
}

test('private subscription reconciles current data and shows one toast for duplicate booking events', async () => {
  const s = setup(); await settle();
  assert.equal(s.instances.length, 1);
  assert.equal(s.requests[0].options.cache, 'no-store');
  assert.equal(s.requests[0].options.method, 'POST');
  const channel = s.channels.get(`notifications:user:${s.userId}:v1`);
  assert.equal(channel.event, 'booking.created');
  const data = { version: 1, type: 'booking.created', eventId: randomUUID(), notificationId: randomUUID(), bookingId: randomUUID(), tripId: randomUUID(), ownerId: randomUUID() };
  s.lastNotificationId = data.notificationId;
  channel.receive({ data }); channel.receive({ data }); channel.receive({ data: { ...data, version: 2 } });
  await settle();
  assert.equal(s.toasts.length, 1);
  assert.equal(s.sounds, 1);
  assert.equal(s.toasts[0][0], 'Stored title');
  assert.equal(s.toasts[0][1].description, 'Stored body');
  s.toasts[0][1].action.onClick();
  assert.deepEqual(s.navigations, [`/bookings/${data.bookingId}`]);
  assert.equal(s.invalidations.length, 1);
  assert.equal(s.invalidations[0].predicate({ queryKey: ['my-notifications'] }), true);
  assert.equal(s.invalidations[0].predicate({ queryKey: ['bookings'] }), true);
  assert.equal(s.invalidations[0].predicate({ queryKey: ['trip'] }), true);
  s.listeners.get('ably:connected')();
  assert.equal(s.invalidations.length, 2);
});
test('auth renewal changes subscription when the current authVersion changes', async () => {
  const s = setup(); await settle();
  const authenticate = () => new Promise((resolve, reject) => s.instances[0].options.authCallback({}, (error, token) => error ? reject(new Error(error)) : resolve(token)));
  assert.equal((await authenticate()).clientId, s.userId);
  s.version = 2;
  assert.equal((await authenticate()).clientId, s.userId);
  const old = s.channels.get(`notifications:user:${s.userId}:v1`);
  assert.equal(old.unsubscribed, 1); assert.equal(old.detached, 1);
  assert.equal(s.channels.get(`notifications:user:${s.userId}:v2`).event, 'booking.created');
});
test('foreground REST fallback remains available after delegation fails and cleanup stops it', async () => {
  const s = setup(false); await settle();
  assert.equal(s.instances.length, 0);
  assert.equal(s.timer.milliseconds, 30000);
  s.timer.fn(); assert.equal(s.invalidations.length, 1);
  document.visibilityState = 'hidden'; s.timer.fn(); assert.equal(s.invalidations.length, 1);
  document.visibilityState = 'visible'; s.listeners.get('visibilitychange')(); assert.equal(s.invalidations.length, 2);
  cleanup(); s.timer.fn(); assert.equal(s.invalidations.length, 2); assert.equal(s.cleared, true);
});
test('a failed first delegation reconnects automatically after the API recovers', async () => {
  const s = setup(false); await settle();
  assert.equal(s.instances.length, 0);
  s.ok = true;
  s.timer.fn(); await settle();
  assert.equal(s.instances.length, 1);
  assert.equal(s.channels.get(`notifications:user:${s.userId}:v1`).event, 'booking.created');
  s.timer.fn(); await settle();
  assert.equal(s.instances.length, 1, 'foreground polling must not create duplicate connections');
});
test('a terminal transport failure reconnects on the next foreground sync', async () => {
  const s = setup(); await settle();
  s.listeners.get('ably:failed')();
  assert.equal(s.instances[0].closed, 1);
  s.timer.fn(); await settle();
  assert.equal(s.instances.length, 2);
});
test('logout after failed startup prevents a later recovery from reopening realtime', async () => {
  const s = setup(false); await settle();
  const { closeNotificationConnection } = await import(helpers);
  closeNotificationConnection();
  s.ok = true; s.timer.fn(); await settle();
  assert.equal(s.instances.length, 0);
});
test('logout closes the shared transport once and drops subsequent events', async () => {
  const s = setup(); await settle();
  const { closeNotificationConnection } = await import(helpers);
  closeNotificationConnection(); cleanup();
  assert.equal(s.instances[0].closed, 1);
  s.listeners.get('ably:connected')();
  assert.equal(s.invalidations.length, 0);
});
test('unmount during authentication prevents a late connection from being created', async () => {
  const s = setup(); cleanup(); await settle();
  assert.equal(s.instances.length, 0);
  assert.equal(s.cleared, true);
});
