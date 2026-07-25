import assert from 'node:assert/strict';
import test from 'node:test';
import { buildThoughtSchedule } from './thoughtData.js';

test('thought schedule uses the strongest real reaction for each live beat', () => {
  const schedule = buildThoughtSchedule([{ beatId: 7, start: 0, end: 4, duration: 4 }], [
    { cohort: 'commuter', beat_id: 7, delta: -2, text: 'Still waiting for a hook.' },
    { cohort: 'night_rider', beat_id: 7, delta: 3, text: 'Now I need to know why.' },
  ]);

  assert.equal(schedule.length, 1);
  assert.equal(schedule[0].cohort, 'night_rider');
  assert.equal(schedule[0].text, 'Now I need to know why.');
});
