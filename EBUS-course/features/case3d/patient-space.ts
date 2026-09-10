import type {
  AxisMap,
  AxisName,
  CasePlane,
  Matrix3,
  Matrix4Tuple,
  SliceCrop,
  Vector3Tuple,
  VolumeGeometry,
} from './types';

export const FULL_SLICE_CROP: SliceCrop = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

const AXIS_ORDER: AxisName[] = ['i', 'j', 'k'];
const AXIS_PERMUTATIONS: AxisName[][] = [
  ['i', 'j', 'k'],
  ['i', 'k', 'j'],
  ['j', 'i', 'k'],
  ['j', 'k', 'i'],
  ['k', 'i', 'j'],
  ['k', 'j', 'i'],
];

export interface PlaneAxes {
  normalAxis: AxisName;
  uAxis: AxisName;
  vAxis: AxisName;
}

export interface PlanePose {
  basisU: Vector3Tuple;
  basisV: Vector3Tuple;
  center: Vector3Tuple;
  heightMm: number;
  normal: Vector3Tuple;
  widthMm: number;
}

export interface SceneBounds {
  center: Vector3Tuple;
  radius: number;
}

export function axisNameToIndex(axisName: AxisName): number {
  return AXIS_ORDER.indexOf(axisName);
}

export function clampUnit(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

export function clampOpacity(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return clampUnit(value);
}

export function normalizeSliceCrop(crop?: SliceCrop | null): SliceCrop {
  if (!crop) {
    return FULL_SLICE_CROP;
  }

  const x = clampUnit(crop.x);
  const y = clampUnit(crop.y);
  const width = clampUnit(crop.width);
  const height = clampUnit(crop.height);

  if (width <= 0 || height <= 0) {
    return FULL_SLICE_CROP;
  }

  return {
    x,
    y,
    width: Math.min(width, 1 - x),
    height: Math.min(height, 1 - y),
  };
}

export function addVectors(left: Vector3Tuple, right: Vector3Tuple): Vector3Tuple {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

export function subtractVectors(left: Vector3Tuple, right: Vector3Tuple): Vector3Tuple {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

export function scaleVector(vector: Vector3Tuple, scalar: number): Vector3Tuple {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

export function vectorLength(vector: Vector3Tuple) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

export function normalizeVector(vector: Vector3Tuple): Vector3Tuple {
  const length = vectorLength(vector);

  if (length <= 1e-8) {
    return [0, 0, 0];
  }

  return scaleVector(vector, 1 / length);
}

export function dotVectors(left: Vector3Tuple, right: Vector3Tuple) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

export function crossVectors(left: Vector3Tuple, right: Vector3Tuple): Vector3Tuple {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

export function buildDirectionMatrix(spaceDirections: Matrix3): Matrix3 {
  return [
    [spaceDirections[0][0], spaceDirections[1][0], spaceDirections[2][0]],
    [spaceDirections[0][1], spaceDirections[1][1], spaceDirections[2][1]],
    [spaceDirections[0][2], spaceDirections[1][2], spaceDirections[2][2]],
  ];
}

export function invertMatrix3(matrix: Matrix3): Matrix3 {
  const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
  const cofactor00 = e * i - f * h;
  const cofactor01 = -(d * i - f * g);
  const cofactor02 = d * h - e * g;
  const cofactor10 = -(b * i - c * h);
  const cofactor11 = a * i - c * g;
  const cofactor12 = -(a * h - b * g);
  const cofactor20 = b * f - c * e;
  const cofactor21 = -(a * f - c * d);
  const cofactor22 = a * e - b * d;
  const determinant = a * cofactor00 + b * cofactor01 + c * cofactor02;

  if (Math.abs(determinant) < 1e-8) {
    throw new Error('Unable to invert the CT direction matrix.');
  }

  return [
    [cofactor00 / determinant, cofactor10 / determinant, cofactor20 / determinant],
    [cofactor01 / determinant, cofactor11 / determinant, cofactor21 / determinant],
    [cofactor02 / determinant, cofactor12 / determinant, cofactor22 / determinant],
  ];
}

export function multiplyMatrixVector(matrix: Matrix3, vector: Vector3Tuple): Vector3Tuple {
  return [
    matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
    matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
    matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
  ];
}

export function worldToContinuousVoxel(pointLps: Vector3Tuple, geometry: Pick<VolumeGeometry, 'spaceDirections' | 'spaceOrigin'>): Vector3Tuple {
  const lpsToIjk = invertMatrix3(buildDirectionMatrix(geometry.spaceDirections));
  const relativePoint = subtractVectors(pointLps, geometry.spaceOrigin);

  return multiplyMatrixVector(lpsToIjk, relativePoint);
}

export function voxelToWorld(pointIjk: Vector3Tuple, geometry: Pick<VolumeGeometry, 'spaceDirections' | 'spaceOrigin'>): Vector3Tuple {
  return addVectors(
    geometry.spaceOrigin,
    addVectors(
      scaleVector(geometry.spaceDirections[0], pointIjk[0]),
      addVectors(
        scaleVector(geometry.spaceDirections[1], pointIjk[1]),
        scaleVector(geometry.spaceDirections[2], pointIjk[2]),
      ),
    ),
  );
}

export function clampContinuousVoxel(voxel: Vector3Tuple, sizes: Vector3Tuple): Vector3Tuple {
  return voxel.map((value, index) => {
    const upper = Math.max(0, sizes[index] - 1);
    return Math.min(upper, Math.max(0, value));
  }) as Vector3Tuple;
}

export function roundVoxel(voxel: Vector3Tuple, sizes: Vector3Tuple): Vector3Tuple {
  return clampContinuousVoxel(voxel, sizes).map((value) => Math.round(value)) as Vector3Tuple;
}

export function deriveAxisMap(spaceDirections: Matrix3): AxisMap {
  const scores = spaceDirections.map((vector) => vector.map((value) => Math.abs(value)) as Vector3Tuple);
  const ranked = AXIS_PERMUTATIONS
    .map((candidate) => {
      const sagittalIndex = AXIS_ORDER.indexOf(candidate[0]);
      const coronalIndex = AXIS_ORDER.indexOf(candidate[1]);
      const axialIndex = AXIS_ORDER.indexOf(candidate[2]);
      const score = scores[sagittalIndex][0] + scores[coronalIndex][1] + scores[axialIndex][2];

      return {
        candidate: {
          sagittal: candidate[0],
          coronal: candidate[1],
          axial: candidate[2],
        } satisfies AxisMap,
        score,
      };
    })
    .sort((left, right) => right.score - left.score);

  return ranked[0].candidate;
}

function normalizeVoxelIndex(index: number, axisLength: number): number {
  if (axisLength <= 1) {
    return 0;
  }

  return Math.min(1, Math.max(0, index / (axisLength - 1)));
}

export function buildNormalizedPositions(roundedVoxel: Vector3Tuple, sizes: Vector3Tuple, axisMap: AxisMap): Record<CasePlane, number> {
  return {
    sagittal: normalizeVoxelIndex(roundedVoxel[axisNameToIndex(axisMap.sagittal)], sizes[axisNameToIndex(axisMap.sagittal)]),
    coronal: normalizeVoxelIndex(roundedVoxel[axisNameToIndex(axisMap.coronal)], sizes[axisNameToIndex(axisMap.coronal)]),
    axial: normalizeVoxelIndex(roundedVoxel[axisNameToIndex(axisMap.axial)], sizes[axisNameToIndex(axisMap.axial)]),
  };
}

export function buildIjkToWorldMatrix4(geometry: Pick<VolumeGeometry, 'spaceDirections' | 'spaceOrigin'>): Matrix4Tuple {
  const i = geometry.spaceDirections[0];
  const j = geometry.spaceDirections[1];
  const k = geometry.spaceDirections[2];
  const origin = geometry.spaceOrigin;

  return [
    i[0], j[0], k[0], origin[0],
    i[1], j[1], k[1], origin[1],
    i[2], j[2], k[2], origin[2],
    0, 0, 0, 1,
  ];
}

export function buildWorldToIjkMatrix4(geometry: Pick<VolumeGeometry, 'spaceDirections' | 'spaceOrigin'>): Matrix4Tuple {
  const inverse = invertMatrix3(buildDirectionMatrix(geometry.spaceDirections));
  const translation = multiplyMatrixVector(inverse, scaleVector(geometry.spaceOrigin, -1));

  return [
    inverse[0][0], inverse[0][1], inverse[0][2], translation[0],
    inverse[1][0], inverse[1][1], inverse[1][2], translation[1],
    inverse[2][0], inverse[2][1], inverse[2][2], translation[2],
    0, 0, 0, 1,
  ];
}

export function buildPatientToSceneMatrix(): Matrix4Tuple {
  return [
    0.001, 0, 0, 0,
    0, 0, 0.001, 0,
    0, -0.001, 0, 0,
    0, 0, 0, 1,
  ];
}

export function buildSceneToPatientMatrix(): Matrix4Tuple {
  return [
    1000, 0, 0, 0,
    0, 0, -1000, 0,
    0, 1000, 0, 0,
    0, 0, 0, 1,
  ];
}

export function applyMatrix4ToPoint(matrix: Matrix4Tuple, point: Vector3Tuple): Vector3Tuple {
  const [x, y, z] = point;

  return [
    matrix[0] * x + matrix[1] * y + matrix[2] * z + matrix[3],
    matrix[4] * x + matrix[5] * y + matrix[6] * z + matrix[7],
    matrix[8] * x + matrix[9] * y + matrix[10] * z + matrix[11],
  ];
}

export function toSceneCoordinates(position: Vector3Tuple): Vector3Tuple {
  return applyMatrix4ToPoint(buildPatientToSceneMatrix(), position);
}

export function getVolumeCenterWorld(geometry: Pick<VolumeGeometry, 'sizes' | 'spaceDirections' | 'spaceOrigin'>): Vector3Tuple {
  return voxelToWorld(
    [
      (geometry.sizes[0] - 1) / 2,
      (geometry.sizes[1] - 1) / 2,
      (geometry.sizes[2] - 1) / 2,
    ],
    geometry,
  );
}

export function getVolumeSceneBounds(geometry: Pick<VolumeGeometry, 'sizes' | 'spaceDirections' | 'spaceOrigin'>): SceneBounds {
  const patientToScene = buildPatientToSceneMatrix();
  const corners: Vector3Tuple[] = [];

  for (const i of [0, geometry.sizes[0] - 1]) {
    for (const j of [0, geometry.sizes[1] - 1]) {
      for (const k of [0, geometry.sizes[2] - 1]) {
        corners.push(applyMatrix4ToPoint(patientToScene, voxelToWorld([i, j, k], geometry)));
      }
    }
  }

  const center = corners.reduce(
    (accumulator, corner) => [
      accumulator[0] + corner[0] / corners.length,
      accumulator[1] + corner[1] / corners.length,
      accumulator[2] + corner[2] / corners.length,
    ],
    [0, 0, 0] as Vector3Tuple,
  );

  return {
    center,
    radius: Math.max(
      0.12,
      ...corners.map((corner) =>
        Math.hypot(corner[0] - center[0], corner[1] - center[1], corner[2] - center[2]),
      ),
    ),
  };
}

export function getPlaneAxes(axisMap: AxisMap, plane: CasePlane): PlaneAxes {
  switch (plane) {
    case 'axial':
      return {
        normalAxis: axisMap.axial,
        uAxis: axisMap.sagittal,
        vAxis: axisMap.coronal,
      };
    case 'coronal':
      return {
        normalAxis: axisMap.coronal,
        uAxis: axisMap.sagittal,
        vAxis: axisMap.axial,
      };
    case 'sagittal':
      return {
        normalAxis: axisMap.sagittal,
        uAxis: axisMap.coronal,
        vAxis: axisMap.axial,
      };
  }
}

export function getPlanePoseAtAxisIndex(
  geometry: VolumeGeometry,
  plane: CasePlane,
  continuousAxisIndex: number,
): PlanePose {
  const axes = getPlaneAxes(geometry.axisMap, plane);
  const normalIndex = axisNameToIndex(axes.normalAxis);
  const uIndex = axisNameToIndex(axes.uAxis);
  const vIndex = axisNameToIndex(axes.vAxis);
  const uDirection = scaleVector(geometry.spaceDirections[uIndex], -1);
  const vDirection = geometry.spaceDirections[vIndex];
  const normalDirection = geometry.spaceDirections[normalIndex];
  const center = addVectors(
    voxelToWorld(
      [
        axes.normalAxis === 'i' ? continuousAxisIndex : (geometry.sizes[0] - 1) / 2,
        axes.normalAxis === 'j' ? continuousAxisIndex : (geometry.sizes[1] - 1) / 2,
        axes.normalAxis === 'k' ? continuousAxisIndex : (geometry.sizes[2] - 1) / 2,
      ],
      geometry,
    ),
    [0, 0, 0],
  );

  return {
    basisU: normalizeVector(uDirection),
    basisV: normalizeVector(vDirection),
    center,
    widthMm: vectorLength(uDirection) * Math.max(geometry.sizes[uIndex] - 1, 1),
    heightMm: vectorLength(vDirection) * Math.max(geometry.sizes[vIndex] - 1, 1),
    normal: normalizeVector(normalDirection),
  };
}

export function frameIndexToVolumeProgress(
  frameIndex: number,
  frameCount: number,
  coverageAssumption: [number, number],
): number {
  if (frameCount <= 1) {
    return coverageAssumption[0];
  }

  const seriesProgress = clampUnit(frameIndex / (frameCount - 1));
  const [start, end] = coverageAssumption;

  return start + seriesProgress * (end - start);
}

export function volumeProgressToContinuousAxisIndex(volumeProgress: number, axisLength: number): number {
  if (axisLength <= 1) {
    return 0;
  }

  return clampUnit(volumeProgress) * (axisLength - 1);
}

export function frameIndexToContinuousAxisIndex(
  frameIndex: number,
  frameCount: number,
  axisLength: number,
  coverageAssumption: [number, number],
): number {
  return volumeProgressToContinuousAxisIndex(
    frameIndexToVolumeProgress(frameIndex, frameCount, coverageAssumption),
    axisLength,
  );
}

export function projectWorldPointToPlaneUv(
  point: Vector3Tuple,
  pose: PlanePose,
): { u: number; v: number } {
  const relative = subtractVectors(point, pose.center);
  const uMm = dotVectors(relative, pose.basisU);
  const vMm = dotVectors(relative, pose.basisV);

  return {
    u: clampUnit(0.5 + uMm / Math.max(pose.widthMm, 1)),
    v: clampUnit(0.5 + vMm / Math.max(pose.heightMm, 1)),
  };
}
