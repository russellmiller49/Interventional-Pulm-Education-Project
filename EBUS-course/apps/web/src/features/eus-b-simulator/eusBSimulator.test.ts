import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { scalar, type Point3 } from '@bronchoscopy-core/frame';

import { EUS_LANDMARK_BY_KEY, EUS_LANDMARKS } from './content';
import {
  DEFAULT_EUS_CONTROLS,
  EUS_DEPTH_RANGE_MM,
  eusLabelAt,
  renderEusFrame,
  type EusAcousticFrame,
} from './eusAcoustic';
import {
  computeEusPose,
  describeFacing,
  insertionDepthCm,
  normalizeRollDeg,
  scopeShaftPolyline,
  wallContactMm,
} from './eusPose';
import { FIND_START, referenceAreaMm2, structureAreaMm2, targetHeld } from './findTarget';
import type { EusAcousticVolume, EusCaseManifest, EusScopePath } from './types';
import { validateEusAcousticVolume } from './useEusCase';

const root = resolve(process.cwd(), 'public/simulator/eus-b-case-001');
const json = <T,>(name: string): T => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
const manifest = json<EusCaseManifest>('case_manifest.json');
const path = json<EusScopePath>(manifest.assets.path);
const volume: EusAcousticVolume = {
  metadata: json(manifest.assets.acoustic.metadata),
  data: new Uint8Array(gunzipSync(readFileSync(resolve(root, manifest.assets.acoustic.data)))),
};
const labelId = (key: string) => volume.metadata.labels.find((label) => label.key === key)!.id;
const angleDeg = (a: Point3, b: Point3) =>
  (Math.acos(Math.max(-1, Math.min(1, scalar(a, b)))) * 180) / Math.PI;
const frameAt = (state: { sMm: number; rollDeg: number; flexDeg: number }, controls = {}) => {
  const pose = computeEusPose(path, state);
  return renderEusFrame(
    volume,
    { originLps: pose.originLps, depthAxisLps: pose.depthAxisLps, lateralAxisLps: pose.lateralAxisLps },
    { ...DEFAULT_EUS_CONTROLS, sectorAngleDeg: manifest.probe.sectorAngleDeg, ...controls },
    192,
    192,
    96,
    160,
  );
};
const meanGray = (frame: EusAcousticFrame, id: number) => {
  let sum = 0,
    count = 0;
  for (let i = 0; i < frame.labelImage.length; i++)
    if (frame.labelImage[i] === id) {
      sum += frame.rgba[i * 4];
      count++;
    }
  return count ? sum / count : NaN;
};

describe('EUS-B case assets', () => {
  it('ships an acoustic volume that matches its metadata and this case', () => {
    expect(createHash('sha256').update(volume.data).digest('hex')).toBe(volume.metadata.decodedSha256);
    expect(() => validateEusAcousticVolume(volume.metadata, volume.data, manifest)).not.toThrow();
    expect(() =>
      validateEusAcousticVolume(volume.metadata, volume.data, { ...manifest, assetVersion: 'other' }),
    ).toThrow(/match/);
    expect(() => validateEusAcousticVolume(volume.metadata, volume.data.subarray(1), manifest)).toThrow(
      /dimensions/,
    );
  });

  it('ships a CT correlate and model that match the manifest', () => {
    const ct = readFileSync(resolve(root, manifest.assets.ct.data));
    expect(createHash('sha256').update(ct).digest('hex')).toBe(manifest.assets.ct.dataSha256);
    expect(gunzipSync(ct).length).toBe(manifest.assets.ct.sizeXyz.reduce((a, b) => a * b, 1));
    const model = readFileSync(resolve(root, manifest.assets.model.asset));
    expect(createHash('sha256').update(model).digest('hex')).toBe(manifest.assets.model.sha256);
  });

  it('names path levels that cover the whole path in order', () => {
    const levels = manifest.path.levels;
    expect(levels[0].fromSMm).toBe(0);
    expect(levels[levels.length - 1].toSMm).toBeCloseTo(path.totalLengthMm, 5);
    levels.slice(1).forEach((level, index) => expect(level.fromSMm).toBe(levels[index].toSMm));
    expect(levels.find((level) => level.key === 'stomach')!.fromSMm).toBe(path.gejSMm);
  });

  it('pairs every calibrated landmark with authored copy and known structures', () => {
    const structures = new Set(manifest.structures.map((structure) => structure.key));
    expect(manifest.landmarks.map((landmark) => landmark.key).sort()).toEqual(
      EUS_LANDMARKS.map((landmark) => landmark.key).sort(),
    );
    for (const landmark of manifest.landmarks) {
      expect(EUS_LANDMARK_BY_KEY.get(landmark.key)!.lookFor.length).toBeGreaterThan(20);
      for (const key of landmark.inView) expect(structures.has(key)).toBe(true);
    }
  });
});

describe('EUS-B scope pose', () => {
  it.each(manifest.landmarks.map((landmark) => [landmark.key, landmark] as const))(
    'reproduces the build-time pose for %s',
    (_key, landmark) => {
      const pose = computeEusPose(path, landmark);
      const expected = landmark.expectedPose;
      expect(Math.hypot(...pose.originLps.map((v, i) => v - expected.originLps[i]))).toBeLessThan(0.3);
      expect(angleDeg(pose.depthAxisLps, expected.depthAxisLps)).toBeLessThan(0.5);
      expect(angleDeg(pose.lateralAxisLps, expected.lateralAxisLps)).toBeLessThan(0.5);
    },
  );

  it('turns clockwise from anterior toward the patient’s right', () => {
    // Mid-esophagus, where the scope runs caudally. LPS: +x left, +y posterior.
    const at = (rollDeg: number) => computeEusPose(path, { sMm: 110, rollDeg, flexDeg: 0 }).depthAxisLps;
    expect(at(0)[1]).toBeLessThan(-0.9);
    expect(at(90)[0]).toBeLessThan(-0.9);
    expect(at(-90)[0]).toBeGreaterThan(0.9);
    expect(at(180)[1]).toBeGreaterThan(0.9);
    expect(describeFacing(at(0))).toBe('anterior');
    expect(describeFacing(at(-90))).toBe('left');
  });

  it('keeps an orthonormal frame with image-right toward the operator', () => {
    for (const state of [
      { sMm: 40, rollDeg: -120, flexDeg: 0 },
      { sMm: 200, rollDeg: 75, flexDeg: 30 },
      { sMm: 320, rollDeg: 160, flexDeg: -40 },
    ]) {
      const pose = computeEusPose(path, state);
      expect(Math.abs(scalar(pose.depthAxisLps, pose.lateralAxisLps))).toBeLessThan(1e-6);
      expect(Math.abs(scalar(pose.planeNormalLps, pose.depthAxisLps))).toBeLessThan(1e-6);
      expect(scalar(pose.lateralAxisLps, pose.shaftAxisLps)).toBeCloseTo(-1, 6);
    }
    // In the esophagus the operator is cranial, so image-right points up the patient.
    expect(computeEusPose(path, { sMm: 120, rollDeg: 0, flexDeg: 0 }).lateralAxisLps[2]).toBeGreaterThan(0.9);
  });

  it('angles the tip within the scan plane, about the transducer face', () => {
    const neutral = computeEusPose(path, { sMm: 150, rollDeg: 20, flexDeg: 0 });
    const flexed = computeEusPose(path, { sMm: 150, rollDeg: 20, flexDeg: 30 });
    expect(angleDeg(neutral.planeNormalLps, flexed.planeNormalLps)).toBeLessThan(1e-4);
    expect(angleDeg(neutral.depthAxisLps, flexed.depthAxisLps)).toBeCloseTo(30, 4);
    expect(flexed.originLps).toEqual(neutral.originLps);
    // Up-angulation tilts the beam back toward the operator.
    expect(scalar(flexed.depthAxisLps, neutral.lateralAxisLps)).toBeGreaterThan(0.45);
  });

  it('places the transducer inside the gut wall or lumen along the whole path', () => {
    const gi = new Set(volume.metadata.labels.filter((label) => label.group === 'gi').map((l) => l.id));
    let total = 0,
      inside = 0;
    for (let sMm = 8; sMm <= path.totalLengthMm; sMm += 6)
      for (let rollDeg = -180; rollDeg < 180; rollDeg += 30) {
        const pose = computeEusPose(path, { sMm, rollDeg, flexDeg: 0 });
        total++;
        if (gi.has(eusLabelAt(volume, ...pose.originLps))) inside++;
        expect(pose.contactMm).toBeGreaterThanOrEqual(0);
      }
    expect(inside / total).toBeGreaterThan(0.97);
  });

  it('wraps roll, clamps travel and reports region and depth', () => {
    expect(normalizeRollDeg(190)).toBe(-170);
    expect(normalizeRollDeg(-190)).toBe(170);
    expect(normalizeRollDeg(540)).toBe(180);
    expect(wallContactMm(path, 100, 365)).toBeCloseTo(wallContactMm(path, 100, 5), 6);
    expect(computeEusPose(path, { sMm: -50, rollDeg: 0, flexDeg: 0 }).centerLps).toEqual(path.pointsLps[0]);
    expect(computeEusPose(path, { sMm: path.gejSMm - 5, rollDeg: 0, flexDeg: 0 }).region).toBe('esophagus');
    expect(computeEusPose(path, { sMm: path.gejSMm + 5, rollDeg: 0, flexDeg: 0 }).region).toBe('stomach');
    expect(insertionDepthCm(path.gejSMm, manifest.path.incisorOffsetMm)).toBeGreaterThan(36);
    expect(insertionDepthCm(path.gejSMm, manifest.path.incisorOffsetMm)).toBeLessThan(46);
  });

  it('draws the shaft from the top of the path to the transducer', () => {
    const state = { sMm: 280, rollDeg: 150, flexDeg: 0 };
    const pose = computeEusPose(path, state);
    const shaft = scopeShaftPolyline(path, pose, state.sMm);
    expect(shaft[0]).toEqual(path.pointsLps[0]);
    expect(Math.hypot(...shaft[shaft.length - 1].map((v, i) => v - pose.originLps[i]))).toBeLessThan(1e-6);
  });
});

describe('EUS-B ultrasound rendering', () => {
  it.each(manifest.landmarks.map((landmark) => [landmark.key, landmark] as const))(
    'shows %s in its calibrated view',
    (key, landmark) => {
      const frame = frameAt(landmark, { depthMm: manifest.probe.defaultDepthMm });
      expect(frame.structures.map((structure) => volume.metadata.labels[structure.id].key)).toContain(key);
    },
  );

  it('is deterministic for a pose and settings', () => {
    const state = manifest.landmarks.find((landmark) => landmark.key === 'station_7')!;
    expect(Buffer.from(frameAt(state).rgba).equals(Buffer.from(frameAt(state).rgba))).toBe(true);
  });

  it('renders blood echo-free, nodes darker than fat, and marks the sector', () => {
    const atrium = frameAt(manifest.landmarks.find((l) => l.key === 'left_atrium')!);
    expect(meanGray(atrium, labelId('left_atrium'))).toBeLessThan(20);
    const subcarinal = frameAt(manifest.landmarks.find((l) => l.key === 'station_7')!);
    const node = meanGray(subcarinal, labelId('station_7'));
    expect(node).toBeGreaterThan(35);
    expect(node).toBeLessThan(meanGray(subcarinal, labelId('fat')));
    const liver = meanGray(frameAt(manifest.landmarks.find((l) => l.key === 'liver')!), labelId('liver'));
    expect(liver).toBeGreaterThan(60);
    expect(liver).toBeLessThan(150);
    // Outside the sector is 0; air inside it is 255, never 0.
    expect(subcarinal.labelImage[0]).toBe(0);
    expect(subcarinal.rgba[0]).toBe(0);
  });

  it('shadows behind aerated lung', () => {
    // Station 9 lies next to lung in this case: the far field behind the interface is dark.
    const frame = frameAt(manifest.landmarks.find((l) => l.key === 'station_9')!);
    const air: number[] = [];
    for (let i = 0; i < frame.labelImage.length; i++)
      if (frame.labelImage[i] === 255) air.push(frame.rgba[i * 4]);
    air.sort((a, b) => a - b);
    expect(air.length).toBeGreaterThan(500);
    expect(air[Math.floor(air.length / 2)]).toBeLessThan(8);
  });

  it('responds to gain and clamps depth to the supported range', () => {
    const state = manifest.landmarks.find((landmark) => landmark.key === 'liver')!;
    const id = labelId('liver');
    expect(meanGray(frameAt(state, { gainDb: 8 }), id)).toBeGreaterThan(meanGray(frameAt(state), id) + 20);
    expect(frameAt(state, { depthMm: 500 }).controls.depthMm).toBe(EUS_DEPTH_RANGE_MM[1]);
    expect(frameAt(state, { depthMm: 1 }).controls.depthMm).toBe(EUS_DEPTH_RANGE_MM[0]);
  });
});

describe('EUS-B find-a-target rounds', () => {
  it.each(manifest.landmarks.map((landmark) => [landmark.key, landmark] as const))(
    'ends a %s round at the reference view but not at the start position',
    (key, landmark) => {
      const id = labelId(key);
      const reference = referenceAreaMm2(volume, path, manifest, landmark, id);
      expect(reference).toBeGreaterThan(5);
      expect(targetHeld(frameAt(landmark), id, reference)).toBe(true);
      expect(targetHeld(frameAt(FIND_START), id, reference)).toBe(false);
    },
  );

  it('measures a structure in tissue millimetres, independent of the depth setting', () => {
    const landmark = manifest.landmarks.find((entry) => entry.key === 'left_adrenal')!;
    const id = labelId('left_adrenal');
    const shallow = structureAreaMm2(frameAt(landmark, { depthMm: 40 }), id);
    const deep = structureAreaMm2(frameAt(landmark, { depthMm: 70 }), id);
    expect(shallow).toBeGreaterThan(50);
    expect(Math.abs(shallow - deep) / shallow).toBeLessThan(0.15);
    expect(structureAreaMm2(frameAt(landmark), labelId('station_2l'))).toBe(0);
  });
});
