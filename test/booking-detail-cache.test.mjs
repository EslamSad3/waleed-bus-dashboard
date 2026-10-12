import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Regression test for the booking-detail cached-remount bug.
// app/(shell)/bookings/[id]/page.tsx syncs TanStack query data into local
// state during render (`booking` starts as null, `seenBooking` is the marker).
// The marker must start undefined: when the page remounts with the booking
// already in the query cache, seeding the marker with that cached data makes
// the sync condition false, `booking` stays null, and the page wrongly shows
// the not-found error card despite a cached success.
//
// The sync rule is replicated here as a pure state machine (no React needed)
// alongside a source guard on the real page file, so reintroducing the
// `useState<...>(bookingData)` seeding fails this test.

// Mirrors the render-phase sync in the page. `seed` is the useState initial
// value of the marker: undefined (fixed) or bookingData (buggy).
function createMount(seed) {
  let booking = null;
  let error = null;
  let seen = seed;
  return {
    render(bookingData, fetchFailed = null) {
      if (bookingData && bookingData !== seen) {
        seen = bookingData;
        booking = bookingData;
        error = null;
      }
      const loading = !bookingData;
      return { booking, showsError: Boolean(error || fetchFailed || !booking) };
    },
  };
}

const bookingA = { id: 'booking-a' };
const bookingB = { id: 'booking-b' };

test('cached first render syncs into local state', () => {
  const { booking, showsError } = createMount(undefined).render(bookingA);
  assert.equal(booking, bookingA);
  assert.equal(showsError, false);
});

test('uncached data arriving later syncs', () => {
  const mount = createMount(undefined);
  assert.equal(mount.render(undefined).showsError, true);
  const { booking, showsError } = mount.render(bookingB);
  assert.equal(booking, bookingB);
  assert.equal(showsError, false);
});

test('cached revisit A -> B -> A keeps showing the booking', () => {
  assert.equal(createMount(undefined).render(bookingA).booking, bookingA);
  assert.equal(createMount(undefined).render(bookingB).booking, bookingB);
  const revisit = createMount(undefined).render(bookingA);
  assert.equal(revisit.booking, bookingA);
  assert.equal(revisit.showsError, false);
});

test('unchanged refetch (same reference via structural sharing) keeps the booking shown', () => {
  const mount = createMount(undefined);
  mount.render(bookingA);
  const { booking, showsError } = mount.render(bookingA);
  assert.equal(booking, bookingA);
  assert.equal(showsError, false);
});

test('seeding the marker with cached data reproduces the bug (documents root cause)', () => {
  // Buggy init: useState(bookingData) on a remount where A is already cached.
  const { booking, showsError } = createMount(bookingA).render(bookingA);
  assert.equal(booking, null);
  assert.equal(showsError, true);
});

test('page seeds the seen-marker with undefined, not cached data', () => {
  const source = readFileSync(new URL('../app/(shell)/bookings/[id]/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /useState<AdminBookingDetail \| undefined>\(undefined\)/);
  assert.doesNotMatch(source, /useState<AdminBookingDetail \| undefined>\(bookingData\)/);
});
