import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCriticSchedule } from './criticsData.js';

test('critic schedule tolerates a real run with fewer canned-film beats', () => {
  const schedule = buildCriticSchedule([
    { start: 0, end: 3 },
    { start: 3, end: 6 },
  ]);

  assert.ok(schedule.length > 0);
  assert.ok(schedule.every((event) => Number.isFinite(event.start)));
});
