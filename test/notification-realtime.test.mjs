import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isBookingNotificationEvent, registerNotificationConnection, closeNotificationConnection } from '../lib/notification-realtime.ts';

afterEach(closeNotificationConnection);
const event = () => ({ version: 1, type: 'booking.created', eventId: randomUUID(), notificationId: randomUUID(), bookingId: randomUUID(), tripId: randomUUID(), ownerId: randomUUID() });
test('accepts the versioned booking identifiers', () => assert.equal(isBookingNotificationEvent(event()), true));
test('rejects malformed messages before they can update the inbox or show a toast', () => {
  for (const value of [null, 'booking.created', {}, { ...event(), version: 2 }, { ...event(), type: 'other' }, { ...event(), tripId: 'not-a-uuid' }, { ...event(), bookingId: undefined }]) assert.equal(isBookingNotificationEvent(value), false);
});
test('account replacement closes the previous connection and stale cleanup preserves the current one', () => {
  let previous = 0, current = 0;
  const cleanup = registerNotificationConnection(() => previous++);
  registerNotificationConnection(() => current++);
  assert.equal(previous, 1);
  cleanup();
  assert.equal(previous, 1);
  assert.equal(current, 0);
  closeNotificationConnection();
  assert.equal(current, 1);
});
test('logout and repeated effect cleanup close only once', () => {
  let count = 0;
  const cleanup = registerNotificationConnection(() => count++);
  closeNotificationConnection(); closeNotificationConnection(); cleanup(); cleanup();
  assert.equal(count, 1);
});
