import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { QueryClient } from '@tanstack/react-query';

function load(file, dependencies) {
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { module: mod, exports: mod.exports, require: (name) => dependencies[name] ?? {} });
  return mod.exports;
}
const { qk } = load('../lib/queries.ts', {});
const cache = load('../lib/cache/mutations.ts', { '@/lib/queries': { qk } });
const trip = { id: 'trip-a', ownerId: 'owner-a', lineId: 'line-a', bus: { plateNumber: 'OLD' },
  driver: { id: 'old-driver' }, stops: [{ name: 'Old stop', scheduledAt: '2026-10-16T08:00:00Z' }] };
const changed = { ...trip, bus: { plateNumber: 'NEW' }, driver: { id: 'new-driver' },
  line: { id: 'line-a', name: 'Current route' }, stops: [{ name: 'New stop', scheduledAt: '2026-10-16T09:00:00Z' }] };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const key = qk.scheduleTrips('owner-a', 'line-a', 'schedule-a');
  client.setQueryData(key, { pages: [{ items: [{ ...trip, id: 'unrelated' }], nextCursor: 'next' },
    { items: [trip], nextCursor: null }], pageParams: [null, 'next'] });
  return { client, key };
}

test('saving a trip immediately updates its calendar row on any cached page and invalidates it', () => {
  const { client, key } = setup();
  try {
    cache.applyMutationCache(client, cache.tripImpact({ trip: changed, mode: 'update' }), { ok: true, data: changed });
    const data = client.getQueryData(key);
    assert.deepEqual(JSON.parse(JSON.stringify(data.pages[1].items[0])), changed);
    assert.equal(data.pages[0].items[0].bus.plateNumber, 'OLD');
    assert.deepEqual(data.pageParams, [null, 'next']);
    assert.equal(client.getQueryState(key).isInvalidated, true);
  } finally { client.clear(); }
});

test('deleting a trip removes only that trip from cached calendar pages', () => {
  const { client, key } = setup();
  try {
    cache.applyMutationCache(client, cache.tripImpact({ trip, mode: 'remove' }), { ok: true, data: null });
    assert.equal(client.getQueryData(key).pages[1].items.length, 0);
    assert.equal(client.getQueryData(key).pages[0].items.length, 1);
  } finally { client.clear(); }
});

test('rejected trip edits preserve the calendar cache', () => {
  const { client, key } = setup();
  try {
    cache.applyMutationCache(client, cache.tripImpact({ trip, mode: 'update' }), { ok: false, message: 'Denied' });
    assert.deepEqual(client.getQueryData(key).pages[1].items[0], trip);
    assert.equal(client.getQueryState(key).isInvalidated, false);
  } finally { client.clear(); }
});

test('bus, driver, route and station edits invalidate the calendar and its cached trip details', () => {
  const impacts = [cache.busImpact({ id: 'bus-a', ownerId: 'owner-a' }, 'update'),
    cache.driverImpact({ driver: { id: 'driver-a', ownerId: 'owner-a', userId: 'driver-user' }, mode: 'update' }),
    cache.tripLineImpact('owner-a', { id: 'line-a' }, 'update'),
    cache.referenceImpact('station-a', 'stations', 'update')];
  for (const impact of impacts) {
    const { client, key } = setup();
    try {
      const detailKey = qk.trip(trip.ownerId, trip.lineId, trip.id);
      client.setQueryData(detailKey, trip);
      cache.applyMutationCache(client, impact, { ok: true, data: { id: impact.row.id, name: 'Changed' } });
      assert.equal(client.getQueryState(key).isInvalidated, true);
      assert.equal(client.getQueryState(detailKey).isInvalidated, true);
      assert.deepEqual(client.getQueryData(key).pages[1].items[0], trip); // No cross-resource merges.
    } finally { client.clear(); }
  }
});
