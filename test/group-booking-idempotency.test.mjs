import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fingerprintOrderPayload,
  keyForPayload,
  normalizeOrderPhone,
  resolveOrderPayload,
  settleFailedPayload,
} from '../lib/booking-order-idempotency.ts';

// Regression tests for the staff grouped-order idempotency rules: the replay
// key is bound to the exact submitted payload (phone in canonical form), an
// unchanged retry reuses it, any edit mints a fresh one, the slot survives a
// simulated dialog reopen, and success clears it.

const ITEM = {
  boardingStationId: '11111111-1111-4111-8111-111111111111',
  landingStationId: '22222222-2222-4222-8222-222222222222',
  seatCount: 2,
  passengerName: 'Mona Ahmed',
  passengerPhone: '01012345678',
};

const PAYLOAD = {
  tripId: '33333333-3333-4333-8333-333333333333',
  paymentMethod: 'CASH',
  note: 'Wait near the bridge.',
  items: [ITEM],
};

test('normalizeOrderPhone keeps the canonical form', () => {
  assert.equal(normalizeOrderPhone('01012345678'), '01012345678');
});

test('normalizeOrderPhone collapses +20 and 0020 prefixes', () => {
  assert.equal(normalizeOrderPhone('+201012345678'), '01012345678');
  assert.equal(normalizeOrderPhone('00201012345678'), '01012345678');
});

test('normalizeOrderPhone strips spaces and dashes', () => {
  assert.equal(normalizeOrderPhone(' 0101 234-5678 '), '01012345678');
  assert.equal(normalizeOrderPhone('+20 101-234-5678'), '01012345678');
});

test('same payload keeps its key', () => {
  const fingerprint = fingerprintOrderPayload(PAYLOAD);
  const first = keyForPayload(new Map(), fingerprint, () => 'key-1');
  assert.equal(first.key, 'key-1');
  const retry = keyForPayload(first.pending, fingerprintOrderPayload(structuredClone(PAYLOAD)), () => 'key-2');
  assert.equal(retry.key, 'key-1');
  assert.equal(retry.pending, first.pending);
});

test('+20 phone spelling is the same payload', () => {
  const fingerprint = fingerprintOrderPayload(PAYLOAD);
  const first = keyForPayload(new Map(), fingerprint, () => 'key-1');
  const spelled = structuredClone(PAYLOAD);
  spelled.items[0].passengerPhone = '+201012345678';
  const retry = keyForPayload(first.pending, fingerprintOrderPayload(spelled), () => 'key-2');
  assert.equal(retry.key, 'key-1');
});

test('any edited field gets a new key', () => {
  const cases = [
    (p) => { p.tripId = '44444444-4444-4444-8444-444444444444'; },
    (p) => { p.paymentMethod = 'CARD'; },
    (p) => { p.note = 'Different note.'; },
    (p) => { p.note = undefined; },
    (p) => { p.items[0].landingStationId = '55555555-5555-4555-8555-555555555555'; },
    (p) => { p.items[0].seatCount = 3; },
    (p) => { p.items[0].passengerName = 'Mona  Ahmed'; },
    (p) => { p.items[0].passengerPhone = '01098765432'; },
    (p) => { p.items.push({ ...ITEM, passengerPhone: '01098765432' }); },
  ];
  for (const edit of cases) {
    const first = keyForPayload(new Map(), fingerprintOrderPayload(PAYLOAD), () => 'key-1');
    const changed = structuredClone(PAYLOAD);
    edit(changed);
    const second = keyForPayload(first.pending, fingerprintOrderPayload(changed), () => 'key-2');
    assert.equal(second.key, 'key-2');
  }
});

test('A, rejected B, restored A yields the original key', () => {
  let pending = new Map();
  const fingerprintA = fingerprintOrderPayload(PAYLOAD);
  const keys = [];
  // A commits but its response is lost.
  let step = keyForPayload(pending, fingerprintA, () => 'key-1');
  pending = step.pending;
  keys.push(step.key);
  // The operator edits to B and submits; the backend rejects it.
  const edited = structuredClone(PAYLOAD);
  edited.items[0].seatCount = 3;
  const fingerprintB = fingerprintOrderPayload(edited);
  step = keyForPayload(pending, fingerprintB, () => 'key-2');
  pending = step.pending;
  keys.push(step.key);
  // The operator restores A's values and retries: A's key is still known.
  step = keyForPayload(pending, fingerprintOrderPayload(structuredClone(PAYLOAD)), () => 'key-3');
  keys.push(step.key);
  assert.deepEqual(keys, ['key-1', 'key-2', 'key-1']);
});

test('success clears only its own entry', () => {
  let pending = new Map();
  const fingerprintA = fingerprintOrderPayload(PAYLOAD);
  const edited = structuredClone(PAYLOAD);
  edited.items[0].seatCount = 3;
  const fingerprintB = fingerprintOrderPayload(edited);
  pending = keyForPayload(pending, fingerprintA, () => 'key-1').pending;
  pending = keyForPayload(pending, fingerprintB, () => 'key-2').pending;
  // B confirms: A stays unresolved under its original key.
  pending = resolveOrderPayload(pending, fingerprintB);
  const retryA = keyForPayload(pending, fingerprintA, () => 'key-3');
  assert.equal(retryA.key, 'key-1');
  // A confirms too: a later identical order mints a fresh key.
  pending = resolveOrderPayload(retryA.pending, fingerprintA);
  const later = keyForPayload(pending, fingerprintA, () => 'key-4');
  assert.equal(later.key, 'key-4');
});

test('the 21st distinct fingerprint evicts the oldest', () => {
  let pending = new Map();
  let counter = 0;
  const fingerprints = [];
  for (let seatCount = 1; seatCount <= 21; seatCount++) {
    const payload = structuredClone(PAYLOAD);
    payload.items[0].seatCount = seatCount;
    const fingerprint = fingerprintOrderPayload(payload);
    fingerprints.push(fingerprint);
    const step = keyForPayload(pending, fingerprint, () => `key-${++counter}`);
    pending = step.pending;
  }
  assert.equal(pending.size, 20);
  // The second entry survived: retrying it reuses its key.
  const kept = keyForPayload(pending, fingerprints[1], () => `key-${++counter}`);
  assert.equal(kept.key, 'key-2');
  // The first entry was evicted: retrying it mints a new key.
  const evicted = keyForPayload(kept.pending, fingerprints[0], () => `key-${++counter}`);
  assert.equal(evicted.key, 'key-22');
});

test('a definitive rejection drops only its own entry', () => {
  let pending = new Map();
  const fingerprintA = fingerprintOrderPayload(PAYLOAD);
  const edited = structuredClone(PAYLOAD);
  edited.items[0].seatCount = 3;
  const fingerprintB = fingerprintOrderPayload(edited);
  pending = keyForPayload(pending, fingerprintA, () => 'key-1').pending;
  pending = keyForPayload(pending, fingerprintB, () => 'key-2').pending;
  pending = settleFailedPayload(pending, fingerprintB, 'PRICE_CHANGED');
  assert.equal(pending.size, 1);
  // B resubmitted is a new submission; A still reuses its original key.
  const retryB = keyForPayload(pending, fingerprintB, () => 'key-3');
  assert.equal(retryB.key, 'key-3');
  const retryA = keyForPayload(retryB.pending, fingerprintA, () => 'key-4');
  assert.equal(retryA.key, 'key-1');
});

test('an ambiguous failure keeps the entry pending', () => {
  const fingerprint = fingerprintOrderPayload(PAYLOAD);
  let pending = keyForPayload(new Map(), fingerprint, () => 'key-1').pending;
  for (const code of [undefined, 'NETWORK_ERROR', 'INTERNAL_ERROR', 'RATE_LIMITED_429', 'AUTHENTICATION_FAILED']) {
    const settled = settleFailedPayload(pending, fingerprint, code);
    assert.equal(settled, pending);
    const retry = keyForPayload(settled, fingerprint, () => 'key-2');
    assert.equal(retry.key, 'key-1');
    pending = retry.pending;
  }
});

test('lost A survives 25 definitive rejections of other payloads', () => {
  let counter = 0;
  const fingerprintA = fingerprintOrderPayload(PAYLOAD);
  let pending = keyForPayload(new Map(), fingerprintA, () => `key-${++counter}`).pending;
  assert.equal(pending.get(fingerprintA), 'key-1');
  // 25 distinct payloads rejected definitively: each settles immediately, so
  // the map never grows and A's entry is never evicted. (A itself uses
  // seatCount 2, so the loop starts at 3.)
  for (let seatCount = 3; seatCount <= 27; seatCount++) {
    const payload = structuredClone(PAYLOAD);
    payload.items[0].seatCount = seatCount;
    const fingerprint = fingerprintOrderPayload(payload);
    const step = keyForPayload(pending, fingerprint, () => `key-${++counter}`);
    pending = settleFailedPayload(step.pending, fingerprint, 'PRICE_CHANGED');
  }
  assert.equal(pending.size, 1);
  const retry = keyForPayload(pending, fingerprintA, () => `key-${++counter}`);
  assert.equal(retry.key, 'key-1');
});
