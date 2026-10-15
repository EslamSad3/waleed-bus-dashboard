import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineEndpoints, lineStopCount } from '../lib/trip-line-view.ts';

test('compact list rows display endpoints and count without a stops collection', () => {
  const row = { origin: 'Cairo', destination: 'Tanta', stopCount: 3 };
  assert.deepEqual(lineEndpoints(row), { origin: 'Cairo', destination: 'Tanta' });
  assert.equal(lineStopCount(row), 3);
});

test('full write/detail rows remain displayable in the list cache', () => {
  const row = { stops: [{ stopOrder: 2, station: { name: 'Tanta' } }, { stopOrder: 1, station: { name: 'Cairo' } }] };
  assert.deepEqual(lineEndpoints(row), { origin: 'Cairo', destination: 'Tanta' });
  assert.equal(lineStopCount(row), 2);
  assert.equal(row.stops[0].stopOrder, 2);
});

test('empty lines render without fabricated stops', () => {
  assert.deepEqual(lineEndpoints({ stops: [] }), { origin: null, destination: null });
  assert.equal(lineStopCount({ stops: [] }), 0);
  assert.deepEqual(lineEndpoints({ origin: null, destination: null }), { origin: null, destination: null });
});
