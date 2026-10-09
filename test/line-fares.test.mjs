import { test } from 'node:test';
import assert from 'node:assert/strict';
import { farePairs, faresPayload, fareKey } from '../lib/line-fares.ts';
const stops = [
  { stationId: 'a', name: 'Munib', stopOrder: 1, stopType: 'BOARDING' },
  { stationId: 'b', name: 'Haram', stopOrder: 2, stopType: 'LANDING' },
  { stationId: 'c', name: 'Beni Suef', stopOrder: 3, stopType: 'BOARDING' },
  { stationId: 'd', name: 'Minya', stopOrder: 4, stopType: 'LANDING' },
];
test('matrix offers downstream pairs and keeps prices through reordered stations', () => {
  const pairs = farePairs(stops);
  assert.deepEqual(pairs.map(fareKey), ['a:b', 'a:d', 'c:d']);
  const prices = { 'a:b': '30.00', 'a:d': '200.00', 'c:d': '100.00' };
  const edited = farePairs(stops.filter(s => s.stationId !== 'b'));
  assert.deepEqual(faresPayload(edited, prices).map(p => p.unitFare), ['200.00', '100.00']);
});
test('frozen trip requirements remain editable without creating duplicate cells', () => {
  const previous = farePairs(stops);
  const edited = farePairs(stops.filter(s => s.stationId !== 'b'), previous);
  assert.equal(edited.length, 3);
  assert.equal(edited.find(p => fareKey(p) === 'a:b').scope, 'FROZEN_TRIP');
  assert.equal(faresPayload(edited, {}).every(p => p.unitFare === ''), true);
});
test('dual capability rows do not produce same-station prices', () => {
  const pairs = farePairs([...stops, { ...stops[3], stopOrder: 5, stopType: 'BOARDING' }]);
  assert.deepEqual(pairs.map(fareKey), ['a:b', 'a:d', 'c:d']);
});
