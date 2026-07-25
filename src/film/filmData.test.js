import assert from 'node:assert/strict';
import test from 'node:test';
import { filmChunksForRun } from './filmData.js';

test('filmChunksForRun renders the submitted run beats, not canned scenes', () => {
  const chunks = filmChunksForRun({
    beats: [{
      id: 7,
      index: 0,
      start_sec: 12,
      end_sec: 27,
      type: 'reveal',
      tension_delta: 3,
      text_span: 'The submitted-script reveal lands. Nobody expected it.',
    }],
  });

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].id, 'beat_7');
  assert.equal(chunks[0].script, 'The submitted-script reveal lands. Nobody expected it.');
  assert.equal(chunks[0].type, 'REVEAL');
  assert.equal(chunks[0].duration, 15);
});
