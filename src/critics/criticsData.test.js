import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCriticSchedule } from './criticsData.js';

test('critic schedule reveals a real note at its matching beat', () => {
  const schedule = buildCriticSchedule([
    { beatId: 9, start: 0, end: 3, duration: 3 },
    { beatId: 10, start: 3, end: 6, duration: 3 },
  ], [{ id: 'note-1', agent_id: 'editor', beat_id: 10, text: 'The reveal arrives too late.' }]);

  assert.deepEqual(schedule.map((event) => event.text), ['The reveal arrives too late.']);
  assert.ok(schedule[0].start >= 3 && schedule[0].end <= 6);
});
