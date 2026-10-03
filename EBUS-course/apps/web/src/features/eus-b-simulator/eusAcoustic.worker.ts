/// <reference lib="webworker" />
import type { AcousticControls, AcousticPose } from '@bronchoscopy-core/acoustic';
import { RENDERING_QUALITY } from '@bronchoscopy-core/quality';

import { renderEusFrame } from './eusAcoustic';
import type { EusAcousticVolume } from './types';

type Request =
  | { type: 'init'; volume: EusAcousticVolume }
  | {
      type: 'render';
      id: number;
      pose: AcousticPose;
      controls: AcousticControls;
      width: number;
      height: number;
    };

let volume: EusAcousticVolume | null = null,
  queued: Extract<Request, { type: 'render' }> | null = null,
  scheduled = false;
let averageMs = 16,
  samples = 0;

// Only the newest request is rendered; poses that arrive during a render are skipped.
self.onmessage = (event: MessageEvent<Request>) => {
  if (event.data.type === 'init') {
    volume = event.data.volume;
    return;
  }
  queued = event.data;
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    if (!volume || !queued) return;
    const request = queued;
    queued = null;
    const quality =
      samples > 20 && averageMs > 26
        ? RENDERING_QUALITY.low
        : samples > 20 && averageMs > 20
          ? RENDERING_QUALITY.balanced
          : RENDERING_QUALITY.high;
    const start = performance.now(),
      frame = renderEusFrame(
        volume,
        request.pose,
        request.controls,
        request.width,
        request.height,
        quality.acousticBeams,
        quality.acousticSamples,
      );
    averageMs = averageMs * 0.9 + (performance.now() - start) * 0.1;
    samples++;
    self.postMessage({ id: request.id, frame }, [frame.rgba.buffer, frame.labelImage.buffer]);
  }, 0);
};
