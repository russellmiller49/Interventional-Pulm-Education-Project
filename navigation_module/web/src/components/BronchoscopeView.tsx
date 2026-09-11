import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import * as THREE from "three";
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {mucosaVertexShader,mucosaFragmentShader} from '@bronchoscopy-core/mucosa';
import {makeFrame,steerFrame,rollFrame,verticalFov,type OpticalFrame} from '@bronchoscopy-core/frame';
import {trainerWebToPatient,patientToTrainerWeb} from '@bronchoscopy-core/devices';
import {opticalPixelRatio} from '@bronchoscopy-core/quality';
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { Decision, ScopeAdjustment, Vec3 } from "../types";
import { add, normalize, rasToScene, scale, subtract } from "../geometry";
import { type CaseIndexes, optionPathPoints } from "../route";
import { getMessages, type Messages } from "../i18n";

declare const __APP_BASE_PATH__: string;

interface ScopeLabel {
  label: string;
  edgeId: number;
  x: number;
  y: number;
  state: "neutral" | "correct" | "wrong" | "correct-unselected";
  visible: boolean;
  aimed: boolean;
}

/** Live steering offsets from the physical scope tracker (composed after authored adjustments). */
export interface LiveScopeSteer {
  pitchDeg: number;
  rollDeg: number;
}

interface CompassMarker {
  label: "R" | "L" | "A" | "P";
  x: number;
  y: number;
}

export interface ScopeCameraPose {
  cameraRas: Vec3;
  targetRas: Vec3;
}

interface BronchoscopeViewProps {
  decision: Decision | null;
  indexes: CaseIndexes;
  selectedEdgeId: number | null;
  drivePose?: ScopeCameraPose | null;
  applyDriveAdjustment?: boolean;
  showDecisionLabels?: boolean;
  showCompass?: boolean;
  showTumor?: boolean;
  noduleRas?: Vec3 | null;
  noduleMeshUrl?: string | null;
  statusLabel?: string;
  debugMode?: boolean;
  adjustment?: ScopeAdjustment;
  onAdjustmentChange?: (adjustment: ScopeAdjustment) => void;
  onOptionSelect?: (edgeId: number) => void;
  liveSteer?: LiveScopeSteer | null;
  onAimOption?: (edgeId: number | null) => void;
  onRenderedFrame?:(frame:OpticalFrame)=>void;
  footer?: ReactNode;
  meshUrl?: string;
  messages?: Messages["bronchoscope"];
}

export const DEFAULT_SCOPE_ADJUSTMENT: ScopeAdjustment = {
  cameraBackMm: 18,
  lookAheadMm: 30,
  yawDeg: 0,
  pitchDeg: 0,
  rollDeg: 0,
  fovDeg: 84,
  labelOffsets: {}
};

const geometryCache = new Map<string, Promise<THREE.BufferGeometry>>();
const noduleGeometryCache = new Map<string, Promise<THREE.BufferGeometry>>();
export const MIN_SCOPE_CAMERA_BACK_MM = 4;
export const MAX_SCOPE_CAMERA_BACK_MM = 45;
const SHORT_SEGMENT_BACK_FRACTION = 0.7;
const PARENT_CLEARANCE_MM = 3;

function appAssetUrl(path: string) {
  return new URL(path, new URL(__APP_BASE_PATH__, window.location.origin)).toString();
}

export function normalizeScopeAdjustment(adjustment?: Partial<ScopeAdjustment>): ScopeAdjustment {
  return {
    cameraBackMm: numberOrDefault(adjustment?.cameraBackMm, DEFAULT_SCOPE_ADJUSTMENT.cameraBackMm),
    lookAheadMm: numberOrDefault(adjustment?.lookAheadMm, DEFAULT_SCOPE_ADJUSTMENT.lookAheadMm),
    yawDeg: numberOrDefault(adjustment?.yawDeg, DEFAULT_SCOPE_ADJUSTMENT.yawDeg),
    pitchDeg: numberOrDefault(adjustment?.pitchDeg, DEFAULT_SCOPE_ADJUSTMENT.pitchDeg),
    rollDeg: numberOrDefault(adjustment?.rollDeg, DEFAULT_SCOPE_ADJUSTMENT.rollDeg),
    fovDeg: numberOrDefault(adjustment?.fovDeg, DEFAULT_SCOPE_ADJUSTMENT.fovDeg),
    labelOffsets: adjustment?.labelOffsets ?? {}
  };
}

export function scopeCameraBackLimitMm(decision: Decision | null, indexes: CaseIndexes): number {
  if (!decision) {
    return MAX_SCOPE_CAMERA_BACK_MM;
  }
  const node = indexes.nodesById.get(decision.nodeId);
  return node ? safeIncomingBackDistance(MAX_SCOPE_CAMERA_BACK_MM, availableIncomingDistance(node, indexes)) : MAX_SCOPE_CAMERA_BACK_MM;
}

function numberOrDefault(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function BronchoscopeView({
  decision,
  indexes,
  selectedEdgeId,
  drivePose = null,
  applyDriveAdjustment = false,
  showDecisionLabels = true,
  showCompass = false,
  showTumor = false,
  noduleRas = null,
  noduleMeshUrl = null,
  statusLabel,
  debugMode = false,
  adjustment: rawAdjustment,
  onAdjustmentChange,
  onOptionSelect,
  liveSteer = null,
  onAimOption,
  footer,
  onRenderedFrame,
  meshUrl = appAssetUrl("cases/default/airway_surface.stl"),
  messages = getMessages("en").bronchoscope
}: BronchoscopeViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const headlightRef = useRef<THREE.PointLight | null>(null);
  const airwayMeshRef=useRef<THREE.Mesh|null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const tumorMeshRef = useRef<THREE.Mesh | null>(null);
  const tumorMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const labelsVisibleRef = useRef(false);
  const compassVisibleRef = useRef(false);
  const renderRef = useRef<() => void>(() => {});
  const [labels, setLabels] = useState<ScopeLabel[]>([]);
  const [compassMarkers, setCompassMarkers] = useState<CompassMarker[]>([]);
  const [meshStatus, setMeshStatus] = useState<"loading" | "ready" | "error">("loading");
  const aimedEdgeIdRef = useRef<number | null>(null);
  const adjustment = normalizeScopeAdjustment(rawAdjustment);

  const reportAimedOption = (edgeId: number | null) => {
    if (aimedEdgeIdRef.current !== edgeId) {
      aimedEdgeIdRef.current = edgeId;
      onAimOption?.(edgeId);
    }
  };

  renderRef.current = () => {
    const mount = mountRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const headlight = headlightRef.current;
    if (!mount || !renderer || !scene || !camera || !headlight) {
      return;
    }
    positionCamera(camera, decision, indexes, adjustment, drivePose, applyDriveAdjustment, liveSteer);
    camera.updateMatrixWorld(true);
    headlight.position.copy(camera.position);
    const forward=camera.getWorldDirection(new THREE.Vector3());
    materialRef.current?.uniforms.uHeadlightAxis.value.copy(forward);
    const renderedFrame=makeFrame(trainerWebToPatient(camera.position.toArray()),trainerWebToPatient(forward.toArray()),trainerWebToPatient(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1).toArray()));
    mount.dataset.scopePoseLps=JSON.stringify(renderedFrame);
    onRenderedFrame?.(renderedFrame);
    if (showDecisionLabels && decision) {
      labelsVisibleRef.current = true;
      const nextLabels = buildLabels(camera, mount, decision, indexes, selectedEdgeId, adjustment, onAimOption != null,airwayMeshRef.current);
      setLabels(nextLabels);
      reportAimedOption(nextLabels.find((item) => item.aimed)?.edgeId ?? null);
    } else if (labelsVisibleRef.current) {
      labelsVisibleRef.current = false;
      setLabels([]);
      reportAimedOption(null);
    }
    if (showCompass) {
      compassVisibleRef.current = true;
      updateCompass(camera, mount, setCompassMarkers);
    } else if (compassVisibleRef.current) {
      compassVisibleRef.current = false;
      setCompassMarkers([]);
    }
    renderer.render(scene, camera);
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }
    mount.innerHTML = "";
    setLabels([]);
    setCompassMarkers([]);
    labelsVisibleRef.current = false;
    compassVisibleRef.current = false;
    setMeshStatus("loading");

    let cancelled = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(opticalPixelRatio(mount.clientWidth,window.devicePixelRatio));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x070201, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.35;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070201);

    const camera = new THREE.PerspectiveCamera(84, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.12, 900);
    camera.up.copy(toVector3([0, 1, 0]).normalize());

    const headlight = new THREE.PointLight(0xffd1ad, 18, 180, 1.1);
    headlight.position.copy(camera.position);
    scene.add(headlight);
    scene.add(new THREE.AmbientLight(0xffb08a, 0.65));

    const material = createBronchoscopyMaterial();
    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    headlightRef.current = headlight;
    materialRef.current = material;

    loadAirwayGeometry(meshUrl)
      .then((geometry) => {
        if (cancelled) {
          return;
        }
        setMeshStatus("ready");
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);airwayMeshRef.current=mesh;
        renderRef.current();
      })
      .catch(() => {
        if (!cancelled) {
          setMeshStatus("error");
          renderRef.current();
        }
      });

    const onResize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderRef.current();
    };
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    resizeObserver?.observe(mount);
    window.addEventListener("resize", onResize);
    renderRef.current();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onResize);
      materialRef.current?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      tumorMaterialRef.current?.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      headlightRef.current = null;
      materialRef.current = null;airwayMeshRef.current=null;
      tumorMeshRef.current = null;
      tumorMaterialRef.current = null;
      mount.innerHTML = "";
    };
  }, [meshUrl]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }

    if (tumorMeshRef.current) {
      scene.remove(tumorMeshRef.current);
      tumorMeshRef.current = null;
    }
    tumorMaterialRef.current?.dispose();
    tumorMaterialRef.current = null;

    if (!showTumor || !noduleMeshUrl || !noduleRas) {
      renderRef.current();
      return;
    }

    let cancelled = false;
    loadNoduleGeometry(noduleMeshUrl)
      .then((geometry) => {
        if (cancelled || !sceneRef.current) {
          return;
        }
        const material = createScopeTumorMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(toVector3(noduleRas));
        mesh.renderOrder = 2;
        tumorMeshRef.current = mesh;
        tumorMaterialRef.current = material;
        sceneRef.current.add(mesh);
        renderRef.current();
      })
      .catch(() => {
        renderRef.current();
      });

    return () => {
      cancelled = true;
      const currentScene = sceneRef.current;
      if (tumorMeshRef.current && currentScene) {
        currentScene.remove(tumorMeshRef.current);
      }
      tumorMeshRef.current = null;
      tumorMaterialRef.current?.dispose();
      tumorMaterialRef.current = null;
    };
  }, [showTumor, noduleMeshUrl, noduleRas?.[0], noduleRas?.[1], noduleRas?.[2]]);

  useEffect(() => {
    renderRef.current();
  }, [
    decision,
    indexes,
    selectedEdgeId,
    showDecisionLabels,
    showCompass,
    adjustment.cameraBackMm,
    adjustment.lookAheadMm,
    adjustment.yawDeg,
    adjustment.pitchDeg,
    adjustment.rollDeg,
    adjustment.fovDeg,
    adjustment.labelOffsets,
    applyDriveAdjustment,
    drivePose?.cameraRas[0],
    drivePose?.cameraRas[1],
    drivePose?.cameraRas[2],
    drivePose?.targetRas[0],
    drivePose?.targetRas[1],
    drivePose?.targetRas[2],
    liveSteer?.pitchDeg,
    liveSteer?.rollDeg
  ]);

  const beginLabelDrag = (item: ScopeLabel, event: PointerEvent<HTMLButtonElement>) => {
    if (!debugMode || !onAdjustmentChange) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startOffset = adjustment.labelOffsets[item.label] ?? { x: 0, y: 0 };
    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const nextOffset = {
        x: Math.round(startOffset.x + moveEvent.clientX - startX),
        y: Math.round(startOffset.y + moveEvent.clientY - startY)
      };
      onAdjustmentChange({
        ...adjustment,
        labelOffsets: {
          ...adjustment.labelOffsets,
          [item.label]: nextOffset
        }
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <section className="scope-panel">
      <div className="pane-chrome">
        <span>{messages.title}</span>
        <span>{statusLabel ?? (decision ? messages.decision(decision.index + 1) : messages.complete)}</span>
      </div>
      <div className="scope-mask scope-mask-real">
        <div ref={mountRef} className="scope-render" />
        {meshStatus === "loading" && <div className="scope-status">{messages.loadingAirwaySurface}</div>}
        {meshStatus === "error" && <div className="scope-status">{messages.airwaySurfaceUnavailable}</div>}
        {labels.filter((item)=>item.visible).map((item) => (
          <button
            type="button"
            key={item.label}
            className={`scope-label scope-label-${item.state} ${item.aimed ? "scope-label-aimed" : ""} ${debugMode ? "scope-label-debug" : ""} ${onOptionSelect && !debugMode ? "scope-label-selectable" : ""}`}
            style={{
              left: `${item.x}px`,
              top: `${item.y}px`,
              opacity: item.visible ? 1 : 0,
              pointerEvents: item.visible && (debugMode || onOptionSelect) ? "auto" : "none"
            }}
            onPointerDown={(event) => beginLabelDrag(item, event)}
            onClick={() => {
              if (!debugMode) {
                onOptionSelect?.(item.edgeId);
              }
            }}
            tabIndex={debugMode || !onOptionSelect ? -1 : 0}
            aria-label={messages.selectBranchAria(item.label)}
          >
            {item.label}
          </button>
        ))}
        {liveSteer && <span className="scope-crosshair" aria-hidden="true" />}
        {showCompass && compassMarkers.length > 0 && (
          <div className="scope-compass" aria-label={messages.patientOrientationOverlay}>
            <span className="scope-compass-ring" />
            {compassMarkers.map((item) => (
              <span key={item.label} className={`scope-compass-marker scope-compass-${item.label.toLowerCase()}`} style={{ left: `${item.x}px`, top: `${item.y}px` }}>
                {item.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {footer ? <div className="scope-footer">{footer}</div> : null}
    </section>
  );
}

function loadAirwayGeometry(url: string): Promise<THREE.BufferGeometry> {
  const cached = geometryCache.get(url);
  if (cached) {
    return cached;
  }
  const promise = new STLLoader().loadAsync(url).then((geometry) => {
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i += 1) {
      const l = positions.getX(i);
      const p = positions.getY(i);
      const s = positions.getZ(i);
      positions.setXYZ(i, -l, s, p);
    }
    positions.needsUpdate = true;
    geometry.deleteAttribute("normal");
    const welded=mergeVertices(geometry,1e-5);geometry.dispose();
    welded.computeVertexNormals();welded.computeBoundingSphere();welded.computeBoundingBox();return welded;
  });
  geometryCache.set(url, promise);
  return promise;
}

function loadNoduleGeometry(url: string): Promise<THREE.BufferGeometry> {
  const cached = noduleGeometryCache.get(url);
  if (cached) {
    return cached;
  }
  const promise = new STLLoader().loadAsync(url).then((geometry) => {
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i += 1) {
      const l = positions.getX(i);
      const p = positions.getY(i);
      const s = positions.getZ(i);
      positions.setXYZ(i, -l, s, p);
    }
    positions.needsUpdate = true;
    geometry.deleteAttribute("normal");
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.center();
    geometry.computeBoundingSphere();
    return geometry;
  });
  noduleGeometryCache.set(url, promise);
  return promise;
}

function createBronchoscopyMaterial():THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({side:THREE.BackSide,toneMapped:false,uniforms:{uHeadlightAxis:{value:new THREE.Vector3(0,0,-1)},uHeadlightFalloff:{value:1},uWallAlpha:{value:1}},vertexShader:mucosaVertexShader,fragmentShader:mucosaFragmentShader});
}

function createScopeTumorMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xb83d5f,
    roughness: 0.48,
    metalness: 0,
    emissive: 0x26040b,
    emissiveIntensity: 0.18,
    side: THREE.DoubleSide
  });
}

function positionCamera(
  camera: THREE.PerspectiveCamera,
  decision: Decision | null,
  indexes: CaseIndexes,
  adjustment: ScopeAdjustment,
  drivePose: ScopeCameraPose | null,
  applyDriveAdjustment: boolean,
  liveSteer: LiveScopeSteer | null
) {
  const useDrivePose = Boolean(drivePose && !(applyDriveAdjustment && decision));
  const cameraAdjustment = useDrivePose ? DEFAULT_SCOPE_ADJUSTMENT : adjustment;
  camera.fov = verticalFov(cameraAdjustment.fovDeg,camera.aspect);
  camera.updateProjectionMatrix();
  if (useDrivePose && drivePose) {
    aimCamera(camera, toVector3(drivePose.cameraRas), toVector3(drivePose.targetRas), cameraAdjustment, liveSteer);
    return;
  }
  if (!decision) {
    camera.position.set(0, 0, 240);
    camera.lookAt(0, 0, 0);
    return;
  }
  const node = indexes.nodesById.get(decision.nodeId);
  if (!node) {
    camera.position.set(0, 0, 240);
    camera.lookAt(0, 0, 0);
    return;
  }

  const incoming = incomingDirection(decision.nodeId, indexes);
  const cameraBackMm = safeIncomingBackDistance(adjustment.cameraBackMm, availableIncomingDistance(node, indexes));
  const cameraRas = add(node.ras, scale(incoming, -cameraBackMm));
  const targetRas = add(node.ras, scale(averageOptionDirection(decision, indexes, incoming), adjustment.lookAheadMm));
  aimCamera(camera, toVector3(cameraRas), toVector3(targetRas), cameraAdjustment, liveSteer);
}

function aimCamera(
  camera: THREE.PerspectiveCamera,
  cameraPosition: THREE.Vector3,
  targetPosition: THREE.Vector3,
  adjustment: ScopeAdjustment,
  liveSteer: LiveScopeSteer | null = null
) {
  let frame=makeFrame(trainerWebToPatient(cameraPosition.toArray()),trainerWebToPatient(targetPosition.clone().sub(cameraPosition).toArray()),[0,-1,0]);
  frame=steerFrame(frame,-adjustment.yawDeg,adjustment.pitchDeg);
  frame=rollFrame(frame,adjustment.rollDeg);
  if(liveSteer)frame=steerFrame(rollFrame(frame,liveSteer.rollDeg),0,liveSteer.pitchDeg);
  camera.position.set(...patientToTrainerWeb(frame.position));
  camera.up.set(...patientToTrainerWeb(frame.up));
  camera.lookAt(camera.position.clone().add(new THREE.Vector3(...patientToTrainerWeb(frame.forward))));
}

const AIM_RADIUS_FRACTION = 0.4;

function buildLabels(
  camera: THREE.PerspectiveCamera,
  mount: HTMLElement,
  decision: Decision | null,
  indexes: CaseIndexes,
  selectedEdgeId: number | null,
  adjustment: ScopeAdjustment,
  aimEnabled: boolean,
  airwayMesh:THREE.Mesh|null
): ScopeLabel[] {
  if (!decision) {
    return [];
  }
  const node = indexes.nodesById.get(decision.nodeId);
  if (!node) {
    return [];
  }
  const width = mount.clientWidth;
  const height = mount.clientHeight;
  const labels = decision.options.map((option) => {
    const points = optionPathPoints(decision, option, indexes);
    const labelRas = pointAlong(points, 16);
    const anchor=toVector3(labelRas),rayDirection=anchor.clone().sub(camera.position),distance=rayDirection.length();
    const wall=airwayMesh?new THREE.Raycaster(camera.position,rayDirection.normalize(),.05,Math.max(.05,distance-1)).intersectObject(airwayMesh,false)[0]:null;
    const projected = anchor.project(camera);
    const offset = adjustment.labelOffsets[option.label] ?? { x: 0, y: 0 };
    const selected = selectedEdgeId === option.edgeId;
    const state: ScopeLabel["state"] = selected
      ? option.isCorrect
        ? "correct"
        : "wrong"
      : selectedEdgeId != null && option.isCorrect
        ? "correct-unselected"
        : "neutral";
    return {
      label: option.label,
      edgeId: option.edgeId,
      x: (projected.x * 0.5 + 0.5) * width + offset.x,
      y: (-projected.y * 0.5 + 0.5) * height + offset.y,
      visible: !wall && projected.z > -1 && projected.z < 1 && Math.abs(projected.x)<1 && Math.abs(projected.y)<1,
      state,
      aimed: false
    };
  });
  if (aimEnabled) {
    // The aimed option is the visible label closest to the view center (where the
    // hardware crosshair sits), within a generous capture radius.
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDistance = Math.min(width, height) * AIM_RADIUS_FRACTION;
    let aimedIndex = -1;
    let bestDistance = maxDistance;
    labels.forEach((item, index) => {
      if (!item.visible) {
        return;
      }
      const distance = Math.hypot(item.x - centerX, item.y - centerY);
      if (distance <= bestDistance) {
        bestDistance = distance;
        aimedIndex = index;
      }
    });
    if (aimedIndex >= 0) {
      labels[aimedIndex] = { ...labels[aimedIndex], aimed: true };
    }
  }
  return labels;
}

function updateCompass(camera: THREE.PerspectiveCamera, mount: HTMLElement, setCompassMarkers: (markers: CompassMarker[]) => void) {
  const centerX = Math.max(58, mount.clientWidth - 68);
  const centerY = Math.max(58, mount.clientHeight - 66);
  const radius = 34;
  const cameraRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const cameraUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const patientDirections: { label: CompassMarker["label"]; direction: THREE.Vector3 }[] = [
    { label: "R", direction: toVector3([1, 0, 0]).normalize() },
    { label: "L", direction: toVector3([-1, 0, 0]).normalize() },
    { label: "A", direction: toVector3([0, 1, 0]).normalize() },
    { label: "P", direction: toVector3([0, -1, 0]).normalize() }
  ];

  setCompassMarkers(
    patientDirections.map((item) => {
      const xProjection = item.direction.dot(cameraRight);
      const yProjection = item.direction.dot(cameraUp);
      const length = Math.max(Math.hypot(xProjection, yProjection), 1e-4);
      return {
        label: item.label,
        x: centerX + (xProjection / length) * radius,
        y: centerY - (yProjection / length) * radius
      };
    })
  );
}

function incomingDirection(nodeId: number, indexes: CaseIndexes): Vec3 {
  const node = indexes.nodesById.get(nodeId);
  const parent = node?.parentNodeId == null ? null : indexes.nodesById.get(node.parentNodeId);
  return node && parent ? normalize(subtract(node.ras, parent.ras), [0, 0, -1]) : [0, 0, -1];
}

function availableIncomingDistance(node: { rootDistanceMm: number; parentNodeId: number | null }, indexes: CaseIndexes): number {
  const parent = node.parentNodeId == null ? null : indexes.nodesById.get(node.parentNodeId);
  return parent ? Math.max(0, node.rootDistanceMm - parent.rootDistanceMm) : MAX_SCOPE_CAMERA_BACK_MM;
}

function safeIncomingBackDistance(requestedBackMm: number, availableIncomingMm: number): number {
  if (!Number.isFinite(availableIncomingMm) || availableIncomingMm <= 0) {
    return Math.min(requestedBackMm, MAX_SCOPE_CAMERA_BACK_MM);
  }
  const shortSegmentBackMm = Math.max(availableIncomingMm * SHORT_SEGMENT_BACK_FRACTION, availableIncomingMm - PARENT_CLEARANCE_MM);
  return Math.max(0, Math.min(requestedBackMm, MAX_SCOPE_CAMERA_BACK_MM, shortSegmentBackMm));
}

function averageOptionDirection(decision: Decision, indexes: CaseIndexes, fallback: Vec3): Vec3 {
  const node = indexes.nodesById.get(decision.nodeId);
  if (!node) {
    return fallback;
  }
  const out: Vec3 = [0, 0, 0];
  decision.options.forEach((option) => {
    const points = optionPathPoints(decision, option, indexes);
    const direction = normalize(subtract(points[Math.min(1, points.length - 1)] ?? node.ras, points[0] ?? node.ras), fallback);
    out[0] += direction[0];
    out[1] += direction[1];
    out[2] += direction[2];
  });
  return normalize(out, fallback);
}

function pointAlong(points: Vec3[], distanceMm: number): Vec3 {
  if (!points.length) {
    return [0, 0, 0];
  }
  let travelled = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const next = points[i];
    const segment = Math.hypot(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]);
    if (travelled + segment >= distanceMm) {
      const t = (distanceMm - travelled) / Math.max(segment, 1e-6);
      return [prev[0] + (next[0] - prev[0]) * t, prev[1] + (next[1] - prev[1]) * t, prev[2] + (next[2] - prev[2]) * t];
    }
    travelled += segment;
  }
  return points[points.length - 1];
}

function toVector3(ras: Vec3): THREE.Vector3 {
  const point = rasToScene(ras);
  return new THREE.Vector3(point[0], point[1], point[2]);
}
