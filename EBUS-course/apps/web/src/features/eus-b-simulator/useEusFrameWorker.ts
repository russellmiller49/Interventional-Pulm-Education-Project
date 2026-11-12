import { useEffect, useRef, useState } from 'react';
import type { AcousticControls, AcousticPose } from '@bronchoscopy-core/acoustic';

import type { EusAcousticFrame } from './eusAcoustic';
import type { EusAcousticVolume } from './types';

export const EUS_FRAME_SIZE = 512;
/** Shortest gap between two render requests. */
const REQUEST_GAP_MS = 33;

export interface EusFrameRequest<Tag> {
  pose: AcousticPose;
  controls: AcousticControls;
  /** Travels with the request and comes back with its frame, so a caller can tell what it shows. */
  tag: Tag;
}

export interface EusWorkerFrame<Tag> {
  frame: EusAcousticFrame | null;
  /** The tag of the request the current frame was drawn for. */
  tag: Tag | null;
  renderError: string | null;
}

/**
 * Renders the ultrasound image for the newest request in one web worker.
 *
 * The worker is created once for the volume and kept for the life of the hook: starting one copies
 * the whole label volume, so a caller must not remount this hook between tasks. Requests are sent
 * at most every 33 ms and only the newest one's frame is kept.
 */
export function useEusFrameWorker<Tag>(
  volume: EusAcousticVolume,
  request: EusFrameRequest<Tag>,
  size = EUS_FRAME_SIZE,
): EusWorkerFrame<Tag> {
  const worker = useRef<Worker | null>(null),
    sequence = useRef(0),
    sentTag = useRef<Tag | null>(null),
    scheduled = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desired = useRef(request);
  desired.current = request;
  const [state, setState] = useState<{ frame: EusAcousticFrame | null; tag: Tag | null }>({
    frame: null,
    tag: null,
  });
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const send = () => {
      sentTag.current = desired.current.tag;
      worker.current?.postMessage({
        type: 'render',
        id: ++sequence.current,
        pose: desired.current.pose,
        controls: desired.current.controls,
        width: size,
        height: size,
      });
    };
    const instance = new Worker(new URL('./eusAcoustic.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.current = instance;
    instance.onmessage = (event: MessageEvent<{ id: number; frame: EusAcousticFrame }>) => {
      // A frame for an older request is dropped: a newer one is already on its way.
      if (event.data.id !== sequence.current) return;
      setState({ frame: event.data.frame, tag: sentTag.current });
    };
    instance.onerror = () => setRenderError('Ultrasound rendering could not start. Reload to retry.');
    // The worker owns its own copy; the page keeps the volume for overlays and area checks.
    const data = volume.data.slice();
    instance.postMessage({ type: 'init', volume: { ...volume, data } }, [data.buffer]);
    send();
    return () => {
      instance.terminate();
      worker.current = null;
      if (scheduled.current) clearTimeout(scheduled.current);
      scheduled.current = null;
    };
  }, [volume, size]);

  const { pose, controls } = request;
  useEffect(() => {
    if (!worker.current || scheduled.current) return;
    scheduled.current = setTimeout(() => {
      scheduled.current = null;
      sentTag.current = desired.current.tag;
      worker.current?.postMessage({
        type: 'render',
        id: ++sequence.current,
        pose: desired.current.pose,
        controls: desired.current.controls,
        width: size,
        height: size,
      });
    }, REQUEST_GAP_MS);
  }, [pose, controls, size]);

  return { frame: state.frame, tag: state.tag, renderError };
}
