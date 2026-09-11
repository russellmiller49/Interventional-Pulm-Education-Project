import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { simulatorCaseAssetUrl } from './paths';
import { cephalicImageAxis, sectorPlaneNormal, toVector, type SimulatorProbePose } from './pose';
import type {
  SimulatorCaseManifest,
  SimulatorCleanModelAsset,
  SimulatorLayerState,
  SimulatorLoadedAssets,
  SimulatorPreset,
  SimulatorScopeModelAsset,
  Vec3,
} from './types';

export const GLB_SCENE_TO_WEB_MM_MATRIX = new THREE.Matrix4().set(
  1000,
  0,
  0,
  0,
  0,
  1000,
  0,
  0,
  0,
  0,
  1000,
  0,
  0,
  0,
  0,
  1,
);
const AIRWAY_TRANSLUCENCY_REDUCTION = 0.15;
const FREE_DRIVE_ANTERIOR_CAMERA_OFFSET = new THREE.Vector3(0, 96, 390);

type GlbAsset = Pick<SimulatorCleanModelAsset, 'asset'> | Pick<SimulatorScopeModelAsset, 'asset'>;

interface LockedCameraView {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export function resolveLockedAnatomyCameraView(
  lockView: boolean | undefined,
  previousView: LockedCameraView | null,
): LockedCameraView | null {
  return lockView ? previousView : null;
}

const glbModelCache = new Map<string, Promise<THREE.Group>>();

export function loadGlbModel(asset: GlbAsset): Promise<THREE.Group> {
  const url = simulatorCaseAssetUrl(asset.asset);
  const cached = glbModelCache.get(url);

  if (cached) {
    return cached;
  }

  const loader = new GLTFLoader();
  const promise = loader.loadAsync(url).then((gltf) => gltf.scene);
  glbModelCache.set(url, promise);
  return promise;
}

export function primaryCleanModel(caseData: SimulatorCaseManifest): SimulatorCleanModelAsset | null {
  const models = caseData.assets.clean_models ?? [];
  return models.find((asset) => asset.primary) ?? models[0] ?? null;
}

function normalizedAnatomyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanModelStructureId(name: string): string {
  const normalized = normalizedAnatomyName(name);

  if (!normalized) {
    return 'context';
  }

  if (normalized === 'airway') {
    return 'airway_wall';
  }

  if (normalized.startsWith('station ')) {
    return normalized.replace('station ', 'station_').replace(/\s+/g, '').toLowerCase();
  }

  const exact: Record<string, string> = {
    'left atrial appendage': 'atrial_appendage_left',
    'azygous vein': 'azygous',
    'superior vena cava': 'superior_vena_cava',
  };

  return exact[normalized] ?? normalized.replace(/\s+/g, '_');
}

export function cleanModelLayer(structureId: string): keyof SimulatorLayerState {
  if (structureId === 'airway_wall') {
    return 'airway';
  }

  if (structureId.startsWith('station_')) {
    return 'stations';
  }

  if (structureId.includes('atrium') || structureId.includes('ventricle') || structureId.includes('appendage')) {
    return 'heart';
  }

  if (
    structureId.includes('artery') ||
    structureId.includes('vein') ||
    structureId.includes('venous') ||
    structureId.includes('cava') ||
    structureId.includes('aorta') ||
    structureId.includes('azygous') ||
    structureId.includes('trunk')
  ) {
    return 'vessels';
  }

  return 'context';
}

export function cleanModelColor(structureId: string, colorMap: Record<string, string>): string {
  if (structureId === 'airway_wall') {
    return colorMap.airway ?? '#22c7c9';
  }

  if (structureId.startsWith('station_')) {
    return colorMap.lymph_node ?? colorMap.station ?? '#93c56f';
  }

  if (colorMap[structureId]) {
    return colorMap[structureId];
  }

  if (structureId.includes('artery') || structureId.includes('aorta') || structureId.includes('trunk')) {
    return '#d13f3f';
  }

  if (structureId.includes('vein') || structureId.includes('venous') || structureId.includes('cava')) {
    return '#2276c9';
  }

  if (structureId.includes('esophagus')) {
    return '#b79667';
  }

  return '#7b8587';
}

function cleanModelOpacity(layer: keyof SimulatorLayerState, highlighted: boolean, teachingView: boolean): number {
  const airwayOpacity = (opacity: number) => opacity + (1 - opacity) * AIRWAY_TRANSLUCENCY_REDUCTION;

  if (teachingView && !highlighted) {
    const muted: Partial<Record<keyof SimulatorLayerState, number>> = {
      airway: airwayOpacity(0.1),
      vessels: 0.12,
      heart: 0.22,
      stations: 0.08,
      context: 0.04,
    };
    return muted[layer] ?? 0.06;
  }

  if (highlighted) {
    if (layer === 'airway') {
      return airwayOpacity(0.22);
    }

    if (layer === 'heart') {
      return 0.62;
    }

    return layer === 'context' ? 0.42 : 0.74;
  }

  const opacityByLayer: Partial<Record<keyof SimulatorLayerState, number>> = {
    airway: airwayOpacity(0.16),
    vessels: 0.58,
    heart: 0.48,
    stations: 0.36,
    context: 0.16,
  };

  return opacityByLayer[layer] ?? 0.5;
}

function withClipping<T extends THREE.Material>(material: T, clippingPlanes: THREE.Plane[] | null): T {
  if (clippingPlanes) {
    material.clippingPlanes = clippingPlanes;
  }

  return material;
}

function isTeachingFocus(
  structureId: string,
  selectedPreset: SimulatorPreset | null,
  intersectedStructureIds: Set<string>,
  activeStructure: string | null,
): boolean {
  return (
    structureId === 'airway_wall' ||
    structureId === selectedPreset?.station_key ||
    activeStructure === structureId ||
    intersectedStructureIds.has(structureId)
  );
}

function disposeMaterial(material: THREE.Material | THREE.Material[] | undefined): void {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }

  material?.dispose();
}

function axisVector(axis: string | undefined, fallback: THREE.Vector3): THREE.Vector3 {
  const normalized = axis?.trim().toLowerCase();
  const sign = normalized?.startsWith('-') ? -1 : 1;
  const key = normalized?.replace(/^[+-]/, '');

  if (key === 'x') {
    return new THREE.Vector3(sign, 0, 0);
  }

  if (key === 'y') {
    return new THREE.Vector3(0, sign, 0);
  }

  if (key === 'z') {
    return new THREE.Vector3(0, 0, sign);
  }

  return fallback.clone().normalize();
}

function scopePoseQuaternion(pose: SimulatorProbePose, scopeModel: SimulatorScopeModelAsset): THREE.Quaternion {
  const depthAxis = pose.depthAxis.clone().normalize();
  const shaftAxis = scopeModel.lock_to_fan ? cephalicImageAxis(pose) : pose.tangent.clone().normalize();
  const lateralAxis = scopeModel.lock_to_fan
    ? new THREE.Vector3().crossVectors(depthAxis, shaftAxis).normalize()
    : pose.lateralAxis.clone().normalize();
  const worldBasis = new THREE.Matrix4().makeBasis(lateralAxis, depthAxis, shaftAxis);
  const modelBasis = new THREE.Matrix4().makeBasis(
    axisVector(scopeModel.lateral_axis, new THREE.Vector3(1, 0, 0)),
    axisVector(scopeModel.depth_axis, new THREE.Vector3(0, 1, 0)),
    axisVector(scopeModel.shaft_axis, new THREE.Vector3(0, 0, 1)),
  );

  return new THREE.Quaternion().setFromRotationMatrix(worldBasis.multiply(modelBasis.invert()));
}

function anchorCoordinate(minimum: number, maximum: number, mode: 'min' | 'center' | 'max' | undefined): number {
  if (mode === 'min') {
    return minimum;
  }

  if (mode === 'max') {
    return maximum;
  }

  return (minimum + maximum) / 2;
}

function scopeFanApexAnchorLocal(model: THREE.Group, scopeModel: SimulatorScopeModelAsset): THREE.Vector3 {
  if (scopeModel.fan_apex_anchor_point) {
    return toVector(scopeModel.fan_apex_anchor_point);
  }

  const bounds = new THREE.Box3().setFromObject(model);
  if (bounds.isEmpty()) {
    return new THREE.Vector3();
  }

  const anchor = scopeModel.fan_apex_anchor ?? {};
  return new THREE.Vector3(
    anchorCoordinate(bounds.min.x, bounds.max.x, anchor.x),
    anchorCoordinate(bounds.min.y, bounds.max.y, anchor.y),
    anchorCoordinate(bounds.min.z, bounds.max.z, anchor.z),
  );
}

/** Re-pose an already prepared scope model; cheap enough to run per frame while driving. */
function applyScopeModelPose(model: THREE.Group, pose: SimulatorProbePose, scopeModel: SimulatorScopeModelAsset) {
  const apexAnchorLocal = model.userData.apexAnchorLocal as THREE.Vector3;
  const scale = model.userData.scaleMmPerUnit as number;
  const poseQuaternion = scopePoseQuaternion(pose, scopeModel);
  const apexAnchorOffset = apexAnchorLocal.clone().multiplyScalar(scale).applyQuaternion(poseQuaternion);

  model.quaternion.copy(poseQuaternion);
  model.position.copy(pose.position.clone().sub(apexAnchorOffset));
}

function prepareScopeModel(
  template: THREE.Group,
  pose: SimulatorProbePose,
  scopeModel: SimulatorScopeModelAsset,
): THREE.Group {
  const model = template.clone(true);
  // The apex anchor comes from the untransformed clone's bounds; cache it (with the scale) so
  // per-frame re-posing never has to re-measure the model.
  const apexAnchorLocal = scopeFanApexAnchorLocal(model, scopeModel);
  const scale = Number.isFinite(scopeModel.scale_mm_per_unit) ? scopeModel.scale_mm_per_unit : 44;

  model.name = `scope-model:${scopeModel.key}`;
  model.userData.apexAnchorLocal = apexAnchorLocal;
  model.userData.scaleMmPerUnit = scale;
  model.scale.setScalar(scale);
  applyScopeModelPose(model, pose, scopeModel);
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    if (!mesh.geometry.getAttribute('normal')) {
      mesh.geometry.computeVertexNormals();
    }

    mesh.userData.sharedAssetGeometry = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 8;
  });

  return model;
}

export function AnatomyScene({
  activeStructure,
  assets,
  cameraPose,
  caseData,
  celebration = null,
  hiddenStructureIds,
  intersectedStructureIds,
  layers,
  lockView,
  pose,
  questBeacon = null,
  selectedPreset,
  teachingView,
}: {
  activeStructure: string | null;
  assets: SimulatorLoadedAssets;
  cameraPose: SimulatorProbePose;
  caseData: SimulatorCaseManifest;
  /** One-shot particle burst (Station Quest capture); each new nonce plays exactly once. */
  celebration?: { nonce: number; position: Vec3 } | null;
  hiddenStructureIds?: Set<string>;
  intersectedStructureIds: Set<string>;
  layers: SimulatorLayerState;
  lockView?: boolean;
  pose: SimulatorProbePose;
  /** Pulsing target marker for the Station Quest hint. */
  questBeacon?: { position: Vec3 } | null;
  selectedPreset: SimulatorPreset | null;
  teachingView: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lockedCameraViewRef = useRef<LockedCameraView | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  // Nonce of the last celebration burst already played, so scene rebuilds (layer toggles etc.)
  // never replay an old burst.
  const celebrationPlayedRef = useRef(0);
  // Pose and highlight state flow through refs into the render loop (the BronchoscopyView
  // pattern): driving the scope updates transforms per frame instead of rebuilding the scene.
  const poseRef = useRef(pose);
  poseRef.current = pose;
  const cameraPoseRef = useRef(cameraPose);
  cameraPoseRef.current = cameraPose;
  const highlightStateRef = useRef({
    activeStructure,
    intersectedStructureIds,
    selectedStationKey: selectedPreset?.station_key ?? null,
    teachingView,
  });
  highlightStateRef.current = {
    activeStructure,
    intersectedStructureIds,
    selectedStationKey: selectedPreset?.station_key ?? null,
    teachingView,
  };

  // The scene-content effect below re-runs on every pose/layer change, but the WebGL context must
  // NOT be recreated with it: browsers cap the number of live WebGL contexts per page and evict
  // the oldest, which killed the optical pane's context while driving the probe. One renderer is
  // created lazily per mount, reused by every content rebuild, and disposed only on unmount.
  useEffect(
    () => () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    if (!rendererRef.current) {
      rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
    const renderer = rendererRef.current;
    renderer.setSize(width, height);
    renderer.setClearColor('#101416', 1);
    container.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#101416', 360, 780);

    const boundsCenter = toVector(caseData.bounds.center);
    const size = toVector(caseData.bounds.size);
    const sceneRadius = Math.max(size.x, size.y, size.z, 180);
    const freeDriveView = selectedPreset === null;
    // Camera framing recomputes per pose while driving; the render loop eases toward it.
    const cameraFraming = (framingPose: SimulatorProbePose) => {
      const focus = freeDriveView
        ? boundsCenter.clone().lerp(framingPose.position, 0.52).add(new THREE.Vector3(0, 34, 0))
        : framingPose.position.clone().add(framingPose.depthAxis.clone().multiplyScalar(15));
      const position = freeDriveView
        ? focus.clone().add(FREE_DRIVE_ANTERIOR_CAMERA_OFFSET)
        : focus
            .clone()
            .add(framingPose.lateralAxis.clone().multiplyScalar(92))
            .add(framingPose.depthAxis.clone().multiplyScalar(-118))
            .add(framingPose.tangent.clone().multiplyScalar(58))
            .add(new THREE.Vector3(0, 54, 0));
      return { focus, position };
    };
    const initialFraming = cameraFraming(cameraPoseRef.current);
    const lockedCameraView = resolveLockedAnatomyCameraView(lockView, lockedCameraViewRef.current);
    const camera = new THREE.PerspectiveCamera(freeDriveView ? 52 : 42, width / height, 0.1, sceneRadius * 8);
    camera.position.copy(lockedCameraView?.position ?? initialFraming.position);
    camera.lookAt(lockedCameraView?.target ?? initialFraming.focus);

    const cutPlane = layers.cutPlane
      ? new THREE.Plane().setFromNormalAndCoplanarPoint(sectorPlaneNormal(poseRef.current), poseRef.current.position)
      : null;
    if (cutPlane && cutPlane.distanceToPoint(camera.position) > 0) {
      cutPlane.negate();
    }
    const anatomyClippingPlanes = cutPlane ? [cutPlane] : null;
    renderer.localClippingEnabled = Boolean(anatomyClippingPlanes);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(lockedCameraView?.target ?? initialFraming.focus);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.8;

    scene.add(new THREE.AmbientLight('#f2f7ef', .85));
    const light = new THREE.DirectionalLight('#ffffff', 2);
    light.position.copy(boundsCenter.clone().add(new THREE.Vector3(100, 160, 120)));
    scene.add(light);

    const cleanModel = primaryCleanModel(caseData);
    let cancelled = false;

    // Highlight targets (teaching focus, live sector intersections, hover) restyle in the render
    // loop from highlightStateRef — a highlight change never rebuilds the scene.
    const highlightMeshes: Array<{
      layer: keyof SimulatorLayerState;
      material: THREE.MeshStandardMaterial;
      structureId: string;
    }> = [];
    const highlightPoints: Array<{ kind: 'node' | 'vessel'; material: THREE.PointsMaterial; structureId: string }> = [];
    let highlightKey: string | null = null;
    const applyHighlights = () => {
      const {
        activeStructure: active,
        intersectedStructureIds: intersected,
        selectedStationKey,
        teachingView: teaching,
      } = highlightStateRef.current;
      const key = `${active ?? ''}|${selectedStationKey ?? ''}|${teaching ? 1 : 0}|${[...intersected].sort().join(',')}`;

      if (key === highlightKey) {
        return;
      }

      highlightKey = key;
      const focused = (structureId: string) =>
        structureId === 'airway_wall' ||
        structureId === selectedStationKey ||
        structureId === active ||
        intersected.has(structureId);

      for (const entry of highlightMeshes) {
        entry.material.opacity = cleanModelOpacity(entry.layer, focused(entry.structureId), teaching);
      }
      for (const entry of highlightPoints) {
        const highlighted = focused(entry.structureId);
        if (entry.kind === 'node') {
          entry.material.opacity = highlighted ? 0.9 : teaching ? 0.1 : 0.48;
          entry.material.size = highlighted ? 2.5 : 1.55;
        } else {
          entry.material.opacity = highlighted ? 0.9 : teaching ? 0.12 : 0.4;
          entry.material.size = highlighted ? 2.25 : 1.2;
        }
      }
    };

    if (cleanModel) {
      loadGlbModel(cleanModel)
        .then((template) => {
          if (cancelled) {
            return;
          }

          const model = template.clone(true);
          model.name = `clean-model:${cleanModel.key}`;
          model.applyMatrix4(GLB_SCENE_TO_WEB_MM_MATRIX);
          let visibleMeshCount = 0;
          model.traverse((object) => {
            const mesh = object as THREE.Mesh;

            if (!mesh.isMesh) {
              return;
            }

            const structureId = cleanModelStructureId(mesh.name || mesh.parent?.name || '');
            const layer = cleanModelLayer(structureId);
            mesh.visible = Boolean(layers[layer]) && !hiddenStructureIds?.has(structureId);

            if (!mesh.visible) {
              return;
            }

            visibleMeshCount += 1;
            if (!mesh.geometry.getAttribute('normal')) {
              mesh.geometry.computeVertexNormals();
            }

            mesh.userData.sharedAssetGeometry = true;
            const material = withClipping(
              new THREE.MeshStandardMaterial({
                color: cleanModelColor(structureId, caseData.color_map),
                roughness: .62,
                metalness: .03,
                depthWrite: false,
                opacity: 0.5,
                side: THREE.DoubleSide,
                transparent: true,
              }),
              anatomyClippingPlanes,
            );
            mesh.material = material;
            mesh.userData.generatedMaterial = true;
            mesh.renderOrder = layer === 'airway' || layer === 'context' ? 0 : 1;
            highlightMeshes.push({ layer, material, structureId });
          });
          scene.add(model);
          container.dataset.cleanMeshCount = String(visibleMeshCount);
          // Restyle the freshly loaded meshes on the next frame.
          highlightKey = null;
        })
        .catch((loadError) => {
          console.error('Failed to load simulator anatomy model', loadError);
        });
    }

    if (!cleanModel && layers.airway) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(assets.airway.vertices.flat(), 3));
      geometry.setIndex(assets.airway.triangles.flat());
      geometry.computeVertexNormals();
      scene.add(
        new THREE.Mesh(
          geometry,
          withClipping(
            new THREE.MeshStandardMaterial({
              color: caseData.color_map.airway ?? '#22c7c9',
              metalness: 0.02,
              opacity: 0.34 + (1 - 0.34) * AIRWAY_TRANSLUCENCY_REDUCTION,
              roughness: 0.66,
              side: THREE.DoubleSide,
              transparent: true,
            }),
            anatomyClippingPlanes,
          ),
        ),
      );
    }

    if (layers.centerline) {
      const group = new THREE.Group();
      for (const polyline of assets.centerlines.polylines) {
        const geometry = new THREE.BufferGeometry().setFromPoints(polyline.points.map(toVector));
        const material = withClipping(
          new THREE.LineBasicMaterial({
            color: selectedPreset && polyline.line_index === selectedPreset.line_index ? '#eef4f2' : '#56666a',
            opacity: selectedPreset && polyline.line_index === selectedPreset.line_index ? 0.82 : 0.28,
            transparent: true,
          }),
          anatomyClippingPlanes,
        );
        group.add(new THREE.Line(geometry, material));
      }
      scene.add(group);
    }

    if (!cleanModel && layers.stations) {
      for (const station of caseData.assets.stations) {
        if (hiddenStructureIds?.has(station.key)) {
          continue;
        }

        const points = assets.stations[station.key]?.points ?? [];
        if (!points.length) {
          continue;
        }

        const stationMaterial = withClipping(
          new THREE.PointsMaterial({
            color: station.color,
            depthWrite: false,
            opacity: 0.48,
            size: 1.55,
            transparent: true,
          }),
          anatomyClippingPlanes,
        );
        highlightPoints.push({ kind: 'node', material: stationMaterial, structureId: station.key });
        scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(points.map(toVector)), stationMaterial));
      }
    }

    if (!cleanModel && layers.vessels) {
      for (const vessel of caseData.assets.vessels) {
        if (hiddenStructureIds?.has(vessel.key)) {
          continue;
        }

        const points = assets.vessels[vessel.key]?.points ?? [];
        if (!points.length) {
          continue;
        }

        const vesselMaterial = withClipping(
          new THREE.PointsMaterial({
            color: vessel.color,
            depthWrite: false,
            opacity: 0.4,
            size: 1.2,
            transparent: true,
          }),
          anatomyClippingPlanes,
        );
        highlightPoints.push({ kind: 'vessel', material: vesselMaterial, structureId: vessel.key });
        scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(points.map(toVector)), vesselMaterial));
      }
    }

    if (layers.nodes) {
      for (const node of caseData.anatomy.nodes) {
        if (hiddenStructureIds?.has(node.station_key) || hiddenStructureIds?.has(node.key)) {
          continue;
        }

        const active =
          isTeachingFocus(node.station_key, selectedPreset, intersectedStructureIds, activeStructure) ||
          activeStructure === node.key;
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(active ? node.radius_mm * 1.1 : node.radius_mm, 18, 12),
          withClipping(
            new THREE.MeshStandardMaterial({
              color: node.color,
              opacity: active ? 0.94 : teachingView ? 0.08 : 0.46,
              roughness: 0.5,
              transparent: true,
            }),
            anatomyClippingPlanes,
          ),
        );
        sphere.position.copy(toVector(node.position));
        scene.add(sphere);
      }
    }

    // Scope, contact marker, and sector fan follow the probe pose per frame in the render loop —
    // driving never rebuilds the scene. Dynamic geometry skips frustum culling (stale bounds).
    const scopeGroup = new THREE.Group();
    const scopeModel = caseData.assets.scope_model ?? null;
    let auxShaftPositions: THREE.BufferAttribute | null = null;
    let scopeModelGroup: THREE.Group | null = null;
    let contactMarker: THREE.Mesh | null = null;
    if (!scopeModel || scopeModel.show_auxiliary_shaft !== false) {
      auxShaftPositions = new THREE.BufferAttribute(new Float32Array(6), 3);
      const shaftGeometry = new THREE.BufferGeometry();
      shaftGeometry.setAttribute('position', auxShaftPositions);
      const shaftLine = new THREE.Line(shaftGeometry, new THREE.LineBasicMaterial({ color: '#f5e4c8' }));
      shaftLine.frustumCulled = false;
      scopeGroup.add(shaftLine);
    }

    if (scopeModel) {
      loadGlbModel(scopeModel)
        .then((template) => {
          if (!cancelled) {
            scopeModelGroup = prepareScopeModel(template, poseRef.current, scopeModel);
            scopeGroup.add(scopeModelGroup);
          }
        })
        .catch((loadError) => {
          console.error('Failed to load simulator scope model', loadError);
        });
    } else {
      contactMarker = new THREE.Mesh(
        new THREE.SphereGeometry(3.1, 20, 12),
        new THREE.MeshStandardMaterial({ color: '#f5e166', emissive: '#3a2e05', emissiveIntensity: 0.35 }),
      );
      scopeGroup.add(contactMarker);
    }
    scene.add(scopeGroup);

    let fanPositions: THREE.BufferAttribute | null = null;
    let fanEdgePositions: THREE.BufferAttribute | null = null;
    if (layers.fan) {
      fanPositions = new THREE.BufferAttribute(new Float32Array(9), 3);
      const fanGeometry = new THREE.BufferGeometry();
      fanGeometry.setAttribute('position', fanPositions);
      fanGeometry.setIndex([0, 1, 2]);
      const fan = new THREE.Mesh(
        fanGeometry,
        new THREE.MeshBasicMaterial({
          color: '#8bd4ff',
          depthWrite: false,
          opacity: layers.cutPlane ? 0.12 : 0.18,
          side: THREE.DoubleSide,
          transparent: true,
        }),
      );
      fan.renderOrder = 5;
      fan.frustumCulled = false;
      scene.add(fan);
      fanEdgePositions = new THREE.BufferAttribute(new Float32Array(12), 3);
      const fanEdgeGeometry = new THREE.BufferGeometry();
      fanEdgeGeometry.setAttribute('position', fanEdgePositions);
      const fanEdge = new THREE.Line(
        fanEdgeGeometry,
        new THREE.LineBasicMaterial({ color: '#bfe7ff', opacity: 0.72, transparent: true }),
      );
      fanEdge.renderOrder = 6;
      fanEdge.frustumCulled = false;
      scene.add(fanEdge);
    }

    const fanDepth = caseData.render_defaults.max_depth_mm;
    const fanHalfWidth = fanDepth * Math.tan(THREE.MathUtils.degToRad(caseData.render_defaults.sector_angle_deg / 2));
    let appliedPose: SimulatorProbePose | null = null;
    const applyProbePose = (probe: SimulatorProbePose) => {
      if (auxShaftPositions) {
        const shaftStart = probe.position.clone().add(probe.tangent.clone().multiplyScalar(-22));
        const shaftEnd = probe.position.clone().add(probe.tangent.clone().multiplyScalar(34));
        auxShaftPositions.setXYZ(0, shaftStart.x, shaftStart.y, shaftStart.z);
        auxShaftPositions.setXYZ(1, shaftEnd.x, shaftEnd.y, shaftEnd.z);
        auxShaftPositions.needsUpdate = true;
      }
      if (scopeModelGroup && scopeModel) {
        applyScopeModelPose(scopeModelGroup, probe, scopeModel);
      }
      contactMarker?.position.copy(probe.position);

      if (fanPositions && fanEdgePositions) {
        const apex = probe.position;
        const imageAxis = cephalicImageAxis(probe);
        const farCenter = apex.clone().add(probe.depthAxis.clone().multiplyScalar(fanDepth));
        const left = farCenter.clone().add(imageAxis.clone().multiplyScalar(-fanHalfWidth));
        const right = farCenter.clone().add(imageAxis.clone().multiplyScalar(fanHalfWidth));
        fanPositions.setXYZ(0, apex.x, apex.y, apex.z);
        fanPositions.setXYZ(1, left.x, left.y, left.z);
        fanPositions.setXYZ(2, right.x, right.y, right.z);
        fanPositions.needsUpdate = true;
        for (const [index, point] of [apex, left, right, apex].entries()) {
          fanEdgePositions.setXYZ(index, point.x, point.y, point.z);
        }
        fanEdgePositions.needsUpdate = true;
      }

      if (cutPlane) {
        cutPlane.setFromNormalAndCoplanarPoint(sectorPlaneNormal(probe), probe.position);
        if (cutPlane.distanceToPoint(camera.position) > 0) {
          cutPlane.negate();
        }
      }
    };
    applyProbePose(poseRef.current);
    appliedPose = poseRef.current;

    // While driving, the unlocked camera eases toward the framing for the latest pose, then
    // releases so free orbiting is never fought when the scope is at rest.
    let followFraming: { focus: THREE.Vector3; position: THREE.Vector3 } | null = null;
    let followedCameraPose: SimulatorProbePose = cameraPoseRef.current;

    // Station Quest hint beacon: a camera-facing pulsing halo with a core glow and a vertical
    // light column, animated in the render loop below.
    let beaconHalo: THREE.Mesh | null = null;
    let beaconCore: THREE.Mesh | null = null;
    let beaconBeam: THREE.Mesh | null = null;
    if (questBeacon) {
      const beaconGroup = new THREE.Group();
      const beaconColor = '#ffd166';
      beaconHalo = new THREE.Mesh(
        new THREE.TorusGeometry(9, 0.7, 12, 48),
        new THREE.MeshBasicMaterial({ color: beaconColor, depthWrite: false, opacity: 0.9, transparent: true }),
      );
      beaconCore = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 18, 12),
        new THREE.MeshBasicMaterial({ color: beaconColor, depthWrite: false, opacity: 0.55, transparent: true }),
      );
      beaconBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.7, 70, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: beaconColor, depthWrite: false, opacity: 0.22, transparent: true }),
      );
      beaconBeam.position.y = 35;
      for (const part of [beaconHalo, beaconCore, beaconBeam]) {
        part.userData.generatedMaterial = true;
        part.renderOrder = 7;
        beaconGroup.add(part);
      }
      beaconGroup.position.copy(toVector(questBeacon.position));
      scene.add(beaconGroup);
    }

    // Station Quest capture burst: a one-shot expanding particle shell, played once per nonce.
    let burstPoints: THREE.Points | null = null;
    let burstVelocities: Float32Array | null = null;
    let burstStartMs = 0;
    let burstOrigin: THREE.Vector3 | null = null;
    const BURST_DURATION_MS = 1400;
    if (celebration && celebrationPlayedRef.current !== celebration.nonce) {
      celebrationPlayedRef.current = celebration.nonce;
      const particleCount = 110;
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);
      burstVelocities = new Float32Array(particleCount * 3);
      burstOrigin = toVector(celebration.position);
      const origin = burstOrigin;
      const palette = [new THREE.Color('#ffd166'), new THREE.Color('#8bd4ff'), new THREE.Color('#93c56f')];
      for (let index = 0; index < particleCount; index += 1) {
        positions[index * 3] = origin.x;
        positions[index * 3 + 1] = origin.y;
        positions[index * 3 + 2] = origin.z;
        // Random unit direction scaled to 24-62 mm/s so the shell reads as a firework.
        const theta = Math.random() * Math.PI * 2;
        const z = Math.random() * 2 - 1;
        const planar = Math.sqrt(Math.max(0, 1 - z * z));
        const speed = 24 + Math.random() * 38;
        burstVelocities[index * 3] = planar * Math.cos(theta) * speed;
        burstVelocities[index * 3 + 1] = planar * Math.sin(theta) * speed;
        burstVelocities[index * 3 + 2] = z * speed;
        const color = palette[index % palette.length];
        colors[index * 3] = color.r;
        colors[index * 3 + 1] = color.g;
        colors[index * 3 + 2] = color.b;
      }
      const burstGeometry = new THREE.BufferGeometry();
      burstGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      burstGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      burstPoints = new THREE.Points(
        burstGeometry,
        new THREE.PointsMaterial({
          depthWrite: false,
          opacity: 1,
          size: 2.6,
          transparent: true,
          vertexColors: true,
        }),
      );
      burstPoints.userData.generatedMaterial = true;
      burstPoints.renderOrder = 8;
      burstStartMs = performance.now();
      scene.add(burstPoints);
    }

    // Size sync shared by the ResizeObserver and the render loop, so focus-layout pane swaps
    // apply on the next frame even when observer delivery lags the grid reflow.
    let viewWidth = width;
    let viewHeight = height;
    const applyViewSize = (nextWidth: number, nextHeight: number) => {
      if (!nextWidth || !nextHeight || (nextWidth === viewWidth && nextHeight === viewHeight)) {
        return;
      }
      viewWidth = nextWidth;
      viewHeight = nextHeight;
      renderer.setSize(nextWidth, nextHeight);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
    };

    let frameId = 0;
    const render = () => {
      applyViewSize(container.clientWidth, container.clientHeight);

      const currentPose = poseRef.current;
      if (currentPose !== appliedPose) {
        appliedPose = currentPose;
        applyProbePose(currentPose);
      }

      const currentCameraPose = cameraPoseRef.current;
      if (currentCameraPose !== followedCameraPose) {
        followedCameraPose = currentCameraPose;
        if (!lockView) {
          followFraming = cameraFraming(currentCameraPose);
        }
      }
      if (followFraming) {
        camera.position.lerp(followFraming.position, 0.16);
        controls.target.lerp(followFraming.focus, 0.16);
        if (
          camera.position.distanceToSquared(followFraming.position) < 0.25 &&
          controls.target.distanceToSquared(followFraming.focus) < 0.25
        ) {
          camera.position.copy(followFraming.position);
          controls.target.copy(followFraming.focus);
          followFraming = null;
        }
      }

      applyHighlights();
      controls.update();

      if (beaconHalo && beaconCore && beaconBeam) {
        const pulse = performance.now() / 1000;
        const wave = (Math.sin(pulse * 3.4) + 1) / 2;
        beaconHalo.scale.setScalar(1 + wave * 0.45);
        beaconHalo.lookAt(camera.position);
        (beaconHalo.material as THREE.MeshBasicMaterial).opacity = 0.45 + wave * 0.45;
        beaconCore.scale.setScalar(0.85 + wave * 0.5);
        (beaconBeam.material as THREE.MeshBasicMaterial).opacity = 0.12 + wave * 0.18;
      }

      if (burstPoints && burstVelocities && burstOrigin) {
        const elapsedMs = performance.now() - burstStartMs;
        if (elapsedMs >= BURST_DURATION_MS) {
          scene.remove(burstPoints);
          burstPoints.geometry.dispose();
          disposeMaterial(burstPoints.material);
          burstPoints = null;
          burstVelocities = null;
        } else {
          const seconds = elapsedMs / 1000;
          const ease = 1 - Math.pow(1 - Math.min(elapsedMs / BURST_DURATION_MS, 1), 2);
          const positionAttribute = burstPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
          const origin = burstOrigin;
          for (let index = 0; index < positionAttribute.count; index += 1) {
            positionAttribute.setXYZ(
              index,
              origin.x + burstVelocities[index * 3] * ease,
              // Gravity settle so the shell falls like sparks rather than only expanding.
              origin.y + burstVelocities[index * 3 + 1] * ease - 14 * seconds * seconds,
              origin.z + burstVelocities[index * 3 + 2] * ease,
            );
          }
          positionAttribute.needsUpdate = true;
          (burstPoints.material as THREE.PointsMaterial).opacity = 1 - elapsedMs / BURST_DURATION_MS;
        }
      }

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };
    render();

    const resizeObserver = new ResizeObserver(() => {
      applyViewSize(container.clientWidth, container.clientHeight);
    });
    resizeObserver.observe(container);

    return () => {
      lockedCameraViewRef.current = {
        position: camera.position.clone(),
        target: controls.target.clone(),
      };
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      // The renderer (and its WebGL context) persists across content rebuilds; the unmount-only
      // effect above owns its disposal.
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry && !mesh.userData.sharedAssetGeometry) {
          mesh.geometry.dispose();
        }
        if (mesh.userData.generatedMaterial) {
          disposeMaterial(mesh.material);
        }
      });
    };
    // Pose, camera pose, highlight set, hover, and teaching-view state deliberately stay OUT of
    // these deps — they stream through refs into the render loop above, so driving the scope never
    // tears the scene down.
  }, [assets, caseData, celebration, hiddenStructureIds, layers, lockView, questBeacon, selectedPreset]);

  return (
    <div
      className="simulator-scene-canvas"
      data-clean-model={primaryCleanModel(caseData)?.asset ?? ''}
      data-fan-depth-axis={pose.depthAxis.toArray().map((value) => value.toFixed(3)).join(',')}
      data-fan-image-axis={cephalicImageAxis(pose).toArray().map((value) => value.toFixed(3)).join(',')}
      data-scope-model={caseData.assets.scope_model?.asset ?? ''}
      ref={containerRef}
    />
  );
}
