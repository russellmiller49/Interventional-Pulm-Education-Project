import {
  coherentSpeckle,
  type AcousticControls,
  type AcousticPose,
} from '@bronchoscopy-core/acoustic';

import type { EusAcousticVolume, EusMedium } from './types';

/**
 * EUS-B ultrasound rendering.
 *
 * This is the EBUS simulator's pulse-echo model (src/lib/bronchoscopy-core/acoustic.ts) with a
 * wider tissue table: fat, bone, fluid and the upper-abdominal organs seen from the stomach. It is
 * kept beside the shared renderer rather than inside it so the reviewed EBUS images cannot shift
 * when these values are tuned.
 *
 * The values are authored for teaching contrast between tissue classes. They are not measured
 * acoustic properties and the image is not a diagnostic ultrasound simulation.
 */
interface Medium {
  impedance: number;
  scatter: number;
  /** dB per cm per MHz. */
  attenuation: number;
  air: 0 | 1;
}

export const EUS_MEDIA: Record<EusMedium, Medium> = {
  air: { impedance: 0.0004, scatter: 0.006, attenuation: 18, air: 1 },
  bone: { impedance: 6.2, scatter: 0.04, attenuation: 14, air: 0 },
  fat: { impedance: 1.5, scatter: 0.62, attenuation: 0.55, air: 0 },
  soft: { impedance: 1.63, scatter: 0.46, attenuation: 0.7, air: 0 },
  blood: { impedance: 1.61, scatter: 0.022, attenuation: 0.18, air: 0 },
  fluid: { impedance: 1.52, scatter: 0.012, attenuation: 0.06, air: 0 },
  node: { impedance: 1.58, scatter: 0.27, attenuation: 0.7, air: 0 },
  gi_wall: { impedance: 1.66, scatter: 0.8, attenuation: 0.9, air: 0 },
  liver: { impedance: 1.65, scatter: 0.54, attenuation: 0.55, air: 0 },
  kidney: { impedance: 1.62, scatter: 0.38, attenuation: 0.6, air: 0 },
  adrenal: { impedance: 1.6, scatter: 0.2, attenuation: 0.6, air: 0 },
  pancreas: { impedance: 1.66, scatter: 0.68, attenuation: 0.7, air: 0 },
};

export const EUS_DEPTH_RANGE_MM: [number, number] = [20, 80];
/** Attenuation the built-in depth compensation cancels, dB per cm per MHz. */
const REFERENCE_ATTENUATION = 0.6;
const LATERAL_RESOLUTION_MM = 1.6;
const SCATTER_GAIN = 0.22;
/** Mean echo amplitude of unsegmented soft tissue at zero gain, the display's mid-gray anchor. */
const REFERENCE_AMPLITUDE = EUS_MEDIA.soft.scatter * 1.25 * SCATTER_GAIN;
/** Most the built-in compensation may overshoot, as an amplitude ratio (about +8 dB). */
const MAX_ENHANCEMENT = 2.5;
const DISPLAY_MID_GRAY = 92;
/** About 39 dB across the gray scale. */
const DISPLAY_GRAY_PER_DB = 6.5;

export interface EusFrameStructure {
  id: number;
  count: number;
  x: number;
  y: number;
}

export interface EusAcousticFrame {
  rgba: Uint8ClampedArray;
  labelImage: Uint8Array;
  width: number;
  height: number;
  structures: EusFrameStructure[];
  pose: AcousticPose;
  controls: AcousticControls;
}

export const DEFAULT_EUS_CONTROLS: AcousticControls = {
  depthMm: 50,
  gainDb: 0,
  tgcDb: [0, 0, 0],
  contactQuality: 1,
  sectorAngleDeg: 60,
  frequencyMHz: 7.5,
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function eusLabelAt(volume: EusAcousticVolume, x: number, y: number, z: number): number {
  const m = volume.metadata;
  const i = Math.round((x - m.originLps[0]) / m.spacingXyzMm[0]),
    j = Math.round((y - m.originLps[1]) / m.spacingXyzMm[1]),
    k = Math.round((z - m.originLps[2]) / m.spacingXyzMm[2]);
  if (i < 0 || j < 0 || k < 0 || i >= m.sizeXyz[0] || j >= m.sizeXyz[1] || k >= m.sizeXyz[2])
    return 0;
  return volume.data[(k * m.sizeXyz[1] + j) * m.sizeXyz[0] + i];
}

/** Sector layout shared by the ultrasound image, its overlays and the scan-plane CT. */
export function sectorGeometry(width: number, height: number, sectorAngleDeg: number) {
  const halfAngle = (sectorAngleDeg * Math.PI) / 360;
  return {
    halfAngle,
    radius: Math.min(height * 0.86, (width * 0.46) / Math.sin(halfAngle)),
    apexX: (width - 1) / 2,
    apexY: height * 0.075,
  };
}

// Interpolate acoustic properties, not label ids, so tissue borders are not voxel staircases.
function sampleMedium(
  volume: EusAcousticVolume,
  media: Medium[],
  x: number,
  y: number,
  z: number,
  out: Float64Array,
) {
  const m = volume.metadata,
    nx = m.sizeXyz[0],
    ny = m.sizeXyz[1],
    nz = m.sizeXyz[2];
  const vx = (x - m.originLps[0]) / m.spacingXyzMm[0],
    vy = (y - m.originLps[1]) / m.spacingXyzMm[1],
    vz = (z - m.originLps[2]) / m.spacingXyzMm[2];
  const ix = Math.floor(vx),
    iy = Math.floor(vy),
    iz = Math.floor(vz),
    fx = vx - ix,
    fy = vy - iy,
    fz = vz - iz;
  out.fill(0);
  for (let k = 0; k < 2; k++)
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < 2; i++) {
        const weight = (i ? fx : 1 - fx) * (j ? fy : 1 - fy) * (k ? fz : 1 - fz),
          a = ix + i,
          b = iy + j,
          c = iz + k;
        const medium =
          a < 0 || b < 0 || c < 0 || a >= nx || b >= ny || c >= nz
            ? EUS_MEDIA.air
            : (media[volume.data[(c * ny + b) * nx + a]] ?? EUS_MEDIA.air);
        out[0] += medium.impedance * weight;
        out[1] += medium.scatter * weight;
        out[2] += medium.attenuation * weight;
        out[3] += medium.air * weight;
      }
}

export function renderEusFrame(
  volume: EusAcousticVolume,
  pose: AcousticPose,
  input: AcousticControls,
  width = 384,
  height = 384,
  beamCount = 160,
  depthSamples = 256,
): EusAcousticFrame {
  const controls = {
    ...input,
    depthMm: clamp(input.depthMm, EUS_DEPTH_RANGE_MM[0], EUS_DEPTH_RANGE_MM[1]),
    gainDb: clamp(input.gainDb, -24, 30),
    contactQuality: clamp(input.contactQuality, 0, 1),
  };
  const labels = volume.metadata.labels;
  const media = labels.map((label) => EUS_MEDIA[label.medium] ?? EUS_MEDIA.soft);
  const polar = new Float32Array(beamCount * depthSamples),
    polarLabels = new Uint8Array(polar.length),
    sampled = new Float64Array(4);
  const step = controls.depthMm / (depthSamples - 1),
    { halfAngle, radius, apexX, apexY } = sectorGeometry(width, height, controls.sectorAngleDeg);
  const coupling = controls.contactQuality ** 1.7;
  for (let beam = 0; beam < beamCount; beam++) {
    const angle = -halfAngle + (2 * halfAngle * beam) / (beamCount - 1),
      c = Math.cos(angle),
      s = Math.sin(angle);
    const dx = pose.depthAxisLps[0] * c + pose.lateralAxisLps[0] * s,
      dy = pose.depthAxisLps[1] * c + pose.lateralAxisLps[1] * s,
      dz = pose.depthAxisLps[2] * c + pose.lateralAxisLps[2] * s;
    let energy = 1,
      priorImpedance = 0,
      priorScatter = 0,
      echoTail = 0;
    for (let sample = 0; sample < depthSamples; sample++) {
      const distance = sample * step,
        x = pose.originLps[0] + dx * distance,
        y = pose.originLps[1] + dy * distance,
        z = pose.originLps[2] + dz * distance;
      sampleMedium(volume, media, x, y, z, sampled);
      const impedance = sampled[0],
        scatter = sampled[1],
        air = sampled[3];
      const coefficient = sample
        ? Math.abs((impedance - priorImpedance) / (impedance + priorImpedance + 0.0001))
        : 0;
      const reflection = Math.min(
        0.8,
        coefficient * 3.5 + (sample && air < 0.15 ? Math.abs(scatter - priorScatter) * 1.1 : 0),
      );
      energy *= Math.exp(
        ((-Math.LN10 / 20) * 2 * sampled[2] * controls.frequencyMHz * step) / 10,
      );
      energy *= 1 - coefficient * coefficient * 0.85;
      echoTail = echoTail * Math.exp(-step / 0.28) + reflection;
      const noise = coherentSpeckle(x * 3.1, y * 3.1, z * 3.1);
      const envelope = Math.sqrt(-2 * Math.log(Math.max(0.002, noise)));
      const texture = 0.55 + 0.9 * coherentSpeckle(x * 0.75 + 17, y * 0.75, z * 0.75);
      const fraction = sample / (depthSamples - 1),
        half = fraction < 0.5 ? 0 : 1,
        t = (fraction - half * 0.5) * 2;
      // Depth compensation for average soft tissue is built in, as on a console preset. The TGC
      // sliders trim around it, so shadowing and enhancement still read against an even field.
      const tgc =
        controls.tgcDb[half] * (1 - t) +
        controls.tgcDb[half + 1] * t +
        (2 * REFERENCE_ATTENUATION * controls.frequencyMHz * distance) / 10;
      // Low-loss paths (blood, fluid) leave the compensation ahead of the beam. Capping the
      // surplus keeps posterior enhancement visible without lifting deep blood out of black.
      const compensated = Math.min(energy * Math.pow(10, tgc / 20), MAX_ENHANCEMENT);
      const amplitude =
        (scatter * envelope * texture * SCATTER_GAIN + echoTail * 0.9) *
        compensated *
        Math.pow(10, controls.gainDb / 20) *
        coupling;
      const index = beam * depthSamples + sample;
      // Log compression: gray level is linear in decibels about unsegmented soft tissue.
      polar[index] = clamp(
        DISPLAY_MID_GRAY +
          DISPLAY_GRAY_PER_DB * 20 * Math.log10(Math.max(amplitude, 1e-6) / REFERENCE_AMPLITUDE),
        0,
        255,
      );
      polarLabels[index] = eusLabelAt(volume, x, y, z);
      priorImpedance = impedance;
      priorScatter = scatter;
    }
  }
  // Finite axial and lateral point-spread function before scan conversion. It blurs echoes, not
  // the segmentation, so structure caliber is unchanged.
  const axial = new Float32Array(polar.length),
    filtered = new Float32Array(polar.length),
    weights = [1, 4, 6, 4, 1];
  for (let b = 0; b < beamCount; b++)
    for (let d = 0; d < depthSamples; d++) {
      let sum = 0;
      for (let k = -2; k <= 2; k++)
        sum += polar[b * depthSamples + clamp(d + k, 0, depthSamples - 1)] * weights[k + 2];
      axial[b * depthSamples + d] = sum / 16;
    }
  // Lateral resolution is a fixed width in tissue, so it spans more beams near the transducer.
  // Two box passes approximate a triangular beam profile about LATERAL_RESOLUTION_MM wide.
  const beamStep = (2 * halfAngle) / (beamCount - 1),
    row = new Float32Array(beamCount);
  for (let d = 0; d < depthSamples; d++) {
    const arc = Math.max(d * step * beamStep, 1e-3),
      reach = clamp(Math.round(LATERAL_RESOLUTION_MM / 2 / arc), 1, 12);
    for (let b = 0; b < beamCount; b++) row[b] = axial[b * depthSamples + d];
    for (let pass = 0; pass < 2; pass++) {
      let sum = 0;
      for (let k = -reach; k <= reach; k++) sum += row[clamp(k, 0, beamCount - 1)];
      for (let b = 0; b < beamCount; b++) {
        filtered[b * depthSamples + d] = sum / (2 * reach + 1);
        sum +=
          row[clamp(b + reach + 1, 0, beamCount - 1)] - row[clamp(b - reach, 0, beamCount - 1)];
      }
      for (let b = 0; b < beamCount; b++) row[b] = filtered[b * depthSamples + d];
    }
  }
  const rgba = new Uint8ClampedArray(width * height * 4),
    labelImage = new Uint8Array(width * height);
  const structures = new Map<number, EusFrameStructure>();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const px = x - apexX,
        py = y - apexY,
        angle = Math.atan2(px, py),
        distance = Math.hypot(px, py) / radius;
      const index = y * width + x,
        offset = index * 4;
      rgba[offset + 3] = 255;
      if (py < 0 || distance > 1 || Math.abs(angle) > halfAngle) continue;
      const b = clamp(((angle + halfAngle) / (2 * halfAngle)) * (beamCount - 1), 0, beamCount - 1),
        d = distance * (depthSamples - 1);
      const b0 = Math.floor(b),
        d0 = Math.floor(d),
        b1 = Math.min(b0 + 1, beamCount - 1),
        d1 = Math.min(d0 + 1, depthSamples - 1),
        fb = b - b0,
        fd = d - d0;
      const near = filtered[b0 * depthSamples + d0] * (1 - fd) + filtered[b0 * depthSamples + d1] * fd;
      const far = filtered[b1 * depthSamples + d0] * (1 - fd) + filtered[b1 * depthSamples + d1] * fd;
      const gray = Math.round(near * (1 - fb) + far * fb);
      rgba[offset] = gray;
      rgba[offset + 1] = gray;
      rgba[offset + 2] = gray;
      const id = polarLabels[Math.round(b) * depthSamples + Math.round(d)];
      // 255 marks "inside the sector" for label 0, so overlays can tell air from outside the fan.
      labelImage[index] = id === 0 ? 255 : id;
      if (labels[id]?.reportable) {
        const entry = structures.get(id) ?? { id, count: 0, x: 0, y: 0 };
        entry.count++;
        entry.x += x;
        entry.y += y;
        structures.set(id, entry);
      }
    }
  return {
    rgba,
    labelImage,
    width,
    height,
    structures: [...structures.values()]
      .filter((s) => s.count >= 8)
      .map((s) => ({ ...s, x: s.x / s.count, y: s.y / s.count })),
    pose,
    controls,
  };
}
