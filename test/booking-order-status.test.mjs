import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookingOrderStatus } from '../lib/booking-order-status.ts';
const status = (bookings, totalSeats = 2) => bookingOrderStatus({ bookings, totalSeats });
test('new multi-seat SELF/OTHER orders are confirmed together', () => {
  assert.equal(status([{status:'CONFIRMED',seats:1},{status:'CONFIRMED',seats:1}]), 'CONFIRMED');
});
test('whole-order cancellation remains cancelled even with zero current seats', () => {
  assert.equal(status([{status:'CANCELLED',seats:0},{status:'CANCELLED',seats:0}]), 'CANCELLED');
});
test('administrative child cancellations and legacy seat reductions show partial cancellation', () => {
  assert.equal(status([{status:'CANCELLED',seats:0},{status:'CONFIRMED',seats:1}]), 'PARTIALLY_CANCELLED');
  assert.equal(status([{status:'CONFIRMED',seats:1}]), 'PARTIALLY_CANCELLED');
});
test('completion waits for every child and keeps historical partial cancellations visible', () => {
  assert.equal(status([{status:'COMPLETED',seats:1},{status:'COMPLETED',seats:1}]), 'COMPLETED');
  assert.equal(status([{status:'CONFIRMED',seats:1},{status:'COMPLETED',seats:1}]), 'CONFIRMED');
  assert.equal(status([{status:'CANCELLED',seats:0},{status:'COMPLETED',seats:1}]), 'PARTIALLY_CANCELLED');
});
