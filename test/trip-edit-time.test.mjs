import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toLocalDateTimeInput, editedDeparture } from '../lib/trip-edit-time.ts';
test('driver-only edits preserve departure precision in the Cairo timezone', () => {
  const before = process.env.TZ;
  process.env.TZ = 'Africa/Cairo';
  try {
    const original = '2026-10-09T20:15:56.305Z';
    assert.equal(toLocalDateTimeInput(original), '2026-10-09T23:15');
    assert.equal(editedDeparture(original, '2026-10-09T23:15'), undefined);
    assert.equal(editedDeparture(original, '2026-10-09T16:15'), '2026-10-09T13:15:00.000Z');
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
});
