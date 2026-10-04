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
 * wider tissue table and its own speckle: fat, bone, fluid, bowel and the upper-abdominal organs
 * seen from the stomach. It is kept beside the shared renderer rather than inside it so the
 * reviewed EBUS images cannot shift when these values are tuned.
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
  /** Coarse parenchymal mottling, 0 (uniform) to 1. */
  texture: number;
}

export const EUS_MEDIA: Record<EusMedium, Medium> = {
  air: { impedance: 0.0004, scatter: 0.006, attenuation: 18, air: 1, texture: 0 },
  bone: { impedance: 6.2, scatter: 0.04, attenuation: 14, air: 0, texture: 0.2 },
  fat: { impedance: 1.5, scatter: 0.62, attenuation: 0.55, air: 0, texture: 0.5 },
  soft: { impedance: 1.63, scatter: 0.46, attenuation: 0.7, air: 0, texture: 0.4 },
  blood: { impedance: 1.61, scatter: 0.014, attenuation: 0.18, air: 0, texture: 0 },
  fluid: { impedance: 1.52, scatter: 0.008, attenuation: 0.06, air: 0, texture: 0 },
  node: { impedance: 1.58, scatter: 0.27, attenuation: 0.7, air: 0, texture: 0.22 },
  gi_wall: { impedance: 1.66, scatter: 0.8, attenuation: 0.9, air: 0, texture: 0.3 },
  liver: { impedance: 1.65, scatter: 0.54, attenuation: 0.55, air: 0, texture: 0.2 },
  kidney: { impedance: 1.62, scatter: 0.38, attenuation: 0.6, air: 0, texture: 0.3 },
  adrenal: { impedance: 1.6, scatter: 0.2, attenuation: 0.6, air: 0, texture: 0.2 },
  pancreas: { impedance: 1.66, scatter: 0.68, attenuation: 0.7, air: 0, texture: 0.5 },
  spleen: { impedance: 1.64, scatter: 0.6, attenuation: 0.5, air: 0, texture: 0.12 },
  renal_sinus: { impedance: 1.52, scatter: 0.95, attenuation: 0.8, air: 0, texture: 0.4 },
  bowel_contents: { impedance: 1.58, scatter: 0.34, attenuation: 1.1, air: 0, texture: 0.7 },
};

export const EUS_DEPTH_RANGE_MM: [number, number] = [20, 80];
/** Attenuation the built-in depth compensation cancels, dB per cm per MHz. */
const REFERENCE_ATTENUATION = 0.6;
const LATERAL_RESOLUTION_MM = 1.3;
const AXIAL_RESOLUTION_MM = 0.5;
/** Axial softening of tissue borders. With the lateral response it hides the 1 mm voxel grid. */
const BORDER_BLUR_MM = 0.9;
const SCATTER_GAIN = 0.22;
const SPECULAR_GAIN = 0.7;
/** Mean echo amplitude of unsegmented soft tissue at zero gain, the display's mid-gray anchor. */
const REFERENCE_AMPLITUDE = EUS_MEDIA.soft.scatter * SCATTER_GAIN;
/** Most the built-in compensation may overshoot, as an amplitude ratio (about +8 dB). */
const MAX_ENHANCEMENT = 2.5;
const DISPLAY_MID_GRAY = 96;
/** About 42 dB across the gray scale. */
const DISPLAY_GRAY_PER_DB = 6;
/** Edge of the world-anchored lattice the speckle is drawn from. */
const SPECKLE_CELL_MM = 0.16;
/** Mean of a unit-power Rayleigh envelope. */
const RAYLEIGH_MEAN = Math.sqrt(Math.PI) / 2;
/** Share of the image that carries speckle; the rest is the smooth tissue level. */
const SPECKLE_DEPTH = 0.85;
/** Shallowest air interface that sets up visible reverberation, and the repeat cap. */
const REVERB_MIN_MM = 2.5;
const REVERB_ORDERS = 7;

export interface EusFrameStructure {
  id: number;
  count: number;
  x: number;
  y: number;
}

export interface EusAcousticFrame {
  rgba: Uint8ClampedArray;
  /** Label under each pixel: 0 outside the sector, 255 for air inside it, else the label id. */
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

const PROPERTIES = 5;

/** Per-label acoustic properties, flattened so the sampling loop reads typed arrays only. */
function mediaTable(volume: EusAcousticVolume) {
  const table = new Float32Array(256 * PROPERTIES);
  for (let id = 0; id < 256; id++) {
    const label = volume.metadata.labels[id];
    const medium = label ? (EUS_MEDIA[label.medium] ?? EUS_MEDIA.soft) : EUS_MEDIA.air;
    table.set(
      [medium.impedance, medium.scatter, medium.attenuation, medium.air, medium.texture],
      id * PROPERTIES,
    );
  }
  return table;
}

// Interpolate acoustic properties, not label ids, so tissue borders are not voxel staircases.
function sampleMedium(
  volume: EusAcousticVolume,
  table: Float32Array,
  x: number,
  y: number,
  z: number,
  out: Float64Array,
) {
  const m = volume.metadata,
    nx = m.sizeXyz[0],
    ny = m.sizeXyz[1],
    nz = m.sizeXyz[2],
    data = volume.data;
  const vx = (x - m.originLps[0]) / m.spacingXyzMm[0],
    vy = (y - m.originLps[1]) / m.spacingXyzMm[1],
    vz = (z - m.originLps[2]) / m.spacingXyzMm[2];
  const ix = Math.floor(vx),
    iy = Math.floor(vy),
    iz = Math.floor(vz);
  out[0] = out[1] = out[2] = out[3] = out[4] = 0;
  if (ix < 0 || iy < 0 || iz < 0 || ix >= nx - 1 || iy >= ny - 1 || iz >= nz - 1) {
    // Outside the volume is air. The partly-outside border cell is treated the same way.
    const air = EUS_MEDIA.air;
    out[0] = air.impedance;
    out[1] = air.scatter;
    out[2] = air.attenuation;
    out[3] = 1;
    return;
  }
  const fx = vx - ix,
    fy = vy - iy,
    fz = vz - iz,
    base = (iz * ny + iy) * nx + ix,
    slice = nx * ny;
  const first = data[base];
  if (
    first === data[base + 1] &&
    first === data[base + nx] &&
    first === data[base + nx + 1] &&
    first === data[base + slice] &&
    first === data[base + slice + 1] &&
    first === data[base + slice + nx] &&
    first === data[base + slice + nx + 1]
  ) {
    // Inside one tissue, which is most samples: no interpolation needed.
    const at = first * PROPERTIES;
    out[0] = table[at];
    out[1] = table[at + 1];
    out[2] = table[at + 2];
    out[3] = table[at + 3];
    out[4] = table[at + 4];
    return;
  }
  for (let corner = 0; corner < 8; corner++) {
    const i = corner & 1,
      j = (corner >> 1) & 1,
      k = corner >> 2;
    const weight = (i ? fx : 1 - fx) * (j ? fy : 1 - fy) * (k ? fz : 1 - fz),
      at = data[base + i + j * nx + k * slice] * PROPERTIES;
    out[0] += table[at] * weight;
    out[1] += table[at + 1] * weight;
    out[2] += table[at + 2] * weight;
    out[3] += table[at + 3] * weight;
    out[4] += table[at + 4] * weight;
  }
}

/** One 32-bit hash per lattice cell; each of its halves seeds one complex Gaussian sample. */
function cellHash(i: number, j: number, k: number) {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(k, 0x1b873593);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}

// Box-Muller by table: a byte picks the Rayleigh magnitude, another the phase.
const GAUSS_MAGNITUDE = Float32Array.from({ length: 256 }, (_, u) =>
  Math.sqrt(-2 * Math.log((u + 0.5) / 256)),
);
const GAUSS_COS = Float32Array.from({ length: 256 }, (_, u) => Math.cos((u / 256) * Math.PI * 2));
const GAUSS_SIN = Float32Array.from({ length: 256 }, (_, u) => Math.sin((u / 256) * Math.PI * 2));

/** Running-sum box blur along each beam, `passes` times; three passes are close to a Gaussian. */
function blurAxial(
  data: Float32Array,
  scratch: Float32Array,
  beams: number,
  samples: number,
  reach: number,
  passes: number,
) {
  if (reach < 1) return;
  const span = 2 * reach + 1;
  for (let pass = 0; pass < passes; pass++) {
    for (let b = 0; b < beams; b++) {
      const base = b * samples;
      let sum = data[base] * (reach + 1);
      for (let k = 1; k <= reach; k++) sum += data[base + Math.min(k, samples - 1)];
      for (let d = 0; d < samples; d++) {
        scratch[base + d] = sum / span;
        const add = d + reach + 1,
          drop = d - reach;
        sum +=
          data[base + (add < samples ? add : samples - 1)] - data[base + (drop > 0 ? drop : 0)];
      }
    }
    data.set(scratch);
  }
}

/**
 * Lateral blur of a fixed width in tissue, so it spans more beams near the transducer. Two box
 * passes approximate a triangular beam profile. Works in place on `data`.
 */
function blurLateral(
  data: Float32Array,
  beams: number,
  samples: number,
  reachAt: Int32Array,
  row: Float32Array,
) {
  const last = beams - 1;
  for (let d = 0; d < samples; d++) {
    const reach = reachAt[d];
    if (reach < 1) continue;
    const span = 2 * reach + 1;
    for (let b = 0; b < beams; b++) row[b] = data[b * samples + d];
    for (let pass = 0; pass < 2; pass++) {
      let sum = row[0] * (reach + 1);
      for (let k = 1; k <= reach; k++) sum += row[k < last ? k : last];
      for (let b = 0; b < beams; b++) {
        data[b * samples + d] = sum / span;
        const add = b + reach + 1,
          drop = b - reach;
        sum += row[add < last ? add : last] - row[drop > 0 ? drop : 0];
      }
      for (let b = 0; b < beams; b++) row[b] = data[b * samples + d];
    }
  }
}

interface ScanMap {
  key: string;
  /** Per pixel: beam position, or -1 outside the sector. */
  beam: Float32Array;
  /** Per pixel: depth as a fraction of the displayed range. */
  depth: Float32Array;
}
let scanMap: ScanMap | null = null;

/** Pixel-to-beam mapping for scan conversion; it only changes with the image size or sector. */
function scanConversion(width: number, height: number, sectorAngleDeg: number): ScanMap {
  const key = `${width}x${height}@${sectorAngleDeg}`;
  if (scanMap?.key === key) return scanMap;
  const { halfAngle, radius, apexX, apexY } = sectorGeometry(width, height, sectorAngleDeg);
  const beam = new Float32Array(width * height).fill(-1),
    depth = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const px = x - apexX,
        py = y - apexY,
        angle = Math.atan2(px, py),
        distance = Math.hypot(px, py) / radius;
      if (py < 0 || distance > 1 || Math.abs(angle) > halfAngle) continue;
      beam[y * width + x] = (angle + halfAngle) / (2 * halfAngle);
      depth[y * width + x] = distance;
    }
  scanMap = { key, beam, depth };
  return scanMap;
}

export function renderEusFrame(
  volume: EusAcousticVolume,
  pose: AcousticPose,
  input: AcousticControls,
  width = 512,
  height = 512,
  beamCount = 208,
  depthSamples = 320,
): EusAcousticFrame {
  const controls = {
    ...input,
    depthMm: clamp(input.depthMm, EUS_DEPTH_RANGE_MM[0], EUS_DEPTH_RANGE_MM[1]),
    gainDb: clamp(input.gainDb, -24, 30),
    contactQuality: clamp(input.contactQuality, 0, 1),
  };
  const labels = volume.metadata.labels;
  const table = mediaTable(volume);
  const cells = beamCount * depthSamples;
  // Diffuse scatter, specular echoes and the complex speckle field are kept apart until the
  // envelope is taken, so each gets the blur that belongs to it.
  const diffuse = new Float32Array(cells),
    specular = new Float32Array(cells),
    // Two independent speckle looks, averaged after detection as spatial compounding does.
    looks = [0, 1, 2, 3].map(() => new Float32Array(cells)),
    scratch = new Float32Array(cells),
    sampled = new Float64Array(PROPERTIES);
  const step = controls.depthMm / (depthSamples - 1),
    { halfAngle, radius, apexX, apexY } = sectorGeometry(width, height, controls.sectorAngleDeg);
  const gain = Math.pow(10, controls.gainDb / 20) * controls.contactQuality ** 1.7;
  const origin = pose.originLps,
    depthAxis = pose.depthAxisLps,
    lateralAxis = pose.lateralAxisLps;
  // Depth compensation for average soft tissue is built in, as on a console preset. The TGC
  // sliders trim around it, so shadowing and enhancement still read against an even field.
  const compensationAt = new Float32Array(depthSamples);
  let strongest = 0;
  for (let sample = 0; sample < depthSamples; sample++) {
    const fraction = sample / (depthSamples - 1),
      half = fraction < 0.5 ? 0 : 1,
      t = (fraction - half * 0.5) * 2;
    const tgc =
      controls.tgcDb[half] * (1 - t) +
      controls.tgcDb[half + 1] * t +
      (2 * REFERENCE_ATTENUATION * controls.frequencyMHz * sample * step) / 10;
    compensationAt[sample] = Math.pow(10, tgc / 20);
    strongest = Math.max(strongest, compensationAt[sample]);
  }
  // Below this energy no later sample can reach the display, however much it is compensated.
  const spent = 2e-4 / (strongest * Math.max(gain, 1e-3));
  const cell = 1 / SPECKLE_CELL_MM;

  for (let beam = 0; beam < beamCount; beam++) {
    const angle = -halfAngle + (2 * halfAngle * beam) / (beamCount - 1),
      c = Math.cos(angle),
      s = Math.sin(angle);
    const dx = depthAxis[0] * c + lateralAxis[0] * s,
      dy = depthAxis[1] * c + lateralAxis[1] * s,
      dz = depthAxis[2] * c + lateralAxis[2] * s;
    let energy = 1,
      priorImpedance = 0,
      priorScatter = 0,
      priorAir = 0,
      echoTail = 0,
      reverbAt = 0,
      reverbGain = 0,
      mottleFrom = 0,
      mottleTo = 0;
    for (let sample = 0; sample < depthSamples; sample++) {
      const distance = sample * step,
        x = origin[0] + dx * distance,
        y = origin[1] + dy * distance,
        z = origin[2] + dz * distance;
      const index = beam * depthSamples + sample;
      // Fully developed speckle: complex Gaussian scatterers on a lattice fixed in the patient,
      // so the pattern travels with the tissue as the scope moves.
      const hash = cellHash(Math.floor(x * cell), Math.floor(y * cell), Math.floor(z * cell));
      const m0 = GAUSS_MAGNITUDE[hash & 0xff],
        p0 = (hash >>> 8) & 0xff,
        m1 = GAUSS_MAGNITUDE[(hash >>> 16) & 0xff],
        p1 = hash >>> 24;
      looks[0][index] = m0 * GAUSS_COS[p0];
      looks[1][index] = m0 * GAUSS_SIN[p0];
      looks[2][index] = m1 * GAUSS_COS[p1];
      looks[3][index] = m1 * GAUSS_SIN[p1];
      const reverberating = reverbAt > 0 && distance > reverbAt;
      if (energy < spent && !reverberating) continue;

      let scattered = 0,
        mirrored = 0;
      if (energy >= spent) {
        sampleMedium(volume, table, x, y, z, sampled);
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
        // The first air interface a beam meets sets up reverberation: the pulse bounces between
        // the transducer and the interface, so repeats appear at multiples of its depth.
        if (!reverbAt && air > 0.5 && priorAir <= 0.5 && distance >= 1 && energy > 0.02) {
          reverbAt = Math.max(distance, REVERB_MIN_MM);
          reverbGain = Math.min(energy * compensationAt[sample], MAX_ENHANCEMENT) * gain * 0.2;
        }
        energy *= Math.exp(
          ((-Math.LN10 / 20) * 2 * sampled[2] * controls.frequencyMHz * step) / 10,
        );
        energy *= 1 - coefficient * coefficient * 0.85;
        echoTail = echoTail * Math.exp(-step / 0.28) + reflection;
        // Low-loss paths (blood, fluid) leave the compensation ahead of the beam. Capping the
        // surplus keeps posterior enhancement visible without lifting deep blood out of black.
        const compensated = Math.min(energy * compensationAt[sample], MAX_ENHANCEMENT) * gain;
        // Parenchymal mottling varies slowly, so it is sampled every fourth step and eased.
        const phase = sample & 3;
        if (phase === 0) {
          const ahead = distance + 4 * step;
          mottleFrom = sample ? mottleTo : coherentSpeckle(x * 0.6 + 17, y * 0.6, z * 0.6);
          mottleTo = coherentSpeckle(
            (origin[0] + dx * ahead) * 0.6 + 17,
            (origin[1] + dy * ahead) * 0.6,
            (origin[2] + dz * ahead) * 0.6,
          );
        }
        const mottle = mottleFrom + ((mottleTo - mottleFrom) * phase) / 4;
        scattered = scatter * (1 + sampled[4] * (mottle * 2 - 1) * 0.9) * SCATTER_GAIN * compensated;
        // Transducer ring-down: a bright cap in the first millimetre.
        mirrored = echoTail * SPECULAR_GAIN * compensated + 0.3 * Math.exp(-distance / 0.55) * gain;
        priorImpedance = impedance;
        priorScatter = scatter;
        priorAir = air;
      }
      if (reverberating) {
        const beyond = distance - reverbAt,
          order = Math.round(distance / reverbAt),
          offset = (distance - order * reverbAt) / 0.32;
        // A fading haze just past the interface, then discrete repeats.
        scattered += reverbGain * 0.45 * Math.exp(-beyond / 2.6);
        if (order >= 2 && order <= REVERB_ORDERS && Math.abs(offset) < 2.5)
          mirrored +=
            reverbGain *
            Math.pow(0.58, order - 2) *
            Math.exp(-offset * offset) *
            (0.45 + 1.1 * coherentSpeckle(x * 1.4, y * 1.4 + 9, z * 1.4));
      }
      diffuse[index] = scattered;
      specular[index] = mirrored;
    }
  }

  // Point-spread function. The speckle field is filtered before its envelope is taken, which
  // gives the grain its size: fine along the beam, wider across it, and wider still with depth.
  // Tissue borders pass through the same response, which also hides the 1 mm voxel grid.
  const beamStep = (2 * halfAngle) / (beamCount - 1),
    psfReach = new Int32Array(depthSamples),
    row = new Float32Array(beamCount);
  for (let d = 0; d < depthSamples; d++) {
    const arc = Math.max(d * step * beamStep, 1e-3);
    psfReach[d] = clamp(Math.round(LATERAL_RESOLUTION_MM / 2 / arc), 1, 14);
  }
  const speckleReach = Math.max(1, Math.round(AXIAL_RESOLUTION_MM / 4 / step)),
    borderReach = Math.max(1, Math.round(BORDER_BLUR_MM / 3 / step));
  for (const field of looks) {
    blurAxial(field, scratch, beamCount, depthSamples, speckleReach, 2);
    blurLateral(field, beamCount, depthSamples, psfReach, row);
  }
  blurAxial(specular, scratch, beamCount, depthSamples, speckleReach, 2);
  blurLateral(specular, beamCount, depthSamples, psfReach, row);
  blurAxial(diffuse, scratch, beamCount, depthSamples, borderReach, 3);
  blurLateral(diffuse, beamCount, depthSamples, psfReach, row);

  const polar = new Float32Array(cells),
    grayScale = DISPLAY_GRAY_PER_DB * 20 * Math.LOG10E;
  for (let d = 0; d < depthSamples; d++) {
    // Filtering changes the field's power by an amount that depends on how many lattice cells
    // each beam shares with its neighbors. Normalizing each depth row restores unit power.
    let power = 0;
    for (let b = 0; b < beamCount; b++) {
      const index = b * depthSamples + d;
      power +=
        looks[0][index] * looks[0][index] +
        looks[1][index] * looks[1][index] +
        looks[2][index] * looks[2][index] +
        looks[3][index] * looks[3][index];
    }
    // Each look carries half the summed power; the two detected envelopes are then averaged.
    const scale = power > 0 ? 0.5 / (Math.sqrt(power / (2 * beamCount)) * RAYLEIGH_MEAN) : 0;
    for (let b = 0; b < beamCount; b++) {
      const index = b * depthSamples + d;
      const envelope =
        (Math.sqrt(looks[0][index] * looks[0][index] + looks[1][index] * looks[1][index]) +
          Math.sqrt(looks[2][index] * looks[2][index] + looks[3][index] * looks[3][index])) *
        scale;
      const amplitude =
        diffuse[index] * (1 - SPECKLE_DEPTH + SPECKLE_DEPTH * envelope) + specular[index];
      // Log compression: gray level is linear in decibels about unsegmented soft tissue.
      const gray =
        amplitude > 1e-6
          ? DISPLAY_MID_GRAY + grayScale * Math.log(amplitude / REFERENCE_AMPLITUDE)
          : 0;
      polar[index] = gray < 0 ? 0 : gray > 255 ? 255 : gray;
    }
  }

  const rgba = new Uint8ClampedArray(width * height * 4),
    labelImage = new Uint8Array(width * height),
    counts = new Float64Array(256 * 3);
  const mmPerPixel = controls.depthMm / radius,
    map = scanConversion(width, height, controls.sectorAngleDeg);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const index = y * width + x,
        offset = index * 4;
      rgba[offset + 3] = 255;
      if (map.beam[index] < 0) continue;
      const b = map.beam[index] * (beamCount - 1),
        d = map.depth[index] * (depthSamples - 1);
      const b0 = Math.floor(b),
        d0 = Math.floor(d),
        b1 = Math.min(b0 + 1, beamCount - 1),
        d1 = Math.min(d0 + 1, depthSamples - 1),
        fb = b - b0,
        fd = d - d0;
      const near = polar[b0 * depthSamples + d0] * (1 - fd) + polar[b0 * depthSamples + d1] * fd;
      const far = polar[b1 * depthSamples + d0] * (1 - fd) + polar[b1 * depthSamples + d1] * fd;
      const gray = Math.round(near * (1 - fb) + far * fb);
      rgba[offset] = gray;
      rgba[offset + 1] = gray;
      rgba[offset + 2] = gray;
      // Labels are read at the pixel's own position, not through the beam grid.
      const along = (y - apexY) * mmPerPixel,
        across = (x - apexX) * mmPerPixel;
      const id = eusLabelAt(
        volume,
        origin[0] + depthAxis[0] * along + lateralAxis[0] * across,
        origin[1] + depthAxis[1] * along + lateralAxis[1] * across,
        origin[2] + depthAxis[2] * along + lateralAxis[2] * across,
      );
      // 255 marks "inside the sector" for label 0, so overlays can tell air from outside the fan.
      labelImage[index] = id === 0 ? 255 : id;
      counts[id * 3]++;
      counts[id * 3 + 1] += x;
      counts[id * 3 + 2] += y;
    }
  const structures: EusFrameStructure[] = [];
  for (let id = 0; id < labels.length; id++) {
    const count = counts[id * 3];
    // A structure is listed once it covers about 2 mm² of the scan plane.
    if (!labels[id].reportable || count * mmPerPixel * mmPerPixel < 2) continue;
    structures.push({ id, count, x: counts[id * 3 + 1] / count, y: counts[id * 3 + 2] / count });
  }
  return { rgba, labelImage, width, height, structures, pose, controls };
}

export interface EusOverlayOptions {
  /** RGB per label id, or null where a label is never tinted. */
  colors: Array<[number, number, number] | null>;
  /** Tint every colored structure. */
  tint: boolean;
  /** Label drawn stronger than the rest when tinting. */
  activeId: number | null;
  /** Label outlined, tinted or not. */
  highlightId: number | null;
  /** Also fill the outlined label lightly. Off for a standing selection, which should not veil the image. */
  fillHighlight?: boolean;
}

/**
 * Structure colors and the highlighted outline for a frame, written into `data` (RGBA).
 *
 * Each pixel takes the trilinear share of its eight surrounding voxels, so borders follow the
 * anatomy smoothly instead of the 1 mm voxel grid.
 */
export function paintEusOverlay(
  data: Uint8ClampedArray,
  volume: EusAcousticVolume,
  frame: EusAcousticFrame,
  { colors, tint, activeId, highlightId, fillHighlight = true }: EusOverlayOptions,
) {
  data.fill(0);
  if (!tint && highlightId === null) return;
  const { width, height, pose, controls } = frame;
  const { radius, apexX, apexY } = sectorGeometry(width, height, controls.sectorAngleDeg);
  const m = volume.metadata,
    nx = m.sizeXyz[0],
    ny = m.sizeXyz[1],
    nz = m.sizeXyz[2],
    mmPerPixel = controls.depthMm / radius;
  const origin = pose.originLps,
    depthAxis = pose.depthAxisLps,
    lateralAxis = pose.lateralAxisLps;
  const highlight = highlightId === null ? null : (colors[highlightId] ?? [255, 255, 255]),
    fill = fillHighlight ? 58 : 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x;
      if (frame.labelImage[pixel] === 0) continue;
      const along = (y - apexY) * mmPerPixel,
        across = (x - apexX) * mmPerPixel;
      const vx =
          (origin[0] + depthAxis[0] * along + lateralAxis[0] * across - m.originLps[0]) /
          m.spacingXyzMm[0],
        vy =
          (origin[1] + depthAxis[1] * along + lateralAxis[1] * across - m.originLps[1]) /
          m.spacingXyzMm[1],
        vz =
          (origin[2] + depthAxis[2] * along + lateralAxis[2] * across - m.originLps[2]) /
          m.spacingXyzMm[2];
      const ix = Math.floor(vx),
        iy = Math.floor(vy),
        iz = Math.floor(vz);
      if (ix < 0 || iy < 0 || iz < 0 || ix >= nx - 1 || iy >= ny - 1 || iz >= nz - 1) continue;
      const fx = vx - ix,
        fy = vy - iy,
        fz = vz - iz;
      let red = 0,
        green = 0,
        blue = 0,
        alpha = 0,
        share = 0;
      for (let corner = 0; corner < 8; corner++) {
        const i = corner & 1,
          j = (corner >> 1) & 1,
          k = corner >> 2;
        const weight = (i ? fx : 1 - fx) * (j ? fy : 1 - fy) * (k ? fz : 1 - fz);
        if (weight === 0) continue;
        const id = volume.data[((iz + k) * ny + iy + j) * nx + ix + i];
        if (id === highlightId) share += weight;
        const color = tint ? colors[id] : null;
        if (!color) continue;
        const strength = weight * (id === activeId ? 150 : 82);
        red += color[0] * strength;
        green += color[1] * strength;
        blue += color[2] * strength;
        alpha += strength;
      }
      if (highlight && share > 0.02) {
        // A crisp line where the share crosses one half, over a light fill inside.
        const edge = clamp(1 - Math.abs(share - 0.5) * 3.4, 0, 1),
          strength = Math.max(edge * 235, share * fill);
        const lift = edge * 0.55;
        red += (highlight[0] + (255 - highlight[0]) * lift) * strength;
        green += (highlight[1] + (255 - highlight[1]) * lift) * strength;
        blue += (highlight[2] + (255 - highlight[2]) * lift) * strength;
        alpha += strength;
      }
      if (alpha <= 0) continue;
      const offset = pixel * 4;
      data[offset] = red / alpha;
      data[offset + 1] = green / alpha;
      data[offset + 2] = blue / alpha;
      data[offset + 3] = Math.min(alpha, 245);
    }
}
