import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { QueryClient } from '@tanstack/react-query';

function load(file, dependencies = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { module: mod, exports: mod.exports,
    require: (name) => dependencies[name] ?? {} });
  return mod.exports;
}
const http = load('../lib/actions/http.ts');
const status = load('../lib/booking-order-status.ts');
const ok = (data) => ({ ok: true, data });
const child = (id, orderId = 'order-a') => ({ id, orderId, ownerId: 'owner', tripId: 'trip',
  passengerName: 'Same passenger', passengerPhone: '01000000000', seats: 1,
  status: 'CONFIRMED', paymentStatus: 'PENDING', totalAmount: '100.00', hasReports: false });
const order = { id: 'order-a', tripId: 'trip', totalSeats: 4, totalAmount: '400.01',
  subtotalAmount: '410.01', discountAmount: '10.00', paymentMethod: 'CASH',
  createdAt: '2026-10-16T08:00:00Z', bookings: ['a', 'b', 'c', 'd'].map((id) => child(id)) };
function summaries(readPage) {
  return load('../lib/actions/booking-summaries.ts', {
    '@/lib/actions/bookings': { fetchAdminBookingsPage: readPage },
    '@/lib/actions/http': http,
    '@/lib/actions/booking-orders': { fetchAdminBookingOrder: async () => ok(order) },
    '@/lib/booking-order-status': status,
    '@/lib/i18n/t': { t: () => ', ' },
  });
}

test('four seat records become one booking with the authoritative seat count and total', async () => {
  const api = summaries(async () => ok({ items: order.bookings, nextCursor: null }));
  let reads = 0;
  const result = await api.fetchAdminBookingSummariesPage({}, null, async () => { reads++; return order; });
  assert.equal(reads, 1);
  assert.equal(result.data.items.length, 1);
  const row = result.data.items[0];
  assert.equal(row.id, 'order-a');
  assert.equal(row.seats, 4);
  assert.equal(row.totalAmount, '400.01');
  assert.equal(row.hasReports, false);
  assert.equal(row.passengerName, 'Same passenger');
});

test('seats split across API pages or matched by one passenger still show the whole booking once', async () => {
  const api = summaries(async (_filters, cursor) => ok({ items: [child(cursor ? 'd' : 'a')], nextCursor: cursor ? null : 'next' }));
  const first = await api.fetchAdminBookingSummariesPage({ passengerName: 'Same' }, null);
  const second = await api.fetchAdminBookingSummariesPage({ passengerName: 'Same' }, first.data.nextCursor);
  const rows = api.mergeBookingSummaryPages([first.data, second.data]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].seats, 4);
  assert.equal(rows[0].totalAmount, '400.01');
  assert.equal(rows[0].hasReports, null); // Other passengers' report state was not read.
});

test('separate orders and legacy bookings for the same person remain distinct', async () => {
  const api = summaries(async () => ok({ items: [child('a'), child('b', 'order-b'), child('legacy', null)], nextCursor: null }));
  const result = await api.fetchAdminBookingSummariesPage({}, null, async (id) => ({ ...order, id }));
  assert.deepEqual(Array.from(result.data.items, (row) => row.id), ['order-a', 'order-b', 'legacy']);
  assert.equal(result.data.items[2].seats, 1);
});

test('status/payment filters use the whole booking, including historical partial/mixed states', async () => {
  const mixed = { ...order, bookings: [child('a'), { ...child('b'), seats: 0, status: 'CANCELLED', paymentStatus: 'REFUND_PENDING' }] };
  const sent = [];
  const api = summaries(async (filters) => { sent.push(filters); return ok({ items: [child('a')], nextCursor: null }); });
  const excluded = await api.fetchAdminBookingSummariesPage({ status: 'CONFIRMED', paymentStatus: 'PAID' }, null, async () => mixed);
  assert.equal(excluded.data.items.length, 0);
  const included = await api.fetchAdminBookingSummariesPage({ status: 'PARTIALLY_CANCELLED', paymentStatus: 'MIXED' }, null, async () => mixed);
  assert.equal(included.data.items[0].status, 'PARTIALLY_CANCELLED');
  assert.equal(included.data.items[0].paymentStatus, 'MIXED');
  assert.equal(sent[0].status, undefined);
  assert.equal(sent[0].paymentStatus, undefined);
});

test('fully cancelled bookings retain the original total seat count', async () => {
  const api = summaries(async () => ok({ items: [child('a')], nextCursor: null }));
  const cancelled = { ...order, bookings: order.bookings.map((row) => ({ ...row, status: 'CANCELLED', seats: 0 })) };
  const result = await api.fetchAdminBookingSummariesPage({}, null, async () => cancelled);
  assert.equal(result.data.items[0].status, 'CANCELLED');
  assert.equal(result.data.items[0].seats, 4);
});

test('a failed grouped read never falls back to separate one-seat rows', async () => {
  const denied = { ok: false, message: 'Denied' };
  const api = summaries(async () => denied);
  assert.equal(await api.fetchAdminBookingSummariesPage({}, null), denied);
  const grouped = summaries(async () => ok({ items: [child('a')], nextCursor: null }));
  await assert.rejects(grouped.fetchAdminBookingSummariesPage({}, null, async () => { throw new Error('Unavailable'); }), /Unavailable/);
});

test('created-date filters use parent creation time and report evidence merges across pages', async () => {
  const sent = [];
  const api = summaries(async (filters, cursor) => {
    sent.push(filters);
    return ok({ items: cursor ? order.bookings.slice(2) : order.bookings.slice(0, 2), nextCursor: cursor ? null : 'next' });
  });
  const filters = { createdFrom: '2026-10-16T07:00:00Z', createdTo: '2026-10-16T08:00:00Z' };
  const first = await api.fetchAdminBookingSummariesPage(filters, null);
  const second = await api.fetchAdminBookingSummariesPage(filters, 'next');
  assert.equal(first.data.items[0].hasReports, null);
  const rows = api.mergeBookingSummaryPages([first.data, second.data]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].hasReports, false);
  assert.equal(sent[0].createdFrom, undefined);
  const excluded = await api.fetchAdminBookingSummariesPage({ createdFrom: '2026-10-16T08:01:00Z' }, null);
  assert.equal(excluded.data.items.length, 0);
});

test('reading many different groups uses at most three concurrent parent reads', async () => {
  const api = summaries(async () => ok({ items: Array.from({ length: 10 }, (_, i) => child(String(i), 'order-' + i)), nextCursor: null }));
  let active = 0, peak = 0;
  const result = await api.fetchAdminBookingSummariesPage({}, null, async (id) => {
    active++; peak = Math.max(peak, active);
    await new Promise(setImmediate);
    active--;
    return { ...order, id };
  });
  assert.equal(peak, 3);
  assert.equal(result.data.items.length, 10);
});

test('staff passenger actions invalidate the aggregate booking and grouped list caches', () => {
  const { qk } = load('../lib/queries.ts');
  const { applyMutationCache, bookingImpact } = load('../lib/cache/mutations.ts', { '@/lib/queries': { qk } });
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  try {
    const parentKey = qk.bookingOrder(order.id);
    const listKey = qk.adminBookingsParams({ view: 'booking-summaries' });
    client.setQueryData(parentKey, order);
    client.setQueryData(listKey, { pages: [{ items: [{ id: order.id, seats: 4 }], nextCursor: null }], pageParams: [null] });
    applyMutationCache(client, bookingImpact('owner', { id: 'a' }, 'update'), ok(child('a')));
    assert.equal(client.getQueryState(parentKey).isInvalidated, true);
    assert.equal(client.getQueryState(listKey).isInvalidated, true);
    assert.equal(client.getQueryData(parentKey).id, order.id);
    assert.equal(client.getQueryData(listKey).pages[0].items[0].seats, 4);
  } finally { client.clear(); }
});
