/// <reference lib="webworker" />
import type { AcousticControls, AcousticPose } from '@bronchoscopy-core/acoustic';

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

/** Beam grid per quality step. The grid shrinks when frames take too long on this device. */
const QUALITY = {
  high: { beams: 208, samples: 320 },
  balanced: { beams: 160, samples: 256 },
  low: { beams: 112, samples: 192 },
};

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
      samples > 20 && averageMs > 30
        ? QUALITY.low
        : samples > 20 && averageMs > 22
          ? QUALITY.balanced
          : QUALITY.high;
    const start = performance.now(),
      frame = renderEusFrame(
        volume,
        request.pose,
        request.controls,
        request.width,
        request.height,
        quality.beams,
        quality.samples,
      );
    averageMs = averageMs * 0.9 + (performance.now() - start) * 0.1;
    samples++;
    self.postMessage({ id: request.id, frame }, [frame.rgba.buffer, frame.labelImage.buffer]);
  }, 0);
};
