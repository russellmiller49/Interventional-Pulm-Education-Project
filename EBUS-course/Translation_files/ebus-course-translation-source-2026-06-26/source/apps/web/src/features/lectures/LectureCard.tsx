import { useEffect, useRef, useState } from 'react';

import type { LectureManifestItem } from '@/content/types';
import {
  getContinuousWatchDelta,
  getLectureViewedPercent,
  isLecturePlaybackComplete,
} from '@/features/lectures/watchProgress';
import type { LectureStateUpdate, LectureWatchState } from '@/lib/progress';

function getLectureThumbnailLabel(lecture: LectureManifestItem): string {
  if (lecture.week.toLowerCase() === 'welcome') {
    return '01';
  }

  return lecture.week.replace('Lecture ', '');
}

export function LectureCard({
  lecture,
  watchState,
  locked,
  lockedReason,
  pauseToken,
  defaultExpanded = false,
  defaultPlayerExpanded = false,
  onUpdateWatchState,
  readyLabel = 'Quiz ready',
}: {
  lecture: LectureManifestItem;
  watchState?: LectureWatchState;
  locked?: boolean;
  lockedReason?: string | null;
  pauseToken?: number;
  defaultExpanded?: boolean;
  defaultPlayerExpanded?: boolean;
  onUpdateWatchState: (lectureId: string, update: LectureStateUpdate) => void;
  readyLabel?: string;
}) {
  const [posterBroken, setPosterBroken] = useState(false);
  const shouldExpandPlayerByDefault = defaultPlayerExpanded && Boolean(lecture.video || lecture.embedUrl);
  const [detailsExpanded, setDetailsExpanded] = useState(
    () => shouldExpandPlayerByDefault || (defaultExpanded && !watchState?.lastOpenedAt && !watchState?.completed),
  );
  const [videoExpanded, setVideoExpanded] = useState(() => shouldExpandPlayerByDefault);
  const [lastReportedSecond, setLastReportedSecond] = useState(() => Math.floor(watchState?.watchedSeconds ?? 0));
  const lastMediaTimeRef = useRef<number | null>(null);
  const previousPauseTokenRef = useRef(pauseToken);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const watchedSecondsRef = useRef(watchState?.watchedSeconds ?? 0);
  const isLocked = locked ?? lecture.status === 'locked';
  const hasPlayableVideo = Boolean(lecture.video || lecture.embedUrl);
  const thumbnailSrc = lecture.thumbnail ?? lecture.poster;
  const watchedSeconds = Math.max(0, Math.floor(watchState?.watchedSeconds ?? 0));
  const viewedPercent = getLectureViewedPercent({
    durationSeconds: watchState?.durationSeconds ?? 0,
    watchedSeconds,
  });
  const quizReady = Boolean(
    watchState?.completed || watchState?.quizUnlockedAt || watchState?.lastOpenedAt || watchedSeconds > 0,
  );
  const statusLabel = isLocked ? 'Locked' : watchState?.completed ? 'Fully viewed' : quizReady ? readyLabel : 'Ready';

  useEffect(() => {
    if (defaultExpanded && !watchState?.lastOpenedAt && !watchState?.completed && !isLocked) {
      setDetailsExpanded(true);
    }
  }, [defaultExpanded, isLocked, lecture.id, watchState?.completed, watchState?.lastOpenedAt]);

  useEffect(() => {
    watchedSecondsRef.current = Math.max(watchedSecondsRef.current, watchState?.watchedSeconds ?? 0);
  }, [watchState?.watchedSeconds]);

  useEffect(() => {
    return () => {
      stopLocalVideoPlayback();
    };
  }, []);

  useEffect(() => {
    if (previousPauseTokenRef.current === pauseToken) {
      return;
    }

    previousPauseTokenRef.current = pauseToken;
    stopLocalVideoPlayback();
    setVideoExpanded(false);
  }, [pauseToken]);

  function stopLocalVideoPlayback() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.pause();
    lastMediaTimeRef.current = null;
  }

  function handleTogglePlayer() {
    const nextExpanded = !videoExpanded;
    setDetailsExpanded(true);
    setVideoExpanded(nextExpanded);

    if (nextExpanded) {
      onUpdateWatchState(lecture.id, { opened: true, quizReady: true });
    } else if (watchState?.lastOpenedAt || watchState?.completed) {
      stopLocalVideoPlayback();
      setDetailsExpanded(false);
    } else {
      stopLocalVideoPlayback();
    }
  }

  function getVideoProgressUpdate(element: HTMLVideoElement, paused = element.paused) {
    const durationSeconds = Number.isFinite(element.duration) ? Math.floor(element.duration) : 0;
    const delta = getContinuousWatchDelta({
      currentTime: element.currentTime,
      lastTime: lastMediaTimeRef.current,
      paused,
      playbackRate: element.playbackRate,
    });

    lastMediaTimeRef.current = element.currentTime;
    watchedSecondsRef.current = Math.max(watchedSecondsRef.current, watchState?.watchedSeconds ?? 0) + delta;

    const nextWatchedSeconds = Math.floor(watchedSecondsRef.current);

    return {
      completed: isLecturePlaybackComplete({
        currentTime: element.currentTime,
        durationSeconds,
        watchedSeconds: nextWatchedSeconds,
      }),
      durationSeconds,
      lastPositionSeconds: Math.max(0, Math.floor(element.currentTime)),
      quizReady: true,
      watchedSeconds: nextWatchedSeconds,
    } satisfies LectureStateUpdate;
  }

  function handleVideoLoadedMetadata(event: React.SyntheticEvent<HTMLVideoElement>) {
    const element = event.currentTarget;
    const durationSeconds = Number.isFinite(element.duration) ? Math.floor(element.duration) : 0;

    onUpdateWatchState(lecture.id, {
      durationSeconds,
      lastPositionSeconds: Math.max(0, Math.floor(element.currentTime)),
      quizReady: true,
    });
  }

  function handleVideoTimeUpdate(event: React.SyntheticEvent<HTMLVideoElement>) {
    const element = event.currentTarget;
    const update = getVideoProgressUpdate(element);
    const nextWatchedSeconds = update.watchedSeconds ?? 0;
    const completed = update.completed ?? false;

    const hasInitialProgress = lastReportedSecond === 0 && nextWatchedSeconds > 0;

    if (!hasInitialProgress && nextWatchedSeconds - lastReportedSecond < 15 && !completed) {
      return;
    }

    setLastReportedSecond(nextWatchedSeconds);
    onUpdateWatchState(lecture.id, update);
  }

  function handleVideoEnded(event: React.SyntheticEvent<HTMLVideoElement>) {
    const element = event.currentTarget;
    const update = getVideoProgressUpdate(element, false);

    onUpdateWatchState(lecture.id, update);
    setDetailsExpanded(false);
    setVideoExpanded(false);
  }

  return (
    <article className={`lecture-card${isLocked ? ' lecture-card--locked' : ''}${!detailsExpanded ? ' lecture-card--collapsed' : ''}`}>
      <div className="lecture-card__header">
        {thumbnailSrc && !posterBroken ? (
          <img
            alt=""
            aria-hidden="true"
            className="lecture-card__thumb"
            onError={() => setPosterBroken(true)}
            src={thumbnailSrc}
          />
        ) : (
          <div className="lecture-card__thumb lecture-card__thumb--placeholder" aria-hidden="true">
            {getLectureThumbnailLabel(lecture)}
          </div>
        )}
        <div className="lecture-card__title-block">
          <div className="lecture-card__number">{lecture.week}</div>
          <h3>{lecture.title}</h3>
          {detailsExpanded ? <p>{lecture.subtitle}</p> : null}
        </div>
        <div className="lecture-card__meta">
          <span>{lecture.duration}</span>
          <span>{statusLabel}</span>
        </div>
        <button
          aria-expanded={detailsExpanded}
          className="lecture-card__toggle"
          onClick={() => {
            setDetailsExpanded((current) => !current);
            if (detailsExpanded) {
              stopLocalVideoPlayback();
              setVideoExpanded(false);
            }
          }}
          type="button"
        >
          {detailsExpanded ? '⌃' : '⌄'}
        </button>
      </div>

      {detailsExpanded && lecture.poster && !posterBroken ? (
        <div className="lecture-card__media">
          <img
            alt={`${lecture.title} poster`}
            onError={() => setPosterBroken(true)}
            src={lecture.poster}
          />
        </div>
      ) : null}

      {detailsExpanded ? (
        <div className="tag-row">
          {lecture.topics.map((topic) => (
            <span key={topic} className="tag">
              {topic}
            </span>
          ))}
        </div>
      ) : null}

      {detailsExpanded && !isLocked ? (
        <div className="lecture-card__actions">
          {hasPlayableVideo ? (
            <button className="button button--ghost" onClick={handleTogglePlayer} type="button">
              {videoExpanded ? 'Hide player' : 'Open player'}
            </button>
          ) : null}
          {lecture.resourceUrl ? (
            <a
              className="button button--ghost"
              href={lecture.resourceUrl}
              onClick={() => onUpdateWatchState(lecture.id, { opened: true, quizReady: true })}
              rel="noreferrer"
              target="_blank"
            >
              {lecture.resourceLabel ?? 'Open resource'}
            </a>
          ) : null}
          {!hasPlayableVideo ? (
            <button
              className="button"
              onClick={() => {
                onUpdateWatchState(lecture.id, {
                  completed: true,
                  quizReady: true,
                  opened: true,
                  watchedSeconds: Math.max(watchState?.watchedSeconds ?? 0, 60),
                });
                setDetailsExpanded(false);
              }}
              type="button"
            >
              {watchState?.completed ? 'Completed' : 'Mark reviewed'}
            </button>
          ) : null}
        </div>
      ) : isLocked ? (
        <p className="lecture-card__status">{lockedReason ?? 'Complete the previous course step to unlock this lecture.'}</p>
      ) : null}

      {videoExpanded && detailsExpanded && !isLocked ? (
        <div className="lecture-card__player">
          {lecture.embedUrl ? (
            <iframe allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" src={lecture.embedUrl} title={lecture.title} />
          ) : lecture.video ? (
            <video
              controls
              onEnded={handleVideoEnded}
              onLoadedMetadata={handleVideoLoadedMetadata}
              onTimeUpdate={handleVideoTimeUpdate}
              preload="metadata"
              ref={videoRef}
              src={lecture.video}
            />
          ) : (
            <div className="lecture-card__placeholder">
              <strong>Video slot ready</strong>
              <span>{lecture.video ?? 'Add local MP4 or embedUrl in lectures.json'}</span>
            </div>
          )}
        </div>
      ) : null}

      {!isLocked && watchState?.completedAt ? (
        <p className="lecture-card__status">Fully viewed {new Date(watchState.completedAt).toLocaleString()}</p>
      ) : !isLocked && quizReady ? (
        <p className="lecture-card__status">Viewed {viewedPercent}% ({watchedSeconds} seconds logged)</p>
      ) : null}
    </article>
  );
}
