import fs from 'node:fs';
import path from 'node:path';

import {
  axisNameToIndex as axisNameToIndexShared,
  buildIjkToWorldMatrix4,
  buildNormalizedPositions as buildNormalizedPositionsShared,
  buildPatientToSceneMatrix,
  buildSceneToPatientMatrix,
  buildWorldToIjkMatrix4,
  clampContinuousVoxel as clampContinuousVoxelShared,
  deriveAxisMap as deriveAxisMapShared,
  FULL_SLICE_CROP,
  getPlaneAxes,
  normalizeSliceCrop,
  roundVoxel as roundVoxelShared,
  toSceneCoordinates,
  vectorLength,
  voxelToWorld,
  worldToContinuousVoxel as worldToContinuousVoxelShared,
} from '../features/case3d/patient-space';
import { mapNormalizedToFrameIndex } from '../features/case3d/slice-logic';
import type {
  AxisMap,
  AxisName,
  CaseManifest,
  CasePlane,
  CaseTarget,
  EnrichedCaseManifest,
  EnrichedCaseTarget,
  Matrix3,
  SliceCrop,
  SliceIndex,
  SliceTextureMetadata,
  ToggleSetId,
  RuntimeCaseManifest,
  RuntimeCaseTarget,
  SegmentationGroupId,
  SegmentationSegment,
  SegmentationVolumeGeometry,
  Vector3Tuple,
  VolumeGeometry,
  WorldBounds,
} from '../features/case3d/types';

const PLANES: CasePlane[] = ['axial', 'coronal', 'sagittal'];
const DEFAULT_GENERATED_DIR = path.join('content', 'cases', 'generated');
const ENRICHED_MANIFEST_PATH = path.join(DEFAULT_GENERATED_DIR, 'case_001.enriched.json');
const RUNTIME_MANIFEST_PATH = path.join('content', 'cases', 'case_001.runtime.json');

type Vector3 = Vector3Tuple;

interface ParsedMarkup {
  coordinateSystem: string;
  position: Vector3;
}

export type NrrdGeometry = Pick<VolumeGeometry, 'sizes' | 'spaceDirections' | 'spaceOrigin'>;

interface ResolvedCasePaths {
  manifestPath: string;
  ctVolumePath: string;
  glbPath: string;
  segmentationPath: string | null;
}

export interface GeneratedCaseOutputs {
  enrichedManifest: EnrichedCaseManifest;
  runtimeManifest: RuntimeCaseManifest;
  enrichedManifestPath: string;
  runtimeManifestPath: string;
}

interface SegmentationHeaderSegment {
  index: number;
  id: string;
  name: string;
  labelValue: number;
  layer: number;
  color: Vector3;
  extent: [number, number, number, number, number, number];
}

interface ParsedSegmentationHeader {
  componentCount: number;
  sizes: Vector3;
  spaceDirections: Matrix3;
  spaceOrigin: Vector3;
  referenceImageGeometry?: string;
  segments: SegmentationHeaderSegment[];
}

export function naturalCompare(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export function readSeedManifest(manifestPath: string): CaseManifest {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as CaseManifest;
}

export function parseMarkupFile(fileContents: string, filePath = 'markup'): ParsedMarkup {
  const parsed = JSON.parse(fileContents) as {
    markups?: Array<{
      coordinateSystem?: unknown;
      controlPoints?: Array<{
        position?: unknown;
      }>;
    }>;
  };
  const markups = parsed.markups;

  if (!Array.isArray(markups) || markups.length === 0) {
    throw new Error(`${filePath} is missing markups[0].`);
  }

  const firstMarkup = markups[0];
  const controlPoints = firstMarkup.controlPoints;

  if (!Array.isArray(controlPoints) || controlPoints.length === 0) {
    throw new Error(`${filePath} is missing markups[0].controlPoints[0].`);
  }

  const firstPoint = controlPoints[0];

  if (
    !Array.isArray(firstPoint.position) ||
    firstPoint.position.length !== 3 ||
    firstPoint.position.some((value) => typeof value !== 'number' || Number.isNaN(value))
  ) {
    throw new Error(`${filePath} has a non-numeric markups[0].controlPoints[0].position.`);
  }

  return {
    coordinateSystem: typeof firstMarkup.coordinateSystem === 'string' ? firstMarkup.coordinateSystem : 'UNKNOWN',
    position: [firstPoint.position[0], firstPoint.position[1], firstPoint.position[2]],
  };
}

export function extractNrrdHeader(buffer: Buffer): string {
  const doubleLf = buffer.indexOf('\n\n');

  if (doubleLf >= 0) {
    return buffer.slice(0, doubleLf).toString('utf8');
  }

  const doubleCrLf = buffer.indexOf('\r\n\r\n');

  if (doubleCrLf >= 0) {
    return buffer.slice(0, doubleCrLf).toString('utf8');
  }

  throw new Error('Unable to locate the NRRD header separator.');
}

function parseVector3(fieldValue: string, fieldName: string): Vector3 {
  const values = fieldValue
    .trim()
    .replace(/^\(/, '')
    .replace(/\)$/, '')
    .split(',')
    .map((value) => Number(value.trim()));

  if (values.length !== 3 || values.some((value) => Number.isNaN(value))) {
    throw new Error(`Unable to parse ${fieldName} as a 3D vector.`);
  }

  return [values[0], values[1], values[2]];
}

export function parseNrrdHeader(input: string | Buffer): NrrdGeometry {
  const headerText = Buffer.isBuffer(input) ? extractNrrdHeader(input) : input;
  const sizesMatch = headerText.match(/^sizes:\s*([^\n\r]+)$/m);
  const directionsMatch = headerText.match(/^space directions:\s*([^\n\r]+)$/m);
  const originMatch = headerText.match(/^space origin:\s*(\([^)]+\))$/m);

  if (!sizesMatch) {
    throw new Error('NRRD header is missing sizes.');
  }

  if (!directionsMatch) {
    throw new Error('NRRD header is missing space directions.');
  }

  if (!originMatch) {
    throw new Error('NRRD header is missing space origin.');
  }

  const sizes = sizesMatch[1]
    .trim()
    .split(/\s+/)
    .map((value) => Number(value)) as Vector3;

  if (sizes.length !== 3 || sizes.some((value) => !Number.isFinite(value))) {
    throw new Error('NRRD header sizes must describe exactly three numeric axes.');
  }

  const directionMatches = [...directionsMatch[1].matchAll(/\([^)]+\)/g)];

  if (directionMatches.length !== 3) {
    throw new Error('NRRD header must contain exactly three space direction vectors.');
  }

  return {
    sizes,
    spaceDirections: [
      parseVector3(directionMatches[0][0], 'space directions[0]'),
      parseVector3(directionMatches[1][0], 'space directions[1]'),
      parseVector3(directionMatches[2][0], 'space directions[2]'),
    ],
    spaceOrigin: parseVector3(originMatch[1], 'space origin'),
  };
}

function parseIntegerTuple(fieldValue: string, fieldName: string, expectedLength: number) {
  const values = fieldValue
    .trim()
    .split(/\s+/)
    .map((value) => Number(value));

  if (values.length !== expectedLength || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Unable to parse ${fieldName} as ${expectedLength} integers.`);
  }

  return values as number[];
}

function parseSegmentationHeader(input: string | Buffer): ParsedSegmentationHeader {
  const headerText = Buffer.isBuffer(input) ? extractNrrdHeader(input) : input;
  const dimensionMatch = headerText.match(/^dimension:\s*(\d+)$/m);
  const sizesMatch = headerText.match(/^sizes:\s*([^\n\r]+)$/m);
  const directionsMatch = headerText.match(/^space directions:\s*([^\n\r]+)$/m);
  const originMatch = headerText.match(/^space origin:\s*(\([^)]+\))$/m);
  const referenceImageGeometryMatch = headerText.match(/^Segmentation_ConversionParameters:=.*Reference image geometry\|([^|]+)\|/m);

  if (!dimensionMatch || Number(dimensionMatch[1]) !== 4) {
    throw new Error('Segmentation NRRD must be 4D with a leading list axis.');
  }

  if (!sizesMatch || !directionsMatch || !originMatch) {
    throw new Error('Segmentation NRRD header is missing required geometry fields.');
  }

  const sizes = parseIntegerTuple(sizesMatch[1], 'segmentation sizes', 4);
  const directionEntries = directionsMatch[1].match(/(?:\([^)]+\)|none)/g);

  if (!directionEntries || directionEntries.length !== 4) {
    throw new Error('Segmentation NRRD must declare exactly four space direction entries.');
  }

  if (directionEntries[0] !== 'none') {
    throw new Error('Segmentation NRRD must use a non-spatial leading list axis.');
  }

  const segmentMap = new Map<number, Partial<SegmentationHeaderSegment>>();
  const segmentPattern = /^Segment(\d+)_([A-Za-z]+):=(.*)$/gm;
  let match = segmentPattern.exec(headerText);

  while (match) {
    const index = Number(match[1]);
    const key = match[2];
    const rawValue = match[3].trim();
    const existing = segmentMap.get(index) ?? { index };

    switch (key) {
      case 'Color': {
        const color = rawValue.split(/\s+/).map((value) => Number(value));

        if (color.length === 3 && color.every((value) => Number.isFinite(value))) {
          existing.color = [color[0], color[1], color[2]];
        }
        break;
      }
      case 'Extent': {
        const extent = rawValue.split(/\s+/).map((value) => Number(value));

        if (extent.length === 6 && extent.every((value) => Number.isFinite(value))) {
          existing.extent = extent as [number, number, number, number, number, number];
        }
        break;
      }
      case 'ID':
        existing.id = rawValue;
        break;
      case 'LabelValue':
        existing.labelValue = Number(rawValue);
        break;
      case 'Layer':
        existing.layer = Number(rawValue);
        break;
      case 'Name':
        existing.name = rawValue;
        break;
      default:
        break;
    }

    segmentMap.set(index, existing);
    match = segmentPattern.exec(headerText);
  }

  const segments = [...segmentMap.values()]
    .filter(
      (segment): segment is SegmentationHeaderSegment =>
        typeof segment.id === 'string' &&
        typeof segment.name === 'string' &&
        typeof segment.labelValue === 'number' &&
        typeof segment.layer === 'number' &&
        Boolean(segment.color) &&
        Boolean(segment.extent),
    )
    .sort((left, right) => left.index - right.index);

  return {
    componentCount: sizes[0],
    sizes: [sizes[1], sizes[2], sizes[3]],
    spaceDirections: [
      parseVector3(directionEntries[1], 'segmentation space directions[0]'),
      parseVector3(directionEntries[2], 'segmentation space directions[1]'),
      parseVector3(directionEntries[3], 'segmentation space directions[2]'),
    ],
    spaceOrigin: parseVector3(originMatch[1], 'segmentation space origin'),
    referenceImageGeometry: referenceImageGeometryMatch?.[1],
    segments,
  };
}

export function worldToContinuousVoxel(pointLps: Vector3, geometry: NrrdGeometry): Vector3 {
  return worldToContinuousVoxelShared(pointLps, geometry);
}

export function clampContinuousVoxel(voxel: Vector3, sizes: Vector3): Vector3 {
  return clampContinuousVoxelShared(voxel, sizes);
}

export function roundVoxel(voxel: Vector3, sizes: Vector3): Vector3 {
  return roundVoxelShared(voxel, sizes);
}

export function deriveAxisMap(spaceDirections: Matrix3): AxisMap {
  return deriveAxisMapShared(spaceDirections);
}

function axisNameToIndex(axis: AxisName): number {
  return axisNameToIndexShared(axis);
}

export function buildNormalizedPositions(roundedVoxel: Vector3, sizes: Vector3, axisMap: AxisMap): Record<CasePlane, number> {
  return buildNormalizedPositionsShared(roundedVoxel, sizes, axisMap);
}

function usesDefaultCoverageAssumption(coverageAssumption?: [number, number]) {
  return !coverageAssumption || (coverageAssumption[0] === 0 && coverageAssumption[1] === 1);
}

export function mapFrameIndex(
  normalizedPosition: number,
  voxelIndex: number,
  voxelAxisLength: number,
  frameCount: number,
  coverageAssumption?: [number, number],
): number {
  if (frameCount <= 1) {
    return 0;
  }

  if (frameCount === voxelAxisLength && usesDefaultCoverageAssumption(coverageAssumption)) {
    return Math.min(frameCount - 1, Math.max(0, voxelIndex));
  }

  return mapNormalizedToFrameIndex(normalizedPosition, frameCount, coverageAssumption);
}

function buildWorldBounds(geometry: Pick<VolumeGeometry, 'sizes' | 'spaceDirections' | 'spaceOrigin'>): WorldBounds {
  const corners: Vector3[] = [];

  for (const i of [0, geometry.sizes[0] - 1]) {
    for (const j of [0, geometry.sizes[1] - 1]) {
      for (const k of [0, geometry.sizes[2] - 1]) {
        corners.push(voxelToWorld([i, j, k], geometry));
      }
    }
  }

  return {
    coordinateSystem: 'LPS',
    min: [
      Math.min(...corners.map((corner) => corner[0])),
      Math.min(...corners.map((corner) => corner[1])),
      Math.min(...corners.map((corner) => corner[2])),
    ],
    max: [
      Math.max(...corners.map((corner) => corner[0])),
      Math.max(...corners.map((corner) => corner[1])),
      Math.max(...corners.map((corner) => corner[2])),
    ],
  };
}

function mergeWorldBounds(bounds: WorldBounds[]): WorldBounds {
  return {
    coordinateSystem: 'LPS',
    min: [
      Math.min(...bounds.map((entry) => entry.min[0])),
      Math.min(...bounds.map((entry) => entry.min[1])),
      Math.min(...bounds.map((entry) => entry.min[2])),
    ],
    max: [
      Math.max(...bounds.map((entry) => entry.max[0])),
      Math.max(...bounds.map((entry) => entry.max[1])),
      Math.max(...bounds.map((entry) => entry.max[2])),
    ],
  };
}

function normalizeLookupKey(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/station\s+/g, 'station ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function classifySegmentationGroup(name: string): SegmentationGroupId {
  const normalized = name.toLowerCase();

  if (normalized.startsWith('station ')) {
    return 'nodes';
  }

  if (
    normalized.includes('airway') ||
    normalized.includes('trachea') ||
    normalized.includes('carina') ||
    normalized.includes('mainstem') ||
    normalized.includes('bronchus')
  ) {
    return 'airway';
  }

  if (normalized.includes('esophagus')) {
    return 'gi';
  }

  if (
    normalized.includes('atrium') ||
    normalized.includes('ventricle') ||
    normalized.includes('appendage') ||
    normalized.includes('cardiac')
  ) {
    return 'cardiac';
  }

  if (
    normalized.includes('artery') ||
    normalized.includes('vein') ||
    normalized.includes('aorta') ||
    normalized.includes('vena') ||
    normalized.includes('vascular') ||
    normalized.includes('pulmonary')
  ) {
    return 'vessels';
  }

  return 'other';
}

function isPointInsideGeometry(pointLps: Vector3, geometry: NrrdGeometry, tolerance = 0) {
  const voxel = worldToContinuousVoxel(pointLps, geometry);

  return voxel.every((value, index) => value >= -tolerance && value <= geometry.sizes[index] - 1 + tolerance);
}

export function parseGlbMeshNames(buffer: Buffer): string[] {
  const magic = buffer.toString('utf8', 0, 4);

  if (magic !== 'glTF') {
    throw new Error('The GLB file is missing the glTF header.');
  }

  let offset = 12;
  let jsonChunk: Buffer | null = null;

  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    offset += 4;
    const chunkType = buffer.toString('utf8', offset, offset + 4);
    offset += 4;
    const chunkData = buffer.slice(offset, offset + chunkLength);
    offset += chunkLength;

    if (chunkType === 'JSON') {
      jsonChunk = chunkData;
      break;
    }
  }

  if (!jsonChunk) {
    throw new Error('The GLB file does not contain a JSON chunk.');
  }

  const parsed = JSON.parse(jsonChunk.toString('utf8')) as {
    meshes?: Array<{
      name?: string;
    }>;
  };

  return (parsed.meshes ?? []).flatMap((mesh) => (typeof mesh.name === 'string' ? [mesh.name] : []));
}

function ensurePathExists(filePath: string, description: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${description} not found: ${filePath}`);
  }

  return filePath;
}

export function resolveRepoPath(rootDir: string, repoRelativePath: string): string {
  const normalized = repoRelativePath.replace(/\\/g, '/').replace(/^\.\//, '');
  const segments = normalized.split('/').filter(Boolean);

  if (segments.length === 0) {
    throw new Error('Cannot resolve an empty repository path.');
  }

  let current = rootDir;

  for (const segment of segments) {
    const direct = path.join(current, segment);

    if (fs.existsSync(direct)) {
      current = direct;
      continue;
    }

    const lowered = path.join(current, segment.toLowerCase());

    if (fs.existsSync(lowered)) {
      current = lowered;
      continue;
    }

    const entries = fs.readdirSync(current, { withFileTypes: true });
    const matchedEntry = entries.find((entry) => entry.name.toLowerCase() === segment.toLowerCase());

    if (!matchedEntry) {
      throw new Error(`Unable to resolve ${repoRelativePath} from ${rootDir}.`);
    }

    current = path.join(current, matchedEntry.name);
  }

  return current;
}

export function tryResolveRepoPath(rootDir: string, repoRelativePath: string): string | null {
  try {
    return resolveRepoPath(rootDir, repoRelativePath);
  } catch {
    return null;
  }
}

export function listSliceSeriesFiles(rootDir: string, folderPath: string): string[] {
  const absoluteFolder = resolveRepoPath(rootDir, folderPath);

  return fs
    .readdirSync(absoluteFolder)
    .filter((name) => name.toLowerCase().endsWith('.png'))
    .sort(naturalCompare);
}

function readPngSize(filePath: string) {
  const buffer = fs.readFileSync(filePath);

  if (buffer.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`Slice texture is not a PNG: ${filePath}`);
  }

  return {
    pixelWidth: buffer.readUInt32BE(16),
    pixelHeight: buffer.readUInt32BE(20),
  };
}

function buildSliceTextureMetadata(
  rootDir: string,
  manifest: CaseManifest,
  geometry: VolumeGeometry,
  sliceFiles: Record<CasePlane, string[]>,
  warnings: string[],
): Record<CasePlane, SliceTextureMetadata> {
  return PLANES.reduce(
    (metadata, plane) => {
      const files = sliceFiles[plane];
      const entry = manifest.sliceSeries[plane];
      const absoluteFolder = resolveRepoPath(rootDir, entry.folder);
      const sizes = files.map((fileName) => readPngSize(path.join(absoluteFolder, fileName)));
      const firstSize = sizes[0] ?? { pixelWidth: 0, pixelHeight: 0 };
      const mixedDimensions = sizes.some(
        (size) => size.pixelWidth !== firstSize.pixelWidth || size.pixelHeight !== firstSize.pixelHeight,
      );
      const planeAxes = getPlaneAxes(geometry.axisMap, plane);
      const widthMm =
        vectorLength(geometry.spaceDirections[axisNameToIndex(planeAxes.uAxis)]) *
        Math.max(geometry.sizes[axisNameToIndex(planeAxes.uAxis)] - 1, 1);
      const heightMm =
        vectorLength(geometry.spaceDirections[axisNameToIndex(planeAxes.vAxis)]) *
        Math.max(geometry.sizes[axisNameToIndex(planeAxes.vAxis)] - 1, 1);
      const physicalAspect = widthMm / Math.max(heightMm, 1);
      const textureAspect = firstSize.pixelWidth / Math.max(firstSize.pixelHeight, 1);
      const crop = normalizeSliceCrop(entry.crop);
      const aspectDelta = Math.abs(textureAspect - physicalAspect) / Math.max(physicalAspect, 1e-6);
      const sourceLooksCropped =
        mixedDimensions ||
        aspectDelta > 0.08 ||
        crop.x !== FULL_SLICE_CROP.x ||
        crop.y !== FULL_SLICE_CROP.y ||
        crop.width !== FULL_SLICE_CROP.width ||
        crop.height !== FULL_SLICE_CROP.height;
      const warning = sourceLooksCropped
        ? `${plane} slice textures look cropped or viewport-exported relative to CT geometry; use crop metadata for clean co-registration.`
        : null;

      if (warning && !warnings.includes(warning)) {
        warnings.push(warning);
      }

      metadata[plane] = {
        pixelWidth: firstSize.pixelWidth,
        pixelHeight: firstSize.pixelHeight,
        crop,
        sourceLooksCropped,
        warning,
      };

      return metadata;
    },
    {} as Record<CasePlane, SliceTextureMetadata>,
  );
}

function isPointInsideExtentLazily(pointLps: Vector3, geometry: NrrdGeometry): boolean {
  const voxel = worldToContinuousVoxel(pointLps, geometry);

  return voxel.every((value, index) => value >= -1 && value <= geometry.sizes[index] + 1);
}

export function toLpsPosition(markup: ParsedMarkup, geometry: NrrdGeometry, warnings: string[], filePath: string): Vector3 {
  if (markup.coordinateSystem === 'LPS') {
    return markup.position;
  }

  if (markup.coordinateSystem === 'RAS') {
    return [-markup.position[0], -markup.position[1], markup.position[2]];
  }

  if (isPointInsideExtentLazily(markup.position, geometry)) {
    warnings.push(`${filePath} uses ${markup.coordinateSystem}; defaulting to LPS because the point is inside the CT extent.`);
    return markup.position;
  }

  throw new Error(
    `${filePath} uses unknown coordinateSystem "${markup.coordinateSystem}" and the default LPS interpretation falls outside the CT extent.`,
  );
}

function resolveMeshName(meshNameExpected: string | undefined, meshNames: string[]): string | null {
  if (!meshNameExpected) {
    return null;
  }

  const exactMatch = meshNames.find((meshName) => meshName === meshNameExpected);

  if (exactMatch) {
    return exactMatch;
  }

  const caseInsensitiveMatch = meshNames.find(
    (meshName) => meshName.toLowerCase() === meshNameExpected.toLowerCase(),
  );

  return caseInsensitiveMatch ?? null;
}

export function classifyStructureGroup(target: Pick<CaseTarget, 'kind' | 'id' | 'displayLabel'>, meshNameResolved: string | null): ToggleSetId {
  if (target.kind === 'lymph_node') {
    return 'lymph_nodes';
  }

  const haystack = `${target.id} ${target.displayLabel} ${meshNameResolved ?? ''}`.toLowerCase();

  if (haystack.includes('esophagus')) {
    return 'gi';
  }

  if (
    haystack.includes('airway') ||
    haystack.includes('trachea') ||
    haystack.includes('carina') ||
    haystack.includes('mainstem') ||
    haystack.includes('bronchus')
  ) {
    return 'airway';
  }

  if (
    haystack.includes('atrium') ||
    haystack.includes('ventricle') ||
    haystack.includes('appendage') ||
    haystack.includes('cardiac')
  ) {
    return 'cardiac';
  }

  return 'vessels';
}

function buildVoxelIndex(axisMap: AxisMap, roundedVoxel: Vector3): SliceIndex {
  return {
    axial: roundedVoxel[axisNameToIndex(axisMap.axial)],
    coronal: roundedVoxel[axisNameToIndex(axisMap.coronal)],
    sagittal: roundedVoxel[axisNameToIndex(axisMap.sagittal)],
  };
}

function buildSegmentationGeometry(segmentationHeader: ParsedSegmentationHeader): SegmentationVolumeGeometry {
  const geometry: NrrdGeometry = {
    sizes: segmentationHeader.sizes,
    spaceDirections: segmentationHeader.spaceDirections,
    spaceOrigin: segmentationHeader.spaceOrigin,
  };

  return {
    coordinateSystem: 'LPS',
    sizes: segmentationHeader.sizes,
    componentCount: segmentationHeader.componentCount,
    spaceDirections: segmentationHeader.spaceDirections,
    spaceOrigin: segmentationHeader.spaceOrigin,
    ijkToWorldMatrix: buildIjkToWorldMatrix4(geometry),
    worldToIjkMatrix: buildWorldToIjkMatrix4(geometry),
    worldBounds: buildWorldBounds(geometry),
    referenceImageGeometry: segmentationHeader.referenceImageGeometry,
  };
}

function buildSegmentationSegments(
  segments: ParsedSegmentationHeader['segments'],
  targets: EnrichedCaseTarget[],
): SegmentationSegment[] {
  const targetsByMeshKey = new Map<string, EnrichedCaseTarget[]>();

  targets.forEach((target) => {
    const keys = new Set<string>([
      normalizeLookupKey(target.meshNameResolved),
      normalizeLookupKey(target.meshNameExpected),
      normalizeLookupKey(target.displayLabel),
      normalizeLookupKey(target.stationGroupId ? `Station ${target.stationGroupId}` : null),
      normalizeLookupKey(target.stationId ? `Station ${target.stationId}` : null),
    ]);

    keys.forEach((key) => {
      if (!key) {
        return;
      }

      const existing = targetsByMeshKey.get(key) ?? [];
      existing.push(target);
      targetsByMeshKey.set(key, existing);
    });
  });

  return segments.map((segment) => {
    const matchedTargets = targetsByMeshKey.get(normalizeLookupKey(segment.name)) ?? [];

    return {
      index: segment.index,
      id: segment.id,
      name: segment.name,
      labelValue: segment.labelValue,
      layer: segment.layer,
      color: segment.color,
      extent: segment.extent,
      groupId: classifySegmentationGroup(segment.name),
      targetIds: [...new Set(matchedTargets.map((target) => target.id))],
      stationIds: [...new Set(matchedTargets.flatMap((target) => (target.stationId ? [target.stationId] : [])))],
      meshNameResolved: matchedTargets[0]?.meshNameResolved ?? null,
    };
  });
}

function buildRuntimeTargets(
  targets: EnrichedCaseTarget[],
  ctGeometry: NrrdGeometry,
  segmentationGeometry: NrrdGeometry,
  segmentationSegments: SegmentationSegment[],
): RuntimeCaseTarget[] {
  const segmentIdsByTargetId = new Map<string, string[]>();

  segmentationSegments.forEach((segment) => {
    segment.targetIds.forEach((targetId) => {
      const existing = segmentIdsByTargetId.get(targetId) ?? [];
      existing.push(segment.id);
      segmentIdsByTargetId.set(targetId, existing);
    });
  });

  return targets.map((target) => ({
    ...target,
    recommendedSliceIndex: target.sliceIndex,
    matchedSegmentIds: segmentIdsByTargetId.get(target.id) ?? [],
    insideCtBounds: isPointInsideGeometry(target.world.position, ctGeometry, 1e-4),
    insideSegmentationBounds: isPointInsideGeometry(target.world.position, segmentationGeometry, 1e-4),
  }));
}

function getResolvedPaths(rootDir: string, manifest: CaseManifest): ResolvedCasePaths {
  const segmentationPath = manifest.assets.segmentationFile
    ? tryResolveRepoPath(rootDir, manifest.assets.segmentationFile)
    : null;

  return {
    manifestPath: ensurePathExists(path.join(rootDir, 'content', 'cases', 'case_001_manifest.json'), 'Seed manifest'),
    ctVolumePath: ensurePathExists(resolveRepoPath(rootDir, manifest.assets.ctVolumeFile), 'CT volume'),
    glbPath: ensurePathExists(resolveRepoPath(rootDir, manifest.assets.glbFile), 'GLB model'),
    segmentationPath: segmentationPath && fs.existsSync(segmentationPath) ? segmentationPath : null,
  };
}

export function generateCaseOutputs(rootDir: string): GeneratedCaseOutputs {
  const manifestPath = path.join(rootDir, 'content', 'cases', 'case_001_manifest.json');
  const manifest = readSeedManifest(manifestPath);
  const resolvedPaths = getResolvedPaths(rootDir, manifest);
  const nrrdGeometry = parseNrrdHeader(fs.readFileSync(resolvedPaths.ctVolumePath));
  const axisMap = deriveAxisMap(nrrdGeometry.spaceDirections);
  const geometry: VolumeGeometry = {
    coordinateSystem: 'LPS',
    sizes: nrrdGeometry.sizes,
    spaceDirections: nrrdGeometry.spaceDirections,
    spaceOrigin: nrrdGeometry.spaceOrigin,
    axisMap,
    ijkToWorldMatrix: buildIjkToWorldMatrix4(nrrdGeometry),
    worldToIjkMatrix: buildWorldToIjkMatrix4(nrrdGeometry),
  };
  const meshNames = parseGlbMeshNames(fs.readFileSync(resolvedPaths.glbPath)).sort(naturalCompare);
  const warnings: string[] = [];
  const parsedMarkupFiles = fs
    .readdirSync(resolveRepoPath(rootDir, 'model/markups'))
    .filter((fileName) => fileName.toLowerCase().endsWith('.mrk.json'));
  const sliceFiles: Record<CasePlane, string[]> = {
    axial: listSliceSeriesFiles(rootDir, manifest.sliceSeries.axial.folder),
    coronal: listSliceSeriesFiles(rootDir, manifest.sliceSeries.coronal.folder),
    sagittal: listSliceSeriesFiles(rootDir, manifest.sliceSeries.sagittal.folder),
  };
  const sliceTextureMetadata = buildSliceTextureMetadata(rootDir, manifest, geometry, sliceFiles, warnings);
  const ctBounds = buildWorldBounds(geometry);

  if (manifest.assets.segmentationFile && !resolvedPaths.segmentationPath) {
    warnings.push(`Segmentation file is referenced but missing: ${manifest.assets.segmentationFile}`);
  }

  const enrichedTargets: EnrichedCaseTarget[] = manifest.targets.map((target) => {
    const markupPath = resolveRepoPath(rootDir, target.markupFile);
    const markup = parseMarkupFile(fs.readFileSync(markupPath, 'utf8'), markupPath);
    const positionLps = toLpsPosition(markup, geometry, warnings, markupPath);
    const continuousVoxel = clampContinuousVoxel(worldToContinuousVoxel(positionLps, geometry), geometry.sizes);
    const roundedVoxel = roundVoxel(continuousVoxel, geometry.sizes);
    const normalized = buildNormalizedPositions(roundedVoxel, geometry.sizes, axisMap);
    const voxelIndex = buildVoxelIndex(axisMap, roundedVoxel);
    const sliceIndex: SliceIndex = {
      axial: mapFrameIndex(
        normalized.axial,
        voxelIndex.axial,
        geometry.sizes[axisNameToIndex(axisMap.axial)],
        sliceFiles.axial.length,
        manifest.sliceSeries.axial.coverageAssumption,
      ),
      coronal: mapFrameIndex(
        normalized.coronal,
        voxelIndex.coronal,
        geometry.sizes[axisNameToIndex(axisMap.coronal)],
        sliceFiles.coronal.length,
        manifest.sliceSeries.coronal.coverageAssumption,
      ),
      sagittal: mapFrameIndex(
        normalized.sagittal,
        voxelIndex.sagittal,
        geometry.sizes[axisNameToIndex(axisMap.sagittal)],
        sliceFiles.sagittal.length,
        manifest.sliceSeries.sagittal.coverageAssumption,
      ),
    };
    const meshNameResolved = resolveMeshName(target.meshNameExpected, meshNames);

    if (!meshNameResolved && target.meshNameExpected) {
      warnings.push(`Mesh not found for ${target.id}: expected "${target.meshNameExpected}".`);
    }

    return {
      ...target,
      sliceIndex,
      voxelIndex,
      structureGroupId: classifyStructureGroup(target, meshNameResolved),
      markup: {
        coordinateSystem: 'LPS',
        sourceCoordinateSystem: markup.coordinateSystem,
        position: positionLps,
      },
      world: {
        coordinateSystem: 'LPS',
        position: positionLps,
      },
      derived: {
        continuousVoxel,
        roundedVoxel,
        normalized,
        axisMap,
        scenePosition: toSceneCoordinates(positionLps),
      },
      meshExists: Boolean(meshNameResolved),
      meshNameResolved,
    };
  });

  if (enrichedTargets.some((target) => PLANES.some((plane) => Number.isNaN(target.sliceIndex[plane])))) {
    throw new Error('At least one target is missing a derived slice index.');
  }

  const referencedMarkupFiles = new Set(
    manifest.targets.map((target) => path.basename(target.markupFile).toLowerCase()),
  );
  const unreferencedMarkupFiles = parsedMarkupFiles.filter(
    (fileName) => !referencedMarkupFiles.has(fileName.toLowerCase()),
  );

  if (unreferencedMarkupFiles.length > 0) {
    warnings.push(
      `Found ${unreferencedMarkupFiles.length} unreferenced markup files under model/markups that are not part of the runtime target list.`,
    );
  }

  if (!resolvedPaths.segmentationPath) {
    throw new Error('Segmentation file is required to build the case_001 runtime manifest.');
  }

  const parsedSegmentationHeader = parseSegmentationHeader(fs.readFileSync(resolvedPaths.segmentationPath));
  const segmentationGeometry = buildSegmentationGeometry(parsedSegmentationHeader);
  const segmentationSegments = buildSegmentationSegments(parsedSegmentationHeader.segments, enrichedTargets);
  const runtimeTargets = buildRuntimeTargets(
    enrichedTargets,
    nrrdGeometry,
    {
      sizes: segmentationGeometry.sizes,
      spaceDirections: segmentationGeometry.spaceDirections,
      spaceOrigin: segmentationGeometry.spaceOrigin,
    },
    segmentationSegments,
  );

  const outsideCtTargets = runtimeTargets.filter((target) => !target.insideCtBounds);

  if (outsideCtTargets.length > 0) {
    throw new Error(
      `Found ${outsideCtTargets.length} targets outside CT bounds: ${outsideCtTargets.map((target) => target.id).join(', ')}`,
    );
  }

  const runtimeManifest: RuntimeCaseManifest = {
    ...manifest,
    generatedAt: new Date().toISOString(),
    runtimeSchemaVersion: 1,
    volumeGeometry: geometry,
    patientToScene: {
      name: 'patientToScene',
      from: 'LPS-mm',
      to: 'three-scene-meters',
      matrix: buildPatientToSceneMatrix(),
      inverseMatrix: buildSceneToPatientMatrix(),
      note: 'This explicit transform maps CT/markup patient-space coordinates into the shared Three scene basis. The GLB is already exported in that scene basis, so it should be wrapped in the inverse transform before joining the patient-space group.',
    },
    meshNames,
    sliceAssetCounts: {
      axial: sliceFiles.axial.length,
      coronal: sliceFiles.coronal.length,
      sagittal: sliceFiles.sagittal.length,
    },
    sliceTextureMetadata,
    warnings,
    bounds: {
      ct: ctBounds,
      segmentation: segmentationGeometry.worldBounds,
      union: mergeWorldBounds([ctBounds, segmentationGeometry.worldBounds]),
    },
    segmentation: {
      ...segmentationGeometry,
      segments: segmentationSegments,
    },
    targets: runtimeTargets,
  };

  return {
    enrichedManifest: {
      ...runtimeManifest,
      targets: enrichedTargets,
    },
    runtimeManifest,
    enrichedManifestPath: path.join(rootDir, ENRICHED_MANIFEST_PATH),
    runtimeManifestPath: path.join(rootDir, RUNTIME_MANIFEST_PATH),
  };
}

export function writeCaseOutputs(rootDir: string): GeneratedCaseOutputs {
  const outputs = generateCaseOutputs(rootDir);

  fs.mkdirSync(path.dirname(outputs.enrichedManifestPath), { recursive: true });
  fs.writeFileSync(outputs.enrichedManifestPath, `${JSON.stringify(outputs.enrichedManifest, null, 2)}\n`);
  fs.writeFileSync(outputs.runtimeManifestPath, `${JSON.stringify(outputs.runtimeManifest, null, 2)}\n`);

  return outputs;
}

export interface Case001ValidationSummary {
  caseId: string;
  targetCount: number;
  stationCount: number;
  parsedMarkupCount: number;
  segmentationSegmentCount: number;
  outsideCtTargetIds: string[];
}

export function validateCase001(rootDir: string): Case001ValidationSummary {
  const outputs = generateCaseOutputs(rootDir);
  const markupCount = fs
    .readdirSync(resolveRepoPath(rootDir, 'model/markups'))
    .filter((fileName) => fileName.toLowerCase().endsWith('.mrk.json')).length;

  return {
    caseId: outputs.runtimeManifest.caseId,
    targetCount: outputs.runtimeManifest.targets.length,
    stationCount: outputs.runtimeManifest.stations.length,
    parsedMarkupCount: markupCount,
    segmentationSegmentCount: outputs.runtimeManifest.segmentation.segments.length,
    outsideCtTargetIds: outputs.runtimeManifest.targets
      .filter((target) => !target.insideCtBounds)
      .map((target) => target.id),
  };
}
