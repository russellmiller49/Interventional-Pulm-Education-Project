import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { patientToEbusWeb } from '@bronchoscopy-core/devices';
import type { Point3 } from '@bronchoscopy-core/frame';

import { EUS_GROUP_NAMES, EUS_LAYER_LABELS, isLayerGroup } from './content';
import { sectorGeometry } from './eusAcoustic';
import { EusHoverName } from './EusHoverName';
import { scopeShaftPolyline, type EusPose } from './eusPose';
import { eusCaseAssetUrl } from './paths';
import type { EusCaseManifest, EusLayerState, EusScopePath, EusStructure } from './types';

type ViewPreset = 'anterior' | 'left' | 'posterior' | 'right';

const VIEW_DIRECTIONS: Record<ViewPreset, THREE.Vector3> = {
  // Web frame: x = patient left, y = superior, z = anterior.
  anterior: new THREE.Vector3(0.18, 0.12, 1),
  left: new THREE.Vector3(1, 0.1, 0.12),
  posterior: new THREE.Vector3(-0.18, 0.12, -1),
  right: new THREE.Vector3(-1, 0.1, 0.12),
};
const WORLD_UP = new THREE.Vector3(0, 1, 0);
/** Draw order: surfaces, see-through shells, cut faces, then the scope and scan-plane overlays. */
const ORDER = { solid: 1, shell: 2, cutFace: 10, scope: 200, fan: 201, fanEdge: 202 };

/**
 * How a structure is drawn. Solid organs, vessels and nodes are opaque surfaces. Hollow or
 * enclosing structures are shells that thin out where they face the viewer, so what lies inside
 * and behind them stays visible while their outline still reads as a shape.
 */
interface StructureLook {
  /** Shell opacity where the surface faces the viewer and at its silhouette; null if opaque. */
  shell: { face: number; rim: number } | null;
  /** Opacity of the face drawn where the cut plane passes through the structure. */
  cutFace: number;
}

function structureLook(structure: EusStructure): StructureLook {
  if (structure.key === 'liver') return { shell: { face: 0.5, rim: 0.96 }, cutFace: 1 };
  switch (structure.group) {
    case 'gi':
      return { shell: { face: 0.2, rim: 0.86 }, cutFace: 0.5 };
    case 'bowel':
      return { shell: { face: 0.24, rim: 0.82 }, cutFace: 0.55 };
    case 'airway':
      return { shell: { face: 0.12, rim: 0.8 }, cutFace: 0.4 };
    case 'bone':
      return { shell: { face: 0.3, rim: 0.9 }, cutFace: 0.85 };
    default:
      return { shell: null, cutFace: 1 };
  }
}

function shellMaterial(color: string, face: number, rim: number) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const uniforms = { uFace: { value: face }, uRim: { value: rim } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFace;\nuniform float uRim;')
      .replace(
        '#include <opaque_fragment>',
        `float eusFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
        diffuseColor.a *= mix(uRim, uFace, pow(eusFacing, 1.5));
        #include <opaque_fragment>`,
      );
  };
  material.userData.shell = { uniforms, face };
  return material;
}

const web = (point: Point3) => new THREE.Vector3(...patientToEbusWeb(point));
/** Inverse of the web frame mapping: web [x, y, z] = patient [L, S, -P]. */
const lps = (point: THREE.Vector3): Point3 => [point.x, -point.z, point.y];

interface EusAnatomySceneProps {
  manifest: EusCaseManifest;
  path: EusScopePath;
  pose: EusPose;
  sMm: number;
  depthMm: number;
  layers: EusLayerState;
  onLayers: (layers: EusLayerState) => void;
  activeStructure: string | null;
  hoverStructure: string | null;
  onHoverStructure: (key: string | null) => void;
  /** False while a find-the-target round is running: pointing at the model names nothing. */
  namingEnabled: boolean;
  /** Segmented structure at a patient position, for naming a point on the cut face. */
  structureAt: (point: Point3) => string | null;
  /** The live ultrasound canvas, shown on the scan plane while the anatomy is cut. */
  sectorCanvas: HTMLCanvasElement | null;
  /** Registers a callback run each time the ultrasound canvas is redrawn. */
  subscribeFrames: (listener: () => void) => () => void;
}

interface StructureVisual {
  structure: EusStructure;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  /** Stencil passes and the colored face drawn where the cut plane passes through. */
  cutParts: THREE.Mesh[];
}

interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  scope: THREE.Group;
  cutFaces: THREE.Group;
  cutPlane: THREE.Plane;
  visuals: Map<string, StructureVisual>;
  sectorTexture: THREE.CanvasTexture | null;
  render: () => void;
}

/** OrbitControls caches the camera's up axis when it is built; this re-reads it. */
function setCameraUp(current: SceneState, up: THREE.Vector3) {
  current.camera.up.copy(up);
  const internals = current.controls as unknown as {
    _quat: THREE.Quaternion;
    _quatInverse: THREE.Quaternion;
  };
  internals._quat?.setFromUnitVectors(up, WORLD_UP);
  internals._quatInverse?.copy(internals._quat).invert();
}

export function EusAnatomyScene({
  manifest,
  path,
  pose,
  sMm,
  depthMm,
  layers,
  onLayers,
  activeStructure,
  hoverStructure,
  onHoverStructure,
  namingEnabled,
  structureAt,
  sectorCanvas,
  subscribeFrames,
}: EusAnatomySceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<SceneState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [follow, setFollow] = useState(true);
  const [cut, setCut] = useState(false);
  // While set, the camera keeps facing the scan plane as the scope moves.
  const [facingPlane, setFacingPlane] = useState(false);
  const [pointed, setPointed] = useState<{ key: string; left: number; top: number } | null>(null);
  // The render loop and pointer handlers read the latest values without re-subscribing.
  const live = useRef({ follow, cut, facingPlane, pose, depthMm, namingEnabled, structureAt, onHoverStructure });
  live.current = { follow, cut, facingPlane, pose, depthMm, namingEnabled, structureAt, onHoverStructure };

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 5, 6000);
    // Soft image-based light for the surfaces, a key light that travels with the camera so the
    // side being looked at is always lit, and a cool fill from below.
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xeaf2f8, 0x1c252b, 0.55));
    const key = new THREE.DirectionalLight(0xfff4e6, 1.7);
    key.position.set(-0.45, 0.7, 1);
    const fill = new THREE.DirectionalLight(0x9fc7ff, 0.45);
    fill.position.set(0.9, -0.5, 0.4);
    camera.add(key, fill);
    scene.add(camera);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.zoomSpeed = 0.8;
    // The wheel and a one-finger drag belong to the page until the learner clicks or taps the
    // model; otherwise scrolling past the pane would zoom or orbit it instead.
    const canvasElement = renderer.domElement;
    const engage = (engaged: boolean) => {
      controls.enableZoom = engaged;
      (controls.touches as { ONE: THREE.TOUCH | null }).ONE = engaged ? THREE.TOUCH.ROTATE : null;
      canvasElement.style.touchAction = engaged ? 'none' : 'pan-y';
      element.dataset.engaged = String(engaged);
    };
    engage(false);
    let down: { x: number; y: number; at: number } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') engage(true);
      else down = { x: event.clientX, y: event.clientY, at: performance.now() };
    };
    const onPointerUp = (event: PointerEvent) => {
      // A stationary tap engages; a finger that moved was scrolling the page.
      if (
        down &&
        performance.now() - down.at < 350 &&
        Math.hypot(event.clientX - down.x, event.clientY - down.y) < 8
      )
        engage(true);
      down = null;
    };
    const onOutside = (event: PointerEvent) => {
      if (!element.contains(event.target as Node)) engage(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') engage(false);
    };

    const anatomy = new THREE.Group(),
      scope = new THREE.Group(),
      cutFaces = new THREE.Group();
    scene.add(anatomy, scope, cutFaces);
    const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    const visuals = new Map<string, StructureVisual>();

    let queued = 0;
    const draw = () => {
      const { cut: cutting, pose: at } = live.current;
      if (cutting) {
        // The half of the anatomy on the viewer's side of the scan plane is removed.
        const origin = web(at.originLps);
        cutPlane.setFromNormalAndCoplanarPoint(web(at.planeNormalLps), origin);
        if (cutPlane.distanceToPoint(camera.position) > 0) cutPlane.negate();
        cutFaces.position.copy(origin);
        cutFaces.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), cutPlane.normal);
      }
      renderer.render(scene, camera);
    };
    const render = () => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        draw();
      });
    };
    controls.addEventListener('change', render);
    const resize = () => {
      const width = element.clientWidth,
        height = element.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      // Draw now: a deferred frame leaves the canvas blank between a resize and the next rAF.
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);

    // ---- Pointing at a structure names it ---------------------------------------------------
    const raycaster = new THREE.Raycaster();
    let pending: { x: number; y: number } | null = null,
      pointing = 0,
      named: string | null = null;
    const name = (key: string | null, left = 0, top = 0) => {
      if (key !== named) live.current.onHoverStructure(key);
      named = key;
      setPointed(key ? { key, left, top } : null);
    };
    const pick = () => {
      pointing = 0;
      if (!pending || !live.current.namingEnabled) return name(null);
      const rect = canvasElement.getBoundingClientRect();
      const left = pending.x - rect.left,
        top = pending.y - rect.top;
      raycaster.setFromCamera(
        new THREE.Vector2((left / rect.width) * 2 - 1, 1 - (top / rect.height) * 2),
        camera,
      );
      const shown = [...visuals.values()].filter((visual) => visual.mesh.visible);
      const cutting = live.current.cut;
      const hit = raycaster
        .intersectObjects(
          shown.map((visual) => visual.mesh),
          false,
        )
        .find((entry) => !cutting || cutPlane.distanceToPoint(entry.point) >= 0);
      let key = hit ? ((hit.object.userData.structure as EusStructure).key ?? null) : null;
      if (cutting) {
        // On the cut face the structure is whatever the scan plane passes through there.
        const onPlane = raycaster.ray.intersectPlane(cutPlane, new THREE.Vector3());
        if (onPlane && (!hit || onPlane.distanceTo(raycaster.ray.origin) <= hit.distance)) {
          const at = live.current.structureAt(lps(onPlane));
          if (at && visuals.get(at)?.mesh.visible) key = at;
        }
      }
      name(key, left, top);
    };
    const onPointerMove = (event: PointerEvent) => {
      // Orbiting by hand releases the camera from the scan plane.
      if (event.buttons && live.current.facingPlane) setFacingPlane(false);
      // Buttons held means the learner is orbiting, not pointing.
      if (event.pointerType !== 'mouse' || event.buttons) return;
      pending = { x: event.clientX, y: event.clientY };
      if (!pointing) pointing = requestAnimationFrame(pick);
    };
    const onPointerLeave = () => {
      engage(false);
      pending = null;
      name(null);
    };

    canvasElement.addEventListener('pointerdown', onPointerDown);
    canvasElement.addEventListener('pointerup', onPointerUp);
    canvasElement.addEventListener('pointermove', onPointerMove);
    canvasElement.addEventListener('mouseleave', onPointerLeave);
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKey);

    const center = new THREE.Vector3(...manifest.bounds.min)
      .add(new THREE.Vector3(...manifest.bounds.max))
      .multiplyScalar(0.5);
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(VIEW_DIRECTIONS.anterior.clone().normalize(), 560);
    controls.update();

    const current: SceneState = {
      renderer,
      scene,
      camera,
      controls,
      scope,
      cutFaces,
      cutPlane,
      visuals,
      sectorTexture: null,
      render,
    };
    state.current = current;
    resize();

    let disposed = false;
    const structures = new Map(manifest.structures.map((structure) => [structure.key, structure]));
    // Larger structures get their cut face first, so a node inside a vessel contour stays on top.
    const cutOrder = new Map(
      [...manifest.structures]
        .sort((a, b) => (b.volumeMl ?? 0) - (a.volumeMl ?? 0))
        .map((structure, index) => [structure.key, index]),
    );
    const cutFaceGeometry = new THREE.PlaneGeometry(900, 900);
    new GLTFLoader()
      .loadAsync(eusCaseAssetUrl(manifest.assets.model.asset, manifest.assets.model.sha256))
      .then((gltf) => {
        if (disposed) return;
        const found: Array<{ mesh: THREE.Mesh; structure: EusStructure }> = [];
        gltf.scene.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          const structure = structures.get(mesh.name) ?? structures.get(mesh.parent?.name ?? '');
          if (structure) found.push({ mesh, structure });
        });
        for (const { mesh, structure } of found) {
          mesh.geometry.computeVertexNormals();
          const look = structureLook(structure);
          const material = look.shell
            ? shellMaterial(structure.color, look.shell.face, look.shell.rim)
            : new THREE.MeshPhysicalMaterial({
                color: structure.color,
                roughness: 0.42,
                metalness: 0,
                clearcoat: 0.35,
                clearcoatRoughness: 0.45,
                side: THREE.DoubleSide,
              });
          material.clippingPlanes = [cutPlane];
          mesh.material = material;
          mesh.renderOrder = look.shell ? ORDER.shell : ORDER.solid;
          mesh.userData.structure = structure;

          // Cut face: count the surface's back and front faces in the stencil buffer, then
          // color the cut plane wherever the count shows the plane is inside the structure.
          const order = ORDER.cutFace + (cutOrder.get(structure.key) ?? 0);
          const stencil = (side: THREE.Side, operation: THREE.StencilOp) => {
            const pass = new THREE.Mesh(
              mesh.geometry,
              new THREE.MeshBasicMaterial({
                side,
                colorWrite: false,
                depthWrite: false,
                depthTest: false,
                transparent: true,
                clippingPlanes: [cutPlane],
                stencilWrite: true,
                stencilFunc: THREE.AlwaysStencilFunc,
                stencilFail: operation,
                stencilZFail: operation,
                stencilZPass: operation,
              }),
            );
            pass.renderOrder = order;
            mesh.parent!.add(pass);
            return pass;
          };
          const face = new THREE.Mesh(
            cutFaceGeometry,
            new THREE.MeshBasicMaterial({
              color: new THREE.Color(structure.color).multiplyScalar(0.86),
              side: THREE.DoubleSide,
              transparent: true,
              opacity: look.cutFace,
              depthWrite: look.cutFace === 1,
              stencilWrite: true,
              stencilRef: 0,
              stencilFunc: THREE.NotEqualStencilFunc,
              stencilFail: THREE.ReplaceStencilOp,
              stencilZFail: THREE.ReplaceStencilOp,
              stencilZPass: THREE.ReplaceStencilOp,
            }),
          );
          face.renderOrder = order + 0.5;
          face.onAfterRender = (context) => context.clearStencil();
          cutFaces.add(face);
          const cutParts = [
            stencil(THREE.BackSide, THREE.IncrementWrapStencilOp),
            stencil(THREE.FrontSide, THREE.DecrementWrapStencilOp),
            face,
          ];
          cutParts.forEach((part) => (part.visible = false));
          visuals.set(structure.key, { structure, mesh, material, cutParts });
        }
        anatomy.add(gltf.scene);
        setStatus('ready');
        render();
      })
      .catch(() => {
        if (!disposed) setStatus('error');
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(queued);
      cancelAnimationFrame(pointing);
      observer.disconnect();
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onKey);
      controls.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
      });
      scene.environment?.dispose();
      current.sectorTexture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      state.current = null;
    };
  }, [manifest]);

  // Layer visibility, the cut, and the highlighted structures.
  useEffect(() => {
    const current = state.current;
    if (!current) return;
    current.renderer.localClippingEnabled = cut;
    current.visuals.forEach(({ structure, mesh, material, cutParts }, key) => {
      mesh.visible = !isLayerGroup(structure.group) || layers[structure.group];
      cutParts.forEach((part) => (part.visible = cut && mesh.visible));
      const active = key === activeStructure,
        hovered = key === hoverStructure;
      material.emissive.set(active ? '#ffd166' : hovered ? '#fff3d6' : '#000000');
      material.emissiveIntensity = active ? 0.42 : hovered ? 0.13 : 0;
      const shell = material.userData.shell as
        | { uniforms: { uFace: { value: number } }; face: number }
        | undefined;
      // A highlighted shell fills in, so it can be told apart from its neighbors.
      if (shell) shell.uniforms.uFace.value = active || hovered ? Math.max(shell.face, 0.72) : shell.face;
    });
    current.render();
  }, [layers, activeStructure, hoverStructure, status, cut]);

  // The ultrasound canvas as a texture. Declared ahead of the scope so the sector can use it.
  useEffect(() => {
    const current = state.current;
    if (!current || current.sectorTexture?.image === sectorCanvas) return;
    current.sectorTexture?.dispose();
    current.sectorTexture = null;
    if (!sectorCanvas) return;
    current.sectorTexture = new THREE.CanvasTexture(sectorCanvas);
    current.sectorTexture.colorSpace = THREE.SRGBColorSpace;
  }, [sectorCanvas]);

  // Scope shaft, transducer and ultrasound sector.
  useEffect(() => {
    const current = state.current;
    if (!current) return;
    const { scope } = current;
    scope.children.slice().forEach((child) => {
      scope.remove(child);
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      (mesh.material as THREE.Material | undefined)?.dispose();
    });
    const shaft = scopeShaftPolyline(path, pose, sMm).map(web);
    if (shaft.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(shaft, false, 'centripetal');
      const tube = new THREE.TubeGeometry(curve, Math.max(8, shaft.length * 3), 3.3, 12, false);
      scope.add(
        new THREE.Mesh(
          tube,
          new THREE.MeshPhysicalMaterial({
            color: '#20262c',
            roughness: 0.35,
            metalness: 0.3,
            clearcoat: 0.6,
          }),
        ),
      );
      // The esophagus lies behind the heart and great vessels in most views. A faint pass drawn
      // over the anatomy keeps the scope's course readable without hiding what covers it.
      const ghost = new THREE.Mesh(
        tube.clone(),
        new THREE.MeshBasicMaterial({
          color: '#ffd166',
          transparent: true,
          opacity: 0.24,
          depthTest: false,
          depthWrite: false,
        }),
      );
      ghost.renderOrder = ORDER.scope;
      scope.add(ghost);
    }
    const origin = web(pose.originLps),
      depth = web(pose.depthAxisLps),
      lateral = web(pose.lateralAxisLps);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(3.7, 20, 16),
      new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#8a6412', roughness: 0.35 }),
    );
    tip.position.copy(origin);
    scope.add(tip);

    // The sector carries the image's own layout in its texture coordinates, so the ultrasound
    // image can be laid on it exactly as it is displayed.
    const texel = 1024,
      layout = sectorGeometry(texel, texel, manifest.probe.sectorAngleDeg);
    const half = layout.halfAngle,
      segments = 40,
      positions = [origin.x, origin.y, origin.z],
      uvs = [layout.apexX / texel, 1 - layout.apexY / texel],
      outline = [origin.clone()],
      index: number[] = [];
    for (let step = 0; step <= segments; step++) {
      const angle = -half + (2 * half * step) / segments;
      const point = origin
        .clone()
        .addScaledVector(depth, Math.cos(angle) * depthMm)
        .addScaledVector(lateral, Math.sin(angle) * depthMm);
      positions.push(point.x, point.y, point.z);
      uvs.push(
        (layout.apexX + Math.sin(angle) * layout.radius) / texel,
        1 - (layout.apexY + Math.cos(angle) * layout.radius) / texel,
      );
      outline.push(point);
      if (step) index.push(0, step, step + 1);
    }
    const fanGeometry = new THREE.BufferGeometry();
    fanGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    fanGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    fanGeometry.setIndex(index);
    const imaged = cut && current.sectorTexture;
    const fan = new THREE.Mesh(
      fanGeometry,
      imaged
        ? // On the cut face the sector shows the live ultrasound image in place.
          new THREE.MeshBasicMaterial({
            map: current.sectorTexture,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.94,
            toneMapped: false,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -6,
            polygonOffsetUnits: -6,
          })
        : new THREE.MeshBasicMaterial({
            color: '#7fe3ff',
            transparent: true,
            opacity: 0.28,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: false,
          }),
    );
    fan.renderOrder = ORDER.fan;
    const edge = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(outline),
      new THREE.LineBasicMaterial({ color: '#c8f4ff', depthTest: false }),
    );
    edge.renderOrder = ORDER.fanEdge;
    scope.add(fan, edge);

    if (facingPlane) {
      // Look straight at the scan plane, oriented like the ultrasound image: transducer at the
      // top, proximal side on the right. The viewing distance the learner chose is kept.
      const center = origin.clone().addScaledVector(depth, depthMm * 0.5);
      const distance = current.camera.position.distanceTo(current.controls.target);
      setCameraUp(current, depth.clone().negate());
      current.controls.target.copy(center);
      current.camera.position.copy(center).addScaledVector(web(pose.planeNormalLps), distance);
      current.controls.update();
    } else if (live.current.follow) {
      // Carry the camera with the tip so the orbit stays centered on the scan.
      const shift = origin.clone().sub(current.controls.target);
      current.controls.target.add(shift);
      current.camera.position.add(shift);
      current.controls.update();
    }
    current.render();
  }, [path, pose, sMm, depthMm, manifest, cut, sectorCanvas, facingPlane]);

  // Each new ultrasound frame is uploaded to the sector while the cut is shown.
  useEffect(() => {
    const refresh = () => {
      const current = state.current;
      if (!current?.sectorTexture || !live.current.cut) return;
      current.sectorTexture.needsUpdate = true;
      current.render();
    };
    refresh();
    return subscribeFrames(refresh);
  }, [subscribeFrames, sectorCanvas, cut]);

  useEffect(() => {
    if (!namingEnabled) setPointed(null);
  }, [namingEnabled]);

  const setView = (preset: ViewPreset) => {
    const current = state.current;
    if (!current) return;
    const distance = current.camera.position.distanceTo(current.controls.target);
    setFacingPlane(false);
    setCameraUp(current, WORLD_UP);
    if (follow) current.controls.target.copy(web(pose.originLps));
    current.camera.position
      .copy(current.controls.target)
      .addScaledVector(VIEW_DIRECTIONS[preset].clone().normalize(), distance);
    current.controls.update();
    current.render();
  };

  /** Turn to face the scan plane and stay there; the scope effect does the framing. */
  const faceScanPlane = () => {
    const current = state.current;
    if (!current) return;
    const offset = current.camera.position.clone().sub(current.controls.target);
    // Come in close enough for the sector to fill the view the first time.
    const wanted = Math.max(130, depthMm * 3);
    if (offset.length() > wanted) offset.setLength(wanted);
    current.camera.position.copy(current.controls.target).add(offset);
    setFacingPlane(true);
  };

  const zoom = (factor: number) => {
    const current = state.current;
    if (!current) return;
    const offset = current.camera.position.clone().sub(current.controls.target);
    offset.multiplyScalar(THREE.MathUtils.clamp(factor, 0.2, 5));
    if (offset.length() < 60 || offset.length() > 2400) return;
    current.camera.position.copy(current.controls.target).add(offset);
    current.controls.update();
    current.render();
  };

  const pointedStructure = pointed ? state.current?.visuals.get(pointed.key)?.structure : undefined;

  return (
    <section className="eus-pane eus-anatomy-pane" aria-label="3D anatomy">
      <header className="eus-pane-header">
        <div>
          <span className="eus-eyebrow">3D anatomy</span>
          <h2>{cut ? 'Cut at the scan plane' : 'Scope and scan plane'}</h2>
        </div>
        <button
          className="eus-chip-button"
          type="button"
          aria-pressed={cut}
          onClick={() => setCut(!cut)}
        >
          Cut plane
        </button>
      </header>
      <div className="eus-anatomy-canvas" ref={host} data-status={status}>
        <div className="eus-segmented eus-anatomy-views" role="group" aria-label="Camera view">
          {(['anterior', 'left', 'posterior', 'right'] as ViewPreset[]).map((preset) => (
            <button key={preset} type="button" onClick={() => setView(preset)}>
              {preset[0].toUpperCase() + preset.slice(1)}
            </button>
          ))}
          <button type="button" aria-pressed={facingPlane} onClick={faceScanPlane}>
            Scan plane
          </button>
        </div>
        {status !== 'ready' && (
          <div className="eus-image-message" role="status">
            {status === 'error' ? 'The 3D anatomy could not be loaded.' : 'Loading the 3D anatomy…'}
          </div>
        )}
        {pointed && pointedStructure && (
          <EusHoverName
            left={pointed.left}
            top={pointed.top}
            boxWidth={host.current?.clientWidth ?? 0}
            boxHeight={host.current?.clientHeight ?? 0}
            label={pointedStructure.label}
            color={pointedStructure.color}
            kind={EUS_GROUP_NAMES[pointedStructure.group]}
            note={pointedStructure.note}
          />
        )}
        <div className="eus-anatomy-tools">
          <button type="button" aria-label="Zoom in" onClick={() => zoom(0.8)}>
            +
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => zoom(1.25)}>
            −
          </button>
        </div>
      </div>
      <p className="eus-pane-caption">
        {cut
          ? 'The anatomy on your side of the scan plane is removed, and the ultrasound image lies on the cut. “Scan plane” turns the view to match the image and keeps it there.'
          : `${namingEnabled ? 'Point at a structure to name it. ' : ''}Drag to orbit; click the model, then scroll to zoom.`}
      </p>
      <label className="eus-check">
        <input type="checkbox" checked={follow} onChange={(event) => setFollow(event.target.checked)} />
        Keep the scope tip centered
      </label>
      <fieldset className="eus-layer-grid">
        <legend>Show in 3D</legend>
        {(Object.keys(EUS_LAYER_LABELS) as Array<keyof EusLayerState>).map((key) => (
          <label className="eus-check" key={key}>
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={(event) => onLayers({ ...layers, [key]: event.target.checked })}
            />
            {EUS_LAYER_LABELS[key]}
          </label>
        ))}
      </fieldset>
    </section>
  );
}
