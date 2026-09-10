const MIN_PLAYBACK_DELTA_SECONDS = 0;
const MAX_PLAYBACK_DELTA_SECONDS = 2.5;
const COMPLETION_FRACTION = 0.95;
const END_PROXIMITY_SECONDS = 3;

export function getContinuousWatchDelta({
  currentTime,
  lastTime,
  paused,
  playbackRate,
}: {
  currentTime: number;
  lastTime: number | null;
  paused: boolean;
  playbackRate: number;
}) {
  if (paused || lastTime === null || !Number.isFinite(currentTime) || !Number.isFinite(lastTime)) {
    return 0;
  }

  const delta = currentTime - lastTime;
  const maxDelta = MAX_PLAYBACK_DELTA_SECONDS * Math.max(1, playbackRate || 1);

  if (delta <= MIN_PLAYBACK_DELTA_SECONDS || delta > maxDelta) {
    return 0;
  }

  return delta;
}

export function isLecturePlaybackComplete({
  currentTime,
  durationSeconds,
  watchedSeconds,
}: {
  currentTime: number;
  durationSeconds: number;
  watchedSeconds: number;
}) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return false;
  }

  const watchedEnough = watchedSeconds >= Math.max(1, Math.floor(durationSeconds * COMPLETION_FRACTION));
  const reachedEnd = currentTime >= Math.max(0, durationSeconds - END_PROXIMITY_SECONDS);

  return watchedEnough && reachedEnd;
}

export function getLectureViewedPercent({
  durationSeconds,
  watchedSeconds,
}: {
  durationSeconds: number;
  watchedSeconds: number;
}) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((Math.max(0, watchedSeconds) / durationSeconds) * 100)));
}
