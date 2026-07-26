import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCriticSchedule } from './criticsData.js';

test('critic schedule reveals a real note at its matching beat', () => {
  const schedule = buildCriticSchedule([
    { beatId: 9, start: 0, end: 3, duration: 3 },
    { beatId: 10, start: 3, end: 6, duration: 3 },
  ], [{ id: 'note-1', agent_id: 'editor', beat_id: 10, text: 'The reveal arrives too late.' }]);

  assert.deepEqual(schedule.map((event) => event.text), ['The reveal arrives too late.']);
  assert.ok(schedule[0].start >= 3 && schedule[0].end > schedule[0].start);
});

test('critic notes on the same beat speak in sequence instead of hiding each other', () => {
  const schedule = buildCriticSchedule([
    { beatId: 9, start: 0, end: 6, duration: 6 },
    { beatId: 10, start: 6, end: 12, duration: 6 },
  ], [
    { id: 'director-1', agent_id: 'director', beat_id: 9, text: 'The turn is clear.' },
    { id: 'editor-1', agent_id: 'editor', beat_id: 9, text: 'The scene needs air.' },
    { id: 'critic-1', agent_id: 'critic', beat_id: 9, text: 'The motive is still thin.' },
  ]);

  assert.equal(schedule.length, 3);
  assert.ok(schedule[1].start >= schedule[0].end);
  assert.ok(schedule[2].start >= schedule[1].end);
});
