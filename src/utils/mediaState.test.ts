import test from 'node:test';
import assert from 'node:assert/strict';
import type {AnimeSeries, PlaylistItem} from '../types/media';
import {
  computeSeriesProgress,
  enqueueMediaItem,
  formatTimecode,
  removePlaylistItem,
  reorderPlaylist,
  toggleEpisodeOfflineCache,
  toggleEpisodeWatched,
  validateStreamUrl,
} from './mediaState';

const samplePlaylist: PlaylistItem[] = [
  {
    id: 'p1',
    title: 'Episode 1',
    subtitle: 'Series A',
    streamUrl: 'https://stream.kurocast.app/a/ep1.m3u8',
    posterUrl: '/poster.jpg',
    durationSec: 1440,
    quality: '2160p',
    offlineCached: true,
    sizeMb: 680,
  },
  {
    id: 'p2',
    title: 'Episode 2',
    subtitle: 'Series A',
    streamUrl: 'https://stream.kurocast.app/a/ep2.m3u8',
    posterUrl: '/poster.jpg',
    durationSec: 1440,
    quality: '2160p',
    offlineCached: false,
    sizeMb: 710,
  },
  {
    id: 'p3',
    title: 'Episode 3',
    subtitle: 'Series A',
    streamUrl: 'https://stream.kurocast.app/a/ep3.m3u8',
    posterUrl: '/poster.jpg',
    durationSec: 1440,
    quality: '1080p',
    offlineCached: false,
    sizeMb: 420,
  },
];

const sampleCatalog: AnimeSeries[] = [
  {
    id: 's1',
    title: 'Nocturne Express',
    japaneseTitle: '夜行列車',
    studio: 'Studio Kiri',
    year: 2025,
    score: 8.9,
    genres: ['Mystery', 'Drama'],
    status: 'plan-to-watch',
    synopsis: 'A midnight commuter train traverses forgotten stations.',
    posterUrl: '/poster.jpg',
    episodes: [
      {
        id: 'ep1',
        seriesId: 's1',
        number: 1,
        title: 'Last Platform',
        durationSec: 1440,
        watched: false,
        resumeSec: 0,
        streamUrl: 'https://stream.kurocast.app/ne/ep1.m3u8',
        sizeMb: 640,
        offlineCached: false,
        airedDate: '2025-10-04',
        chapters: [],
      },
      {
        id: 'ep2',
        seriesId: 's1',
        number: 2,
        title: 'Rain Over Odaiba',
        durationSec: 1440,
        watched: false,
        resumeSec: 0,
        streamUrl: 'https://stream.kurocast.app/ne/ep2.m3u8',
        sizeMb: 660,
        offlineCached: false,
        airedDate: '2025-10-11',
        chapters: [],
      },
    ],
  },
];

test('validateStreamUrl rejects empty or non-http URLs and accepts valid HLS URLs', () => {
  assert.equal(validateStreamUrl('').valid, false);
  assert.equal(validateStreamUrl('not-a-url').valid, false);
  assert.equal(validateStreamUrl('ftp://example.com/file.m3u8').valid, false);
  const ok = validateStreamUrl('https://cdn.example.com/live/master.m3u8');
  assert.equal(ok.valid, true);
  assert.equal(ok.normalized, 'https://cdn.example.com/live/master.m3u8');
});

test('reorderPlaylist moves items up/down and respects bounds', () => {
  const movedUp = reorderPlaylist(samplePlaylist, 'p2', 'up');
  assert.deepEqual(
    movedUp.map((i) => i.id),
    ['p2', 'p1', 'p3']
  );

  const atTop = reorderPlaylist(samplePlaylist, 'p1', 'up');
  assert.deepEqual(
    atTop.map((i) => i.id),
    ['p1', 'p2', 'p3']
  );

  const movedDown = reorderPlaylist(samplePlaylist, 'p2', 'down');
  assert.deepEqual(
    movedDown.map((i) => i.id),
    ['p1', 'p3', 'p2']
  );
});

test('enqueueMediaItem deduplicates and removePlaylistItem updates active item safely', () => {
  const deduped = enqueueMediaItem(samplePlaylist, samplePlaylist[0]);
  assert.equal(deduped.length, 3);

  const removed = removePlaylistItem(samplePlaylist, 'p1', 'p1');
  assert.equal(removed.items.length, 2);
  assert.equal(removed.nextActiveId, 'p2');
});

test('toggleEpisodeWatched updates counts and transitions watchlist status automatically', () => {
  const step1 = toggleEpisodeWatched(sampleCatalog, 's1', 'ep1');
  assert.equal(step1[0].status, 'watching');
  assert.equal(computeSeriesProgress(step1[0]).percent, 50);

  const step2 = toggleEpisodeWatched(step1, 's1', 'ep2');
  assert.equal(step2[0].status, 'completed');
  assert.equal(computeSeriesProgress(step2[0]).percent, 100);

  const step3 = toggleEpisodeOfflineCache(step2, 's1', 'ep1');
  assert.equal(computeSeriesProgress(step3[0]).offlineCount, 1);
  assert.equal(computeSeriesProgress(step3[0]).offlineMb, 640);
});

test('formatTimecode formats mm:ss and hh:mm:ss cleanly', () => {
  assert.equal(formatTimecode(65), '01:05');
  assert.equal(formatTimecode(3661), '1:01:01');
  assert.equal(formatTimecode(-5), '00:00');
});
