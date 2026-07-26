import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ApiResponseError,
  isNetworkUnavailable,
  startRun,
  waitForRun,
} from './runApi.js';

test('startRun sends the exact script and selected personas', async () => {
  let request;
  const fetcher = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({
      run_id: 'run_live01',
      status: 'analysing',
      cached: false,
    }), { status: 202, headers: { 'Content-Type': 'application/json' } });
  };

  await startRun({
    script: 'A unique submitted script.',
    personaIds: ['commuter', 'kitchen'],
    title: 'Submitted title',
  }, fetcher);

  assert.equal(request.url, 'http://localhost:8000/analyse');
  assert.deepEqual(JSON.parse(request.options.body), {
    raw_text: 'A unique submitted script.',
    title: 'Submitted title',
    persona_ids: ['commuter', 'kitchen'],
  });
});

test('waitForRun returns backend walkouts without rewriting them', async () => {
  const replies = [
    {
      run_id: 'run_live01',
      status: 'analysing',
      progress: { stage: 'SCREENING', message: 'Simulating 30 listeners', pct: 60 },
    },
    {
      run_id: 'run_live01',
      status: 'ready',
      audience: [
        { seat: 0, left_at_sec: 20 },
        { seat: 1, left_at_sec: 20 },
      ],
      drop_events: [{ id: 'de_01', seats_lost: [0, 1] }],
      summary: { seats_total: 30, seats_retained: 28 },
    },
  ];
  const fetcher = async () => new Response(
    JSON.stringify(replies.shift()),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

  const run = await waitForRun('run_live01', {
    fetcher,
    pause: async () => {},
  });

  assert.deepEqual(run.drop_events[0].seats_lost, [0, 1]);
  assert.equal(run.summary.seats_retained, 28);
  assert.equal(run.audience.filter((member) => member.left_at_sec != null).length, 2);
});

test('only a rejected request is treated as an unavailable service', () => {
  assert.equal(isNetworkUnavailable(new TypeError('Failed to fetch')), true);
  assert.equal(
    isNetworkUnavailable(new ApiResponseError('Script must contain at least 200 words.', 400)),
    false,
  );
});
