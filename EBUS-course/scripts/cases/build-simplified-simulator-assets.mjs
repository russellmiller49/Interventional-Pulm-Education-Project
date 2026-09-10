import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const sourceModelPath = path.join(repoRoot, 'Simplified _sim_model.gltf');
const caseRoot = path.join(repoRoot, 'apps/web/public/simulator/case-001');
const outputGltfModelPath = path.join(caseRoot, 'models/simplified_sim_model.gltf');
const outputGlbModelPath = path.join(caseRoot, 'models/simplified_sim_model.glb');
const outputGeometryRoot = path.join(caseRoot, 'geometry/simplified');
const sourceManifestPath = path.join(caseRoot, 'case_manifest.web.json');
const outputManifestPath = path.join(caseRoot, 'case_manifest.simplified.web.json');
const sourcePointListPath = path.join(repoRoot, 'Simplified_point_list');

const VESSEL_MESH_TO_KEY = {
  aorta: 'aorta',
  azygous: 'azygous',
  'brachiocephalic trunk': 'brachiocephalic_trunk',
  'left atrium': 'left_atrium',
  'left common carotid artery': 'left_common_carotid_artery',
  'left subclavian artery': 'left_subclavian_artery',
  'pulmonary artery': 'pulmonary_artery',
  'pulmonary venous system': 'pulmonary_venous_system',
  'right atrium': 'right_atrium',
  'right common carotid artery': 'right_common_carotid_artery',
  superior_vena_cava: 'superior_vena_cava',
};

const STATION_MESH_TO_KEY = {
  'station 2l': 'station_2l',
  'station 2r': 'station_2r',
  'station 4l': 'station_4l',
  'station 4r': 'station_4r',
  'station 7': 'station_7',
  'station 10l': 'station_10l',
  'station 10r': 'station_10r',
  'station 11l': 'station_11l',
  'station 11ri': 'station_11ri',
  'station 11rs': 'station_11rs',
};

const TARGET_COUNTS = {
  station: 900,
  vessel: 1200,
};

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makePrng(seedText) {
  let seed = 2166136261;
  for (const char of seedText) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }

  return () => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
    return ((seed ^= seed >>> 16) >>> 0) / 4294967296;
  };
}

function matrixIdentity() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

function matrixFromGltfColumnMajor(matrix) {
  return [
    matrix[0], matrix[4], matrix[8], matrix[12],
    matrix[1], matrix[5], matrix[9], matrix[13],
    matrix[2], matrix[6], matrix[10], matrix[14],
    matrix[3], matrix[7], matrix[11], matrix[15],
  ];
}

function matrixMultiply(left, right) {
  const output = Array.from({ length: 16 }, () => 0);

  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      for (let inner = 0; inner < 4; inner += 1) {
        output[row * 4 + column] += left[row * 4 + inner] * right[inner * 4 + column];
      }
    }
  }

  return output;
}

function transformPoint(matrix, point) {
  const [x, y, z] = point;

  return [
    (matrix[0] * x + matrix[1] * y + matrix[2] * z + matrix[3]) * 1000,
    (matrix[4] * x + matrix[5] * y + matrix[6] * z + matrix[7]) * 1000,
    (matrix[8] * x + matrix[9] * y + matrix[10] * z + matrix[11]) * 1000,
  ];
}

function vectorSubtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function vectorLength(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalizeVector(a) {
  const length = vectorLength(a);
  return length > 1e-8 ? [a[0] / length, a[1] / length, a[2] / length] : null;
}

function vectorScale(a, scale) {
  return [a[0] * scale, a[1] * scale, a[2] * scale];
}

function vectorToLps(webVector) {
  return [
    webVector[0],
    -webVector[2],
    webVector[1],
  ];
}

function lpsPointToWebMm(point) {
  return [
    point[0],
    point[2],
    -point[1],
  ];
}

function distance(a, b) {
  return vectorLength(vectorSubtract(a, b));
}

function formatStationId(stationKey) {
  const raw = stationKey.replace(/^station_/, '');

  if (/^11ri$/i.test(raw)) {
    return '11Ri';
  }

  if (/^11rs$/i.test(raw)) {
    return '11Rs';
  }

  return raw.toUpperCase();
}

function triangleArea(a, b, c) {
  return vectorLength(cross(vectorSubtract(b, a), vectorSubtract(c, a))) / 2;
}

function interpolateTriangle(a, b, c, r1, r2) {
  const sqrtR1 = Math.sqrt(r1);
  const wa = 1 - sqrtR1;
  const wb = sqrtR1 * (1 - r2);
  const wc = sqrtR1 * r2;

  return [
    a[0] * wa + b[0] * wb + c[0] * wc,
    a[1] * wa + b[1] * wb + c[1] * wc,
    a[2] * wa + b[2] * wb + c[2] * wc,
  ];
}

function loadGltfBuffers(gltf) {
  return gltf.buffers.map((buffer, index) => {
    const uri = buffer.uri;

    if (!uri?.startsWith('data:')) {
      throw new Error(`Buffer ${index} is external; this utility expects embedded GLTF buffers.`);
    }

    return Buffer.from(uri.split(',')[1], 'base64');
  });
}

function align4(value) {
  return (value + 3) & ~3;
}

function writeEmbeddedGltfAsGlb(gltf, buffers, outputPath) {
  const output = JSON.parse(JSON.stringify(gltf));
  const offsets = [];
  const binaryParts = [];
  let binaryLength = 0;

  for (let index = 0; index < buffers.length; index += 1) {
    const alignedLength = align4(binaryLength);
    if (alignedLength > binaryLength) {
      binaryParts.push(Buffer.alloc(alignedLength - binaryLength));
      binaryLength = alignedLength;
    }

    offsets[index] = binaryLength;
    binaryParts.push(buffers[index]);
    binaryLength += buffers[index].length;
  }

  const paddedBinaryLength = align4(binaryLength);
  if (paddedBinaryLength > binaryLength) {
    binaryParts.push(Buffer.alloc(paddedBinaryLength - binaryLength));
  }

  const binaryChunk = Buffer.concat(binaryParts, paddedBinaryLength);

  for (const view of output.bufferViews ?? []) {
    const sourceBufferIndex = view.buffer ?? 0;
    view.buffer = 0;
    view.byteOffset = (view.byteOffset ?? 0) + offsets[sourceBufferIndex];
  }

  output.buffers = [{ byteLength: binaryChunk.length }];

  const jsonBuffer = Buffer.from(JSON.stringify(output), 'utf8');
  const jsonChunk = Buffer.alloc(align4(jsonBuffer.length), 0x20);
  jsonBuffer.copy(jsonChunk);

  const totalLength = 12 + 8 + jsonChunk.length + 8 + binaryChunk.length;
  const glb = Buffer.alloc(totalLength);
  let cursor = 0;
  glb.writeUInt32LE(0x46546c67, cursor); // glTF
  cursor += 4;
  glb.writeUInt32LE(2, cursor);
  cursor += 4;
  glb.writeUInt32LE(totalLength, cursor);
  cursor += 4;
  glb.writeUInt32LE(jsonChunk.length, cursor);
  cursor += 4;
  glb.writeUInt32LE(0x4e4f534a, cursor); // JSON
  cursor += 4;
  jsonChunk.copy(glb, cursor);
  cursor += jsonChunk.length;
  glb.writeUInt32LE(binaryChunk.length, cursor);
  cursor += 4;
  glb.writeUInt32LE(0x004e4942, cursor); // BIN
  cursor += 4;
  binaryChunk.copy(glb, cursor);

  fs.writeFileSync(outputPath, glb);
}

function accessorRows(gltf, buffers, accessorIndex) {
  const accessor = gltf.accessors[accessorIndex];
  const view = gltf.bufferViews[accessor.bufferView];
  const buffer = buffers[view.buffer];
  const componentType = accessor.componentType;
  const componentCount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
  const TypedArray = {
    5121: Uint8Array,
    5122: Int16Array,
    5123: Uint16Array,
    5125: Uint32Array,
    5126: Float32Array,
  }[componentType];

  if (!TypedArray || !componentCount) {
    throw new Error(`Unsupported accessor ${accessorIndex}.`);
  }

  const byteOffset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const componentSize = TypedArray.BYTES_PER_ELEMENT;
  const stride = view.byteStride ?? componentCount * componentSize;
  const rows = [];

  for (let row = 0; row < accessor.count; row += 1) {
    const values = [];
    for (let column = 0; column < componentCount; column += 1) {
      values.push(new TypedArray(
        buffer.buffer,
        buffer.byteOffset + byteOffset + row * stride + column * componentSize,
        1,
      )[0]);
    }
    rows.push(componentCount === 1 ? values[0] : values);
  }

  return rows;
}

function collectMeshes(gltf, buffers) {
  const meshes = new Map();

  function visitNode(nodeIndex, parentMatrix) {
    const node = gltf.nodes[nodeIndex];
    const localMatrix = node.matrix ? matrixFromGltfColumnMajor(node.matrix) : matrixIdentity();
    const worldMatrix = matrixMultiply(parentMatrix, localMatrix);

    if (node.mesh !== undefined) {
      const mesh = gltf.meshes[node.mesh];
      const triangles = [];

      for (const primitive of mesh.primitives ?? []) {
        if (primitive.mode !== undefined && primitive.mode !== 4) {
          continue;
        }

        const positions = accessorRows(gltf, buffers, primitive.attributes.POSITION)
          .map((point) => transformPoint(worldMatrix, point));
        const indices = primitive.indices !== undefined
          ? accessorRows(gltf, buffers, primitive.indices)
          : positions.map((_, index) => index);

        for (let index = 0; index < indices.length - 2; index += 3) {
          triangles.push([
            positions[indices[index]],
            positions[indices[index + 1]],
            positions[indices[index + 2]],
          ]);
        }
      }

      meshes.set(normalizeName(node.name || mesh.name), {
        label: node.name || mesh.name,
        triangles,
      });
    }

    for (const child of node.children ?? []) {
      visitNode(child, worldMatrix);
    }
  }

  for (const nodeIndex of gltf.scenes[gltf.scene ?? 0].nodes ?? []) {
    visitNode(nodeIndex, matrixIdentity());
  }

  return meshes;
}

function sampleTriangles(triangles, targetCount, seedText) {
  const weighted = triangles
    .map((triangle) => ({ triangle, area: triangleArea(triangle[0], triangle[1], triangle[2]) }))
    .filter((entry) => entry.area > 1e-6);
  const totalArea = weighted.reduce((sum, entry) => sum + entry.area, 0);

  if (totalArea <= 0) {
    return [];
  }

  const random = makePrng(seedText);
  const cumulative = [];
  let running = 0;
  for (const entry of weighted) {
    running += entry.area;
    cumulative.push(running);
  }

  const points = [];
  for (let index = 0; index < targetCount; index += 1) {
    const areaTarget = ((index + random()) / targetCount) * totalArea;
    let low = 0;
    let high = cumulative.length - 1;

    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (cumulative[middle] < areaTarget) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    points.push(interpolateTriangle(
      weighted[low].triangle[0],
      weighted[low].triangle[1],
      weighted[low].triangle[2],
      random(),
      random(),
    ).map((value) => Number(value.toFixed(3))));
  }

  return points;
}

function writePointCloud({ directory, key, label, points }) {
  fs.mkdirSync(directory, { recursive: true });
  const payload = {
    coordinate_frame: 'web_xyz_mm_from_lps',
    key,
    label,
    point_count: points.length,
    points,
  };
  const outputPath = path.join(directory, `${key}_points.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  return path.relative(caseRoot, outputPath);
}

function pointCloudSummary(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(caseRoot, relativePath), 'utf8'));
}

function updateListedAssets(assets, generatedByKey, { includeGeneratedExtras = false, fallbackColor = '#ffffff' } = {}) {
  const updated = assets
    .filter((asset) => generatedByKey.has(asset.key))
    .map((asset) => ({
      ...asset,
      asset: generatedByKey.get(asset.key),
      point_count: pointCloudSummary(generatedByKey.get(asset.key)).point_count,
    }));

  if (!includeGeneratedExtras) {
    return updated;
  }

  const listedKeys = new Set(updated.map((asset) => asset.key));
  for (const [key, asset] of Array.from(generatedByKey.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    if (listedKeys.has(key)) {
      continue;
    }

    const summary = pointCloudSummary(asset);
    updated.push({
      asset,
      color: fallbackColor,
      key,
      label: summary.label,
      point_count: summary.point_count,
    });
  }

  return updated;
}

function stationKeyFromStationId(stationId) {
  return stationId ? `station_${stationId.toLowerCase()}` : null;
}

function readFirstMarkupPoint(filePath) {
  const markup = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const position = markup.markups?.[0]?.controlPoints?.[0]?.position;

  if (!Array.isArray(position) || position.length !== 3) {
    return null;
  }

  const lps = position.map((value) => Number(value));
  return {
    lps,
    web: lpsPointToWebMm(lps),
  };
}

function parseProbeMarkerFileName(fileName) {
  const match = fileName.match(/^Station_([0-9]+[a-z]*)(?:\s+([a-z]+))?_Probe\.mrk\.json$/i);

  if (!match) {
    return null;
  }

  const stationKey = stationKeyFromStationId(match[1]);
  const approach = match[2]?.toLowerCase() ?? 'default';

  return stationKey ? { approach, stationKey } : null;
}

function parseTargetMarkerFileName(fileName) {
  if (/Probe\.mrk\.json$/i.test(fileName)) {
    return null;
  }

  const stationId = fileName.replace(/\.mrk\.json$/i, '').trim();

  if (!/^[0-9]+[a-z]*$/i.test(stationId)) {
    return null;
  }

  return stationKeyFromStationId(stationId);
}

function readSimplifiedPointList(directory) {
  const probeSnaps = [];
  const targets = new Map();

  if (!fs.existsSync(directory)) {
    return { probeSnaps, targets };
  }

  for (const fileName of fs.readdirSync(directory).sort()) {
    if (!fileName.endsWith('.mrk.json')) {
      continue;
    }

    const marker = readFirstMarkupPoint(path.join(directory, fileName));
    if (!marker) {
      continue;
    }

    const probe = parseProbeMarkerFileName(fileName);
    if (probe) {
      probeSnaps.push({
        ...probe,
        ...marker,
      });
      continue;
    }

    const stationKey = parseTargetMarkerFileName(fileName);
    if (stationKey) {
      targets.set(stationKey, marker);
    }
  }

  return { probeSnaps, targets };
}

function closestPointOnSegment(point, start, end) {
  const segment = vectorSubtract(end, start);
  const lengthSq = dot(segment, segment);
  const t = lengthSq > 1e-8 ? clamp01(dot(vectorSubtract(point, start), segment) / lengthSq) : 0;
  const projected = [
    start[0] + segment[0] * t,
    start[1] + segment[1] * t,
    start[2] + segment[2] * t,
  ];

  return {
    distanceSq: squaredDistance(point, projected),
    point: projected,
    t,
  };
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function squaredDistance(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

function nearestCenterlineSnap(centerlines, contact) {
  let best = null;

  for (const polyline of centerlines.polylines ?? []) {
    const points = polyline.points ?? [];
    const cumulative = polyline.cumulative_lengths_mm ?? [];

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const segment = closestPointOnSegment(contact, start, end);
      const segmentLengthMm = distance(start, end);
      const sMm = (cumulative[index] ?? 0) + segment.t * segmentLengthMm;
      const tangent = normalizeVector(vectorSubtract(end, start));

      if (!tangent) {
        continue;
      }

      const candidate = {
        distanceSq: segment.distanceSq,
        lineIndex: polyline.line_index,
        sMm,
        tangent,
      };

      if (!best || candidate.distanceSq < best.distanceSq) {
        best = candidate;
      }
    }
  }

  return best;
}

function updatedPresetAxes(preset, target) {
  const rawDepthAxis = normalizeVector(vectorSubtract(target.web, preset.contact ?? [0, 0, 0]));

  if (!rawDepthAxis) {
    return {};
  }

  const shaftAxis = normalizeVector(preset.shaft_axis ?? []);
  if (!shaftAxis) {
    return {
      depth_axis: rawDepthAxis,
      depth_axis_lps: vectorToLps(rawDepthAxis),
    };
  }

  const depthWithoutShaft = normalizeVector(vectorSubtract(
    rawDepthAxis,
    vectorScale(shaftAxis, dot(rawDepthAxis, shaftAxis)),
  )) ?? rawDepthAxis;
  const lateralAxis = normalizeVector(cross(shaftAxis, depthWithoutShaft));
  const orthogonalDepthAxis = lateralAxis
    ? normalizeVector(cross(lateralAxis, shaftAxis)) ?? depthWithoutShaft
    : depthWithoutShaft;

  return {
    depth_axis: orthogonalDepthAxis,
    depth_axis_lps: vectorToLps(orthogonalDepthAxis),
    ...(lateralAxis
      ? {
          lateral_axis: lateralAxis,
          lateral_axis_lps: vectorToLps(lateralAxis),
        }
      : {}),
  };
}

function makeSimplifiedPreset({ centerlines, generatedStations, probeSnap, target, template }) {
  const station = formatStationId(probeSnap.stationKey);
  const approach = probeSnap.approach;
  const nearest = nearestCenterlineSnap(centerlines, probeSnap.web);
  const shaftAxis = nearest?.tangent ?? normalizeVector(template?.shaft_axis ?? []) ?? [0, 1, 0];
  const presetId = `station_${station.toLowerCase()}_node_a`;
  const approachLabel = approach === 'default' ? 'default' : approach.toUpperCase();
  const basePreset = {
    ...(template ?? {}),
    approach,
    centerline_s_mm: nearest?.sMm ?? template?.centerline_s_mm ?? 0,
    contact: probeSnap.web,
    contact_lps: probeSnap.lps,
    contact_to_target_distance_mm: distance(probeSnap.web, target.web),
    label: `Station ${station} node A (${approachLabel})`,
    line_index: nearest?.lineIndex ?? template?.line_index ?? 0,
    node: 'a',
    preset_id: presetId,
    preset_key: `${presetId}::${approach}`,
    shaft_axis: shaftAxis,
    shaft_axis_lps: vectorToLps(shaftAxis),
    station: station.toLowerCase(),
    station_asset: generatedStations.get(probeSnap.stationKey) ?? template?.station_asset,
    station_key: probeSnap.stationKey,
    target: target.web,
    target_lps: target.lps,
    vessel_overlays: template?.vessel_overlays ?? [],
  };

  return {
    ...basePreset,
    ...updatedPresetAxes(basePreset, target),
  };
}

function applyStationSnapTargets(manifest, { probeSnaps, targets }, generatedStations, centerlines) {
  const presetsByStation = new Map();
  for (const preset of manifest.presets ?? []) {
    if (!presetsByStation.has(preset.station_key)) {
      presetsByStation.set(preset.station_key, preset);
    }
  }

  manifest.presets = probeSnaps
    .filter((probeSnap) => targets.has(probeSnap.stationKey))
    .map((probeSnap) => makeSimplifiedPreset({
      centerlines,
      generatedStations,
      probeSnap,
      target: targets.get(probeSnap.stationKey),
      template: presetsByStation.get(probeSnap.stationKey),
    }));

  manifest.anatomy = {
    ...manifest.anatomy,
    nodes: Array.from(targets.entries())
      .filter(([stationKey]) => generatedStations.has(stationKey))
      .map(([stationKey, target]) => {
        const station = formatStationId(stationKey);
        return {
          color: manifest.color_map.lymph_node ?? '#93c56f',
          key: `${stationKey}_node_a`,
          label: `Station ${station} lymph node`,
          position: target.web,
          position_lps: target.lps,
          preset_key: manifest.presets.find((preset) => preset.station_key === stationKey)?.preset_key ?? '',
          radius_mm: 6,
          station_key: stationKey,
        };
      }),
  };
}

if (!fs.existsSync(sourceModelPath)) {
  throw new Error(`Missing simplified GLTF at ${sourceModelPath}`);
}

fs.mkdirSync(path.dirname(outputGltfModelPath), { recursive: true });
fs.copyFileSync(sourceModelPath, outputGltfModelPath);

const gltf = JSON.parse(fs.readFileSync(sourceModelPath, 'utf8'));
const buffers = loadGltfBuffers(gltf);
writeEmbeddedGltfAsGlb(gltf, buffers, outputGlbModelPath);
const meshes = collectMeshes(gltf, buffers);
const generatedVessels = new Map();
const generatedStations = new Map();
const pointList = readSimplifiedPointList(sourcePointListPath);

for (const [meshName, key] of Object.entries(VESSEL_MESH_TO_KEY)) {
  const mesh = meshes.get(meshName);
  if (!mesh) {
    continue;
  }

  const points = sampleTriangles(mesh.triangles, TARGET_COUNTS.vessel, key);
  generatedVessels.set(key, writePointCloud({
    directory: path.join(outputGeometryRoot, 'vessels'),
    key,
    label: mesh.label,
    points,
  }));
}

for (const [meshName, key] of Object.entries(STATION_MESH_TO_KEY)) {
  const mesh = meshes.get(meshName);
  if (!mesh) {
    continue;
  }

  const stationLabel = mesh.label.replace(/^Station\s+/i, 'Station ') + ' lymph node';
  const points = sampleTriangles(mesh.triangles, TARGET_COUNTS.station, key);
  generatedStations.set(key, writePointCloud({
    directory: path.join(outputGeometryRoot, 'stations'),
    key,
    label: stationLabel,
    points,
  }));
}

const manifest = JSON.parse(fs.readFileSync(sourceManifestPath, 'utf8'));
const centerlines = JSON.parse(fs.readFileSync(path.join(caseRoot, manifest.assets.centerlines), 'utf8'));
manifest.case_id = `${manifest.case_id}-simplified`;
manifest.render_defaults = {
  ...manifest.render_defaults,
  sector_realism: 'realistic',
};
// Device-calibration record (single source of truth for the optical pane and the Python signal
// tools). The numbers are read from the shared profile JSON that ebus_simulator/device.py also
// loads, so the two consumers cannot drift apart. The web app falls back to the same defaults
// when this block is absent, so older manifests keep loading; obliquity_axis carries the
// calibratable scan-side sign.
const deviceProfilePath = path.join(
  repoRoot,
  'tools/ebus-simulator/src/ebus_simulator/device_profiles/bf_uc180f.json',
);
const deviceProfile = JSON.parse(fs.readFileSync(deviceProfilePath, 'utf8'));
manifest.endoscope_camera = {
  model: deviceProfile.model,
  optical_axis_offset_deg: deviceProfile.optical_axis_offset_deg,
  obliquity_axis: deviceProfile.obliquity_axis,
  fov_deg: deviceProfile.fov_deg,
  near_mm: deviceProfile.near_mm,
  far_mm: deviceProfile.far_mm,
  eye_offset_mm: deviceProfile.eye_offset_mm,
  circular_aperture: deviceProfile.circular_aperture ?? false,
  lens_distortion: deviceProfile.lens_distortion ?? false,
  scope_tip_occlusion: deviceProfile.scope_tip_occlusion ?? false,
  contact_cap: deviceProfile.contact_cap ?? false,
  headlight_falloff: deviceProfile.headlight_falloff ?? false,
  contact_min_distance_mm: deviceProfile.contact_min_distance_mm ?? 0,
};
manifest.ultrasound_probe = {
  sector_angle_deg: deviceProfile.sector_angle_deg,
  displayed_range_mm: deviceProfile.displayed_range_mm,
  optical_axis_offset_deg: deviceProfile.optical_axis_offset_deg,
};
manifest.assets = {
  ...manifest.assets,
  clean_models: [
    {
      asset: 'models/simplified_sim_model.glb',
      coordinate_frame: 'slicer_gltf_scene_units_aligned_to_web_axes',
      key: 'simplified_sim_model',
      label: 'Simplified simulator model',
      primary: true,
      source_path: sourceModelPath,
      web_transform: 'slicer_root_matrix_then_x1000',
    },
    ...(manifest.assets.clean_models ?? []).map((model) => ({ ...model, primary: false })),
  ],
  vessels: updateListedAssets(manifest.assets.vessels, generatedVessels),
  stations: updateListedAssets(manifest.assets.stations, generatedStations, {
    fallbackColor: manifest.color_map.lymph_node ?? '#93c56f',
    includeGeneratedExtras: true,
  }),
};
function collectPhysicsSnapshotRefs(manifest) {
  // Sidecar JSONs written by tools/ebus-simulator physics_snapshot_export.py
  // (export-physics-snapshots). Only presets present in this manifest are
  // referenced; the map stays empty until the snapshots are generated.
  const snapshotDir = path.join(caseRoot, 'physics_snapshots');
  const refs = {};

  if (!fs.existsSync(snapshotDir)) {
    return refs;
  }

  const presetKeys = new Set((manifest.presets ?? []).map((preset) => preset.preset_key));
  for (const fileName of fs.readdirSync(snapshotDir).sort()) {
    if (!fileName.endsWith('.json')) {
      continue;
    }

    const sidecar = JSON.parse(fs.readFileSync(path.join(snapshotDir, fileName), 'utf8'));
    if (!presetKeys.has(sidecar.preset_key)) {
      continue;
    }

    if (typeof sidecar.image === 'string' && fs.existsSync(path.join(caseRoot, sidecar.image))) {
      refs[sidecar.preset_key] = `physics_snapshots/${fileName}`;
    }
  }

  return refs;
}

applyStationSnapTargets(manifest, pointList, generatedStations, centerlines);
manifest.sector_snapshots = {};
manifest.physics_snapshots = collectPhysicsSnapshotRefs(manifest);
manifest.notes = {
  ...(manifest.notes ?? {}),
  simplified_model_trial:
    'Uses Simplified _sim_model.gltf converted to GLB for anatomy and mesh-derived point clouds. Station snap targets are updated from Simplified_point_list when markers are available.',
};

fs.writeFileSync(outputManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

process.stdout.write([
  `Copied ${path.relative(repoRoot, outputGltfModelPath)}`,
  `Wrote ${path.relative(repoRoot, outputGlbModelPath)}`,
  `Wrote ${path.relative(repoRoot, outputManifestPath)}`,
  `Generated ${generatedVessels.size} vessel point clouds`,
  `Generated ${generatedStations.size} station point clouds`,
  `Loaded ${pointList.targets.size} station target markers`,
  `Loaded ${pointList.probeSnaps.length} probe snap markers`,
  `Referenced ${Object.keys(manifest.physics_snapshots).length} physics snapshots`,
].join('\n') + '\n');
