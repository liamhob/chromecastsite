import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCueTiming,
  calculateTwoPointCalibration,
  findActiveCues,
  formatMsToWebVtt,
  parseSubtitleText,
  parseTimestampToMs,
  serializeWebVTT,
} from './subtitleEngine';

test('parseTimestampToMs parses SRT comma and WebVTT dot formats', () => {
  assert.equal(parseTimestampToMs('00:01:23,450'), 83450);
  assert.equal(parseTimestampToMs('01:02:03.005'), 3723005);
  assert.equal(parseTimestampToMs('02:10.5'), 130500);
  assert.equal(parseTimestampToMs('invalid'), null);
});

test('parseSubtitleText extracts sorted cues from SRT and WebVTT', () => {
  const srt = `
1
00:00:05,000 --> 00:00:08,500
The midnight train never stops at Shibuya.

2
00:00:01,200 --> 00:00:04,000
<i>Wait for the signal.</i>
`;
  const cues = parseSubtitleText(srt);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].startMs, 1200);
  assert.equal(cues[0].text, 'Wait for the signal.');
  assert.equal(cues[1].startMs, 5000);
});

test('applyCueTiming clamps negative shifted start times to 0', () => {
  const cue = {id: 'c1', startMs: 1000, endMs: 3000, text: 'Hello'};
  const shifted = applyCueTiming(cue, -1500, 1);
  assert.equal(shifted.startMs, 0);
  assert.equal(shifted.endMs, 1500);
});

test('findActiveCues locates active and overlapping cues accurately with offset', () => {
  const cues = [
    {id: '1', startMs: 2000, endMs: 5000, text: 'Line one'},
    {id: '2', startMs: 4000, endMs: 7000, text: 'Line two overlapping'},
    {id: '3', startMs: 10000, endMs: 12000, text: 'Line three'},
  ];

  // With +500ms offset, cue 1 is [2500, 5500], cue 2 is [4500, 7500]
  const at5s = findActiveCues(cues, 5000, 500, 1);
  assert.equal(at5s.length, 2);
  assert.deepEqual(
    at5s.map((c) => c.id),
    ['1', '2']
  );

  const at9s = findActiveCues(cues, 9000, 500, 1);
  assert.equal(at9s.length, 0);
});

test('calculateTwoPointCalibration computes exact linear drift scale and offset', () => {
  // Source timestamps at 10s and 1010s mapped to 12s and 1052s (rateScale = 1.04, offset = +1600ms)
  const result = calculateTwoPointCalibration(10_000, 12_000, 1_010_000, 1_052_000);
  assert.ok(result);
  assert.equal(result.rateScale, 1.04);
  assert.equal(result.offsetMs, 1600);

  assert.equal(calculateTwoPointCalibration(10_000, 12_000, 10_000, 15_000), null);
});

test('serializeWebVTT outputs valid WebVTT with shifted timecodes', () => {
  const cues = [{id: 'c1', startMs: 1000, endMs: 3500, text: 'Test subtitle'}];
  const vtt = serializeWebVTT(cues, 750, 1);
  assert.ok(vtt.startsWith('WEBVTT'));
  assert.ok(vtt.includes('00:00:01.750 --> 00:00:04.250'));
  assert.ok(vtt.includes('Test subtitle'));
  assert.equal(formatMsToWebVtt(61_250), '00:01:01.250');
});
