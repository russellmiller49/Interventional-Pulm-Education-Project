import { describe, expect, it } from 'vitest';

import {
  getContinuousWatchDelta,
  getLectureViewedPercent,
  isLecturePlaybackComplete,
} from '@/features/lectures/watchProgress';

describe('lecture watch progress', () => {
  it('counts continuous playback and ignores seek jumps', () => {
    expect(getContinuousWatchDelta({ currentTime: 11, lastTime: 10, paused: false, playbackRate: 1 })).toBe(1);
    expect(getContinuousWatchDelta({ currentTime: 120, lastTime: 10, paused: false, playbackRate: 1 })).toBe(0);
    expect(getContinuousWatchDelta({ currentTime: 11, lastTime: 10, paused: true, playbackRate: 1 })).toBe(0);
  });

  it('requires both enough watched time and reaching the end', () => {
    expect(isLecturePlaybackComplete({ currentTime: 597, durationSeconds: 600, watchedSeconds: 570 })).toBe(true);
    expect(isLecturePlaybackComplete({ currentTime: 597, durationSeconds: 600, watchedSeconds: 120 })).toBe(false);
    expect(isLecturePlaybackComplete({ currentTime: 200, durationSeconds: 600, watchedSeconds: 570 })).toBe(false);
  });

  it('calculates viewed percent from actual watched seconds', () => {
    expect(getLectureViewedPercent({ durationSeconds: 600, watchedSeconds: 150 })).toBe(25);
    expect(getLectureViewedPercent({ durationSeconds: 600, watchedSeconds: 900 })).toBe(100);
    expect(getLectureViewedPercent({ durationSeconds: 0, watchedSeconds: 150 })).toBe(0);
  });
});
