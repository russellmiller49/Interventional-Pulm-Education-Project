import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { scalar, type Point3 } from '@bronchoscopy-core/frame';

import {
  EUS_GROUP_NAMES,
  EUS_LANDMARK_BY_KEY,
  EUS_LANDMARKS,
  EUS_MODEL_LIMITS,
  EUS_PAINTED_CT_NOTE,
  isLayerGroup,
} from './content';
import {
  DEFAULT_EUS_CONTROLS,
  EUS_DEPTH_RANGE_MM,
  eusLabelAt,
  paintEusOverlay,
  renderEusFrame,
  sectorGeometry,
  type EusAcousticFrame,
} from './eusAcoustic';
import { orthogonalWindow, sampleCt } from './EusCtView';
import {
  clearLensDistanceMm,
  computeEusEndoscopeCamera,
  EUS_ENDOSCOPE_FOV_DEG,
  EUS_ENDOSCOPE_LENS_BACK_MM,
  EUS_ENDOSCOPE_OBLIQUITY_DEG,
} from './eusEndoscope';
import {
  computeEusPose,
  describeFacing,
  insertionDepthCm,
  normalizeRollDeg,
  scopeShaftPointAt,
  scopeShaftPolyline,
  wallContactMm,
} from './eusPose';
import { FIND_START, referenceAreaMm2, structureAreaMm2, targetHeld } from './findTarget';
import type { EusAcousticVolume, EusCaseManifest, EusCtVolume, EusScopePath } from './types';
import { validateEusAcousticVolume } from './useEusCase';

const root = resolve(process.cwd(), 'public/simulator/eus-b-case-001');
const json = <T,>(name: string): T => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
const manifest = json<EusCaseManifest>('case_manifest.json');
const path = json<EusScopePath>(manifest.assets.path);
const volume: EusAcousticVolume = {
  metadata: json(manifest.assets.acoustic.metadata),
  data: new Uint8Array(gunzipSync(readFileSync(resolve(root, manifest.assets.acoustic.data)))),
};
const ct: EusCtVolume = {
  asset: manifest.assets.ct,
  data: new Uint8Array(gunzipSync(readFileSync(resolve(root, manifest.assets.ct.data)))),
};
const labelId = (key: string) => volume.metadata.labels.find((label) => label.key === key)!.id;

/** Positions and triangle indices of the first mesh in a binary glTF file. */
function readGlbMesh(file: string) {
  const glb = readFileSync(resolve(root, file));
  const jsonLength = glb.readUInt32LE(12);
  const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  const binary = glb.subarray(20 + jsonLength + 8);
  const primitive = document.meshes[0].primitives[0];
  const floats = (accessorIndex: number, width: number) => {
    const accessor = document.accessors[accessorIndex],
      view = document.bufferViews[accessor.bufferView];
    return Float32Array.from({ length: accessor.count * width }, (_, at) =>
      binary.readFloatLE(view.byteOffset + at * 4),
    );
  };
  const indexAccessor = document.accessors[primitive.indices],
    indexView = document.bufferViews[indexAccessor.bufferView];
  const indices = Uint32Array.from({ length: indexAccessor.count }, (_, at) =>
    indexAccessor.componentType === 5123
      ? binary.readUInt16LE(indexView.byteOffset + at * 2)
      : binary.readUInt32LE(indexView.byteOffset + at * 4),
  );
  return {
    positions: floats(primitive.attributes.POSITION, 3),
    uv: floats(primitive.attributes.TEXCOORD_0, 2),
    indices,
  };
}
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
    const lumen = readFileSync(resolve(root, manifest.assets.lumen.asset));
    expect(createHash('sha256').update(lumen).digest('hex')).toBe(manifest.assets.lumen.sha256);
  });

  it('carries the structures of the current segmentation, each with its label and layer', () => {
    const keys = new Set(manifest.structures.map((structure) => structure.key));
    for (const key of [
      'spleen',
      'celiac_trunk',
      'superior_mesenteric_artery',
      'superior_mesenteric_vein',
      'portal_vein',
      'splenic_vein',
      'renal_arteries',
      'small_bowel',
      'colon',
      'left_kidney',
      'left_adrenal',
    ])
      expect(keys.has(key)).toBe(true);
    for (const structure of manifest.structures) {
      // Every structure can be switched off in 3D and has a kind to show under its name.
      expect(isLayerGroup(structure.group)).toBe(true);
      expect(EUS_GROUP_NAMES[structure.group]).toBeTruthy();
      if (structure.labelId !== undefined)
        expect(volume.metadata.labels[structure.labelId].key).toBe(structure.key);
    }
  });

  it('says stations 8 and 9 were drawn at their location, in the data and in the copy', () => {
    const noted = manifest.structures.filter((structure) => structure.note);
    expect(noted.map((structure) => structure.key).sort()).toEqual(['station_8', 'station_9']);
    for (const structure of noted) {
      expect(structure.note).toMatch(/Added for teaching.*showed no node/);
      expect(EUS_LANDMARK_BY_KEY.get(structure.key)!.note).toMatch(/added for teaching.*showed no node/);
    }
    expect(EUS_MODEL_LIMITS.some((limit) => /Stations 8 and 9 were added for teaching/.test(limit))).toBe(
      true,
    );
  });

  it('paints those two stations into the CT as nodes, and names them as painted', () => {
    // The CT view shows its note whenever one of these is in the image.
    expect(manifest.assets.ct.paintedStructures).toEqual(['station_8', 'station_9']);
    expect(EUS_PAINTED_CT_NOTE).toMatch(/painted into this CT.*showed no node/);
    const { sizeXyz, spacingXyzMm, originLps } = volume.metadata;
    const meanCtGray = (key: string) => {
      const id = labelId(key);
      let sum = 0,
        count = 0;
      for (let k = 0; k < sizeXyz[2]; k++)
        for (let j = 0; j < sizeXyz[1]; j++)
          for (let i = 0; i < sizeXyz[0]; i++)
            if (volume.data[(k * sizeXyz[1] + j) * sizeXyz[0] + i] === id) {
              sum += sampleCt(
                ct,
                originLps[0] + i * spacingXyzMm[0],
                originLps[1] + j * spacingXyzMm[1],
                originLps[2] + k * spacingXyzMm[2],
              );
              count++;
            }
      return sum / count;
    };
    const drawnNode = meanCtGray('station_7');
    // The patient's scan has fat at both stations; painted, they match this patient's real nodes.
    for (const key of ['station_8', 'station_9']) {
      expect(Math.abs(meanCtGray(key) - drawnNode)).toBeLessThan(30);
      expect(meanCtGray(key)).toBeGreaterThan(meanCtGray('fat') + 40);
    }
  });

  it('fills hollow viscera and the renal sinus with estimated contents that are never listed', () => {
    const voxels = new Uint32Array(256);
    for (let i = 0; i < volume.data.length; i++) voxels[volume.data[i]]++;
    for (const key of ['gastric_contents', 'gastric_gas', 'bowel_contents', 'bowel_gas', 'renal_sinus']) {
      const label = volume.metadata.labels.find((entry) => entry.key === key)!;
      expect(label.reportable).toBe(false);
      expect(voxels[label.id]).toBeGreaterThan(200);
    }
  });

  it('ships closed, consistently wound surfaces, which the cut faces rely on', () => {
    const glb = readFileSync(resolve(root, manifest.assets.model.asset));
    const jsonLength = glb.readUInt32LE(12);
    const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
    const binary = glb.subarray(20 + jsonLength + 8);
    expect(document.meshes.length).toBe(manifest.structures.length);
    for (const mesh of document.meshes) {
      const accessor = document.accessors[mesh.primitives[0].indices];
      const view = document.bufferViews[accessor.bufferView];
      const read = (at: number) =>
        accessor.componentType === 5123
          ? binary.readUInt16LE(view.byteOffset + at * 2)
          : binary.readUInt32LE(view.byteOffset + at * 4);
      // Per edge: how many triangles use it, and whether they run along it in opposite senses.
      const uses = new Map<number, number>(),
        sense = new Map<number, number>();
      for (let t = 0; t < accessor.count; t += 3)
        for (let e = 0; e < 3; e++) {
          const a = read(t + e),
            b = read(t + ((e + 1) % 3)),
            key = Math.min(a, b) * 1e6 + Math.max(a, b);
          uses.set(key, (uses.get(key) ?? 0) + 1);
          sense.set(key, (sense.get(key) ?? 0) + (a < b ? 1 : -1));
        }
      let open = 0,
        miswound = 0;
      uses.forEach((count, key) => {
        if (count === 1) open++;
        else if (count === 2 && sense.get(key) !== 0) miswound++;
      });
      // Decimation leaves the odd pinhole in the largest surfaces; nothing wider than that.
      expect(open / (accessor.count / 3), mesh.name).toBeLessThan(0.002);
      expect(miswound, mesh.name).toBe(0);
    }
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

describe('EUS-B endoscopic view', () => {
  const states = [
    { sMm: 4, rollDeg: 0, flexDeg: 0 },
    { sMm: 124, rollDeg: 27, flexDeg: 0 },
    { sMm: 240, rollDeg: -90, flexDeg: -35 },
    { sMm: 275, rollDeg: -170, flexDeg: 20 },
    { sMm: 355, rollDeg: 120, flexDeg: 0 },
  ];

  it('uses the EBUS endoscope’s nominal forward-oblique optics', () => {
    expect(EUS_ENDOSCOPE_OBLIQUITY_DEG).toBe(35);
    expect(EUS_ENDOSCOPE_FOV_DEG).toBe(80);
  });

  it.each(states)('looks forward and toward the transducer side at $sMm mm', (state) => {
    const pose = computeEusPose(path, state);
    const view = computeEusEndoscopeCamera(path, pose, state.sMm);
    expect(angleDeg(view.forwardLps, pose.shaftAxisLps)).toBeCloseTo(EUS_ENDOSCOPE_OBLIQUITY_DEG, 4);
    expect(scalar(view.forwardLps, pose.depthAxisLps)).toBeGreaterThan(0.5);
    // Image-up is the transducer side, and the scan plane is the image's vertical midline.
    expect(Math.abs(scalar(view.upLps, view.forwardLps))).toBeLessThan(1e-6);
    expect(scalar(view.upLps, pose.depthAxisLps)).toBeGreaterThan(0.8);
    expect(Math.abs(scalar(view.upLps, pose.planeNormalLps))).toBeLessThan(1e-6);
    expect(Math.abs(scalar(view.forwardLps, pose.planeNormalLps))).toBeLessThan(1e-6);
    // The lens rides the drawn scope shaft, a fixed distance behind the transducer.
    const lensAt = Math.max(0, state.sMm - EUS_ENDOSCOPE_LENS_BACK_MM);
    expect(view.eyeLps).toEqual(scopeShaftPointAt(path, pose, state.sMm, lensAt));
    expect(Math.hypot(...view.eyeLps.map((v, i) => v - view.anchorLps[i]))).toBeLessThanOrEqual(
      pose.contactMm + 1e-6,
    );
  });

  it('holds the lens off the wall', () => {
    expect(clearLensDistanceMm(null, 9)).toBe(9);
    expect(clearLensDistanceMm(20, 9)).toBe(9);
    expect(clearLensDistanceMm(10, 9, 3)).toBe(7);
    expect(clearLensDistanceMm(2, 9, 3)).toBe(0);
  });

  it('ships a lumen that encloses the scope path, pale above the junction and gastric below', () => {
    const { positions, uv, indices } = readGlbMesh(manifest.assets.lumen.asset);
    // Web frame: [left, superior, -posterior]. Count wall crossings along a ray: odd is inside.
    const inside = (lps: Point3) => {
      const origin = [lps[0], lps[2], -lps[1]],
        direction = [0.9876, 0.137, 0.0764];
      let crossings = 0;
      for (let t = 0; t < indices.length; t += 3) {
        const a = indices[t] * 3,
          b = indices[t + 1] * 3,
          c = indices[t + 2] * 3;
        const e1 = [0, 1, 2].map((k) => positions[b + k] - positions[a + k]),
          e2 = [0, 1, 2].map((k) => positions[c + k] - positions[a + k]);
        const p = [
          direction[1] * e2[2] - direction[2] * e2[1],
          direction[2] * e2[0] - direction[0] * e2[2],
          direction[0] * e2[1] - direction[1] * e2[0],
        ];
        const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
        if (Math.abs(det) < 1e-9) continue;
        const s = [0, 1, 2].map((k) => origin[k] - positions[a + k]);
        const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) / det;
        if (u < 0 || u > 1) continue;
        const q = [
          s[1] * e1[2] - s[2] * e1[1],
          s[2] * e1[0] - s[0] * e1[2],
          s[0] * e1[1] - s[1] * e1[0],
        ];
        const v = (direction[0] * q[0] + direction[1] * q[1] + direction[2] * q[2]) / det;
        if (v < 0 || u + v > 1) continue;
        if ((e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det > 1e-6) crossings++;
      }
      return crossings % 2 === 1;
    };
    for (let at = 0; at < path.pointsLps.length; at += 12) expect(inside(path.pointsLps[at])).toBe(true);
    for (const state of states)
      expect(inside(computeEusEndoscopeCamera(path, computeEusPose(path, state), state.sMm).anchorLps)).toBe(
        true,
      );

    // The first texture coordinate tells the mucosa shader which side of the junction it is on.
    const regionNear = (lps: Point3) => {
      let best = Infinity,
        region = 0;
      for (let vertex = 0; vertex < positions.length / 3; vertex++) {
        const distance = Math.hypot(
          positions[vertex * 3] - lps[0],
          positions[vertex * 3 + 1] - lps[2],
          positions[vertex * 3 + 2] + lps[1],
        );
        if (distance < best) {
          best = distance;
          region = uv[vertex * 2];
        }
      }
      return region;
    };
    expect(regionNear(path.pointsLps[Math.round(path.gejSMm / 2)])).toBeLessThan(0.05);
    expect(regionNear(path.pointsLps[path.pointsLps.length - 1])).toBeGreaterThan(0.95);
  });
});

describe('EUS-B CT planes', () => {
  it('shows the whole crop in axial slices', () => {
    const window = orthogonalWindow(ct, 'axial', path.pointsLps[100]);
    expect(window.acrossFrom).toBe(ct.asset.originLps[0]);
    expect(window.acrossMm).toBeCloseTo((ct.asset.sizeXyz[0] - 1) * ct.asset.spacingXyzMm[0], 6);
    expect(window.downMm).toBeCloseTo((ct.asset.sizeXyz[1] - 1) * ct.asset.spacingXyzMm[1], 6);
  });

  it.each(['coronal', 'sagittal'] as const)(
    'keeps the transducer inside a square %s window that stays within the CT',
    (plane) => {
      const superior = ct.asset.originLps[2] + (ct.asset.sizeXyz[2] - 1) * ct.asset.spacingXyzMm[2];
      for (const landmark of manifest.landmarks) {
        const origin = computeEusPose(path, landmark).originLps;
        const window = orthogonalWindow(ct, plane, origin);
        expect(window.downMm).toBeCloseTo(window.acrossMm, 6);
        expect(window.downFrom).toBeGreaterThanOrEqual(ct.asset.originLps[2]);
        expect(window.downFrom + window.downMm).toBeLessThanOrEqual(superior + 1e-6);
        expect(origin[2]).toBeGreaterThan(window.downFrom);
        expect(origin[2]).toBeLessThan(window.downFrom + window.downMm);
      }
    },
  );
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
    for (const organ of ['liver', 'spleen']) {
      const gray = meanGray(frameAt(manifest.landmarks.find((l) => l.key === organ)!), labelId(organ));
      expect(gray).toBeGreaterThan(60);
      expect(gray).toBeLessThan(150);
    }
    // Outside the sector is 0; air inside it is 255, never 0.
    expect(subcarinal.labelImage[0]).toBe(0);
    expect(subcarinal.rgba[0]).toBe(0);
  });

  it('reads the label under each pixel at that pixel’s own position', () => {
    // Pointing at the image names what is under the pointer, so this mapping must be exact.
    const landmark = manifest.landmarks.find((entry) => entry.key === 'celiac_trunk')!;
    const frame = frameAt(landmark),
      pose = computeEusPose(path, landmark);
    const { radius, apexX, apexY } = sectorGeometry(frame.width, frame.height, frame.controls.sectorAngleDeg);
    const mmPerPixel = frame.controls.depthMm / radius;
    let checked = 0;
    for (let y = 16; y < frame.height; y += 9)
      for (let x = 4; x < frame.width; x += 7) {
        const raw = frame.labelImage[y * frame.width + x];
        if (raw === 0) continue;
        const along = (y - apexY) * mmPerPixel,
          across = (x - apexX) * mmPerPixel;
        const at = pose.originLps.map(
          (value, axis) => value + pose.depthAxisLps[axis] * along + pose.lateralAxisLps[axis] * across,
        ) as Point3;
        expect(raw === 255 ? 0 : raw).toBe(eusLabelAt(volume, ...at));
        checked++;
      }
    expect(checked).toBeGreaterThan(100);
    expect(frame.structures.map((entry) => volume.metadata.labels[entry.id].key)).toContain('aorta');
  });

  it('outlines only the highlighted structure and tints only named structures', () => {
    const frame = frameAt(manifest.landmarks.find((entry) => entry.key === 'celiac_trunk')!);
    const id = labelId('celiac_trunk');
    const colors = volume.metadata.labels.map((label) =>
      label.reportable ? ([200, 60, 60] as [number, number, number]) : null,
    );
    const data = new Uint8ClampedArray(frame.width * frame.height * 4);
    const alphaAt = (x: number, y: number) => data[(y * frame.width + x) * 4 + 3];
    const isLabel = (x: number, y: number, wanted: number) =>
      x >= 0 && y >= 0 && x < frame.width && y < frame.height && frame.labelImage[y * frame.width + x] === wanted;

    paintEusOverlay(data, volume, frame, { colors, tint: false, activeId: null, highlightId: null });
    expect(data.every((value) => value === 0)).toBe(true);

    paintEusOverlay(data, volume, frame, { colors, tint: false, activeId: null, highlightId: id });
    let painted = 0,
      line = 0;
    for (let y = 0; y < frame.height; y++)
      for (let x = 0; x < frame.width; x++) {
        const alpha = alphaAt(x, y);
        if (!alpha) continue;
        painted++;
        if (alpha > 150) line++;
        // Nothing is painted more than a voxel (about 3 px here) from the structure.
        let near = false;
        for (let dy = -5; dy <= 5 && !near; dy++)
          for (let dx = -5; dx <= 5 && !near; dx++) near = isLabel(x + dx, y + dy, id);
        expect(near).toBe(true);
      }
    expect(painted).toBeGreaterThan(100);
    expect(line).toBeGreaterThan(20);
    expect(line).toBeLessThan(painted);

    paintEusOverlay(data, volume, frame, { colors, tint: true, activeId: id, highlightId: null });
    const centroid = (wanted: number) => {
      const entry = frame.structures.find((structure) => structure.id === wanted)!;
      return [Math.round(entry.x), Math.round(entry.y)] as const;
    };
    expect(alphaAt(...centroid(id))).toBeGreaterThan(alphaAt(...centroid(labelId('inferior_vena_cava'))));
    expect(alphaAt(...centroid(labelId('inferior_vena_cava')))).toBeGreaterThan(40);
    // Unsegmented soft tissue stays untinted, apart from the soft edge where it meets a named
    // structure in the image or just out of plane. Nothing is painted outside the sector.
    const named = (x: number, y: number) =>
      x >= 0 &&
      y >= 0 &&
      x < frame.width &&
      y < frame.height &&
      volume.metadata.labels[frame.labelImage[y * frame.width + x] % 255]?.reportable;
    let softChecked = 0,
      softTinted = 0;
    for (let y = 0; y < frame.height; y += 3)
      for (let x = 0; x < frame.width; x += 3) {
        if (!isLabel(x, y, labelId('soft_tissue'))) continue;
        let bordering = false;
        for (let dy = -5; dy <= 5 && !bordering; dy++)
          for (let dx = -5; dx <= 5 && !bordering; dx++) bordering = !!named(x + dx, y + dy);
        if (bordering) continue;
        softChecked++;
        if (alphaAt(x, y) > 0) softTinted++;
        // Less than the tint of a named structure that fills the pixel.
        expect(alphaAt(x, y)).toBeLessThan(82);
      }
    expect(softChecked).toBeGreaterThan(100);
    expect(softTinted / softChecked).toBeLessThan(0.05);
    expect(alphaAt(0, 0)).toBe(0);
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
