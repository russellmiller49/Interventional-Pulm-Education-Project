import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getKnobologyVideoSegmentEnd,
  getKnobologyVideoSegmentStart,
  type KnobologyVideoSegment,
} from '@/features/knobology/videoSegments';

const SEGMENT_START_OFFSET_SECONDS = 0.025;
const SEGMENT_LOOP_MARGIN_SECONDS = 0.045;

type VideoLayerId = 0 | 1;

interface KnobologySegmentVideoProps {
  ariaLabel: string;
  className: string;
  paused?: boolean;
  segment: KnobologyVideoSegment;
  src: string;
}

interface VideoLayerState {
  id: VideoLayerId;
  segment: KnobologyVideoSegment | null;
  src: string | null;
}

interface KnobologySegmentVideoLayerProps {
  active: boolean;
  ariaLabel: string;
  className: string;
  id: VideoLayerId;
  onReady: (id: VideoLayerId, src: string, segmentName: string) => void;
  paused: boolean;
  segment: KnobologyVideoSegment | null;
  src: string | null;
}

function getSegmentStart(segment: KnobologyVideoSegment): number {
  return getKnobologyVideoSegmentStart(segment) + SEGMENT_START_OFFSET_SECONDS;
}

function isSameVideoSegment(
  layer: Pick<VideoLayerState, 'segment' | 'src'>,
  src: string,
  segment: KnobologyVideoSegment,
) {
  return layer.src === src && layer.segment?.name === segment.name;
}

function KnobologySegmentVideoLayer({
  active,
  ariaLabel,
  className,
  id,
  onReady,
  paused,
  segment,
  src,
}: KnobologySegmentVideoLayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !segment || !src) {
      return undefined;
    }

    let cancelled = false;
    const start = getSegmentStart(segment);
    const isAtSegmentStart = () => Math.abs(video.currentTime - start) < 0.12;
    const reportReady = () => {
      if (!cancelled && isAtSegmentStart() && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        onReady(id, src, segment.name);
      }
    };
    const playIfAllowed = () => {
      if (pausedRef.current) {
        video.pause();
      } else {
        void video.play().catch(() => undefined);
      }
    };
    const seekToSegmentStart = () => {
      try {
        video.currentTime = start;
      } catch {
        // Some browsers briefly reject seeks while a new source is still initializing.
      }

      playIfAllowed();
      reportReady();
    };
    const handleLoadedMetadata = () => seekToSegmentStart();
    const handleReadyFrame = () => reportReady();

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleReadyFrame);
    video.addEventListener('canplay', handleReadyFrame);
    video.addEventListener('seeked', handleReadyFrame);

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      seekToSegmentStart();
    }

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleReadyFrame);
      video.removeEventListener('canplay', handleReadyFrame);
      video.removeEventListener('seeked', handleReadyFrame);
    };
  }, [id, onReady, segment, src]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !src) {
      return;
    }

    if (paused) {
      video.pause();
      return;
    }

    void video.play().catch(() => undefined);
  }, [paused, src]);

  useEffect(() => {
    const video = videoRef.current;
    let animationFrame = 0;

    if (!video || !segment || !src || paused) {
      return undefined;
    }

    const start = getSegmentStart(segment);
    const end = getKnobologyVideoSegmentEnd(segment);

    const loopWithinSegment = () => {
      if (video.currentTime < start - 0.2 || video.currentTime >= end - SEGMENT_LOOP_MARGIN_SECONDS) {
        video.currentTime = start;
      }

      animationFrame = window.requestAnimationFrame(loopWithinSegment);
    };

    animationFrame = window.requestAnimationFrame(loopWithinSegment);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [paused, segment, src]);

  return (
    <video
      ref={videoRef}
      aria-hidden={!active}
      aria-label={active ? ariaLabel : undefined}
      autoPlay={!paused}
      className={`${className} knobology-segment-video__layer${
        active ? ' knobology-segment-video__layer--active' : ''
      }`}
      muted
      playsInline
      preload="auto"
      src={src ?? undefined}
    />
  );
}

export function KnobologySegmentVideo({
  ariaLabel,
  className,
  paused = false,
  segment,
  src,
}: KnobologySegmentVideoProps) {
  const requestedVideoRef = useRef({ segment, src });
  const [activeLayerId, setActiveLayerId] = useState<VideoLayerId>(0);
  const [layers, setLayers] = useState<[VideoLayerState, VideoLayerState]>(() => [
    { id: 0, segment, src },
    { id: 1, segment: null, src: null },
  ]);

  useEffect(() => {
    requestedVideoRef.current = { segment, src };

    setLayers((currentLayers) => {
      const activeLayer = currentLayers.find((layer) => layer.id === activeLayerId) ?? currentLayers[0];

      if (isSameVideoSegment(activeLayer, src, segment)) {
        return currentLayers.map((layer) =>
          layer.id === activeLayerId ? { ...layer, segment, src } : layer,
        ) as [VideoLayerState, VideoLayerState];
      }

      const bufferLayerId: VideoLayerId = activeLayerId === 0 ? 1 : 0;

      return currentLayers.map((layer) =>
        layer.id === bufferLayerId ? { ...layer, segment, src } : layer,
      ) as [VideoLayerState, VideoLayerState];
    });
  }, [activeLayerId, segment, src]);

  const handleLayerReady = useCallback((layerId: VideoLayerId, readySrc: string, readySegmentName: string) => {
    const requestedVideo = requestedVideoRef.current;

    if (requestedVideo.src === readySrc && requestedVideo.segment.name === readySegmentName) {
      setActiveLayerId(layerId);
    }
  }, []);

  return (
    <>
      {layers.map((layer) => (
        <KnobologySegmentVideoLayer
          key={layer.id}
          active={layer.id === activeLayerId}
          ariaLabel={ariaLabel}
          className={className}
          id={layer.id}
          onReady={handleLayerReady}
          paused={paused}
          segment={layer.segment}
          src={layer.src}
        />
      ))}
    </>
  );
}
