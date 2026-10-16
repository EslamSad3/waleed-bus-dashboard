import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function load(file, dependencies) {
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { module: mod, exports: mod.exports, URLSearchParams,
    require: (name) => dependencies[name] ?? {} });
  return mod.exports;
}
const http = load('../lib/actions/http.ts', {});

test('calendar loads authoritative trip details with bounded concurrency, preserving cursor and order', async () => {
  const slim = Array.from({ length: 20 }, (_, id) => ({ id: String(id), ownerId: 'owner', lineId: 'line' }));
  const requests = [];
  const actions = load('../lib/actions/schedules.ts', { '@/lib/actions/http': {
    ...http, apiGet: async (path) => { requests.push(path); return { ok: true, data: { items: slim, nextCursor: 'next' } }; },
  } });
  let active = 0, peak = 0;
  const result = await actions.fetchScheduleCalendarPage('owner', 'line', 'schedule', 'current', async (row) => {
    active++; peak = Math.max(peak, active);
    await new Promise(setImmediate);
    active--;
    return { ...row, bus: { plateNumber: 'Current bus' }, driver: { name: 'Current driver' },
      stops: [{ name: 'Actual stop', scheduledAt: '2026-10-16T08:00:00Z' }] };
  });
  assert.equal(peak, 3);
  assert.deepEqual(Array.from(result.data.items, (trip) => trip.id), slim.map((trip) => trip.id));
  assert.equal(result.data.items[19].stops[0].name, 'Actual stop');
  assert.equal(result.data.nextCursor, 'next');
  assert.equal(requests[0], '/api/fleet-owners/owner/trip-lines/line/schedules/schedule/trips?cursor=current');
});

test('calendar errors remain visible instead of silently falling back to template values', async () => {
  const denied = { ok: false, message: 'Denied' };
  const actions = load('../lib/actions/schedules.ts', { '@/lib/actions/http': { ...http, apiGet: async () => denied } });
  assert.equal(await actions.fetchScheduleCalendarPage('o', 'l', 's', null, async () => { throw new Error('not called'); }), denied);
  const details = load('../lib/actions/schedules.ts', { '@/lib/actions/http': { ...http,
    apiGet: async () => ({ ok: true, data: { items: [{ id: 'trip' }], nextCursor: null } }),
  } });
  await assert.rejects(details.fetchScheduleCalendarPage('o', 'l', 's', null, async () => { throw new Error('Trip unavailable'); }), /Trip unavailable/);
});
