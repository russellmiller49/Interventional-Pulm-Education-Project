import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { patientToEbusWeb } from '@bronchoscopy-core/devices';
import type { Point3 } from '@bronchoscopy-core/frame';

import { EUS_LAYER_LABELS, isLayerGroup } from './content';
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

/** Opacity per structure group; hollow or enclosing structures are see-through. */
function structureOpacity(structure: EusStructure) {
  if (structure.key === 'liver') return 0.4;
  switch (structure.group) {
    case 'gi':
      return 0.34;
    case 'airway':
      return 0.3;
    case 'bone':
      return 0.42;
    case 'heart':
      return 0.82;
    case 'organ':
      return 0.86;
    default:
      return 1;
  }
}

const web = (point: Point3) => new THREE.Vector3(...patientToEbusWeb(point));

interface EusAnatomySceneProps {
  manifest: EusCaseManifest;
  path: EusScopePath;
  pose: EusPose;
  sMm: number;
  depthMm: number;
  layers: EusLayerState;
  onLayers: (layers: EusLayerState) => void;
  activeStructure: string | null;
}

interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  anatomy: THREE.Group;
  scope: THREE.Group;
  meshes: Map<string, THREE.Mesh>;
  render: () => void;
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
}: EusAnatomySceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<SceneState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [follow, setFollow] = useState(true);
  const followRef = useRef(follow);
  followRef.current = follow;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 5, 6000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x28323a, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    camera.add(key);
    key.position.set(-0.4, 0.6, 1);
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
    const release = () => engage(false);
    const onOutside = (event: PointerEvent) => {
      if (!element.contains(event.target as Node)) engage(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') engage(false);
    };
    canvasElement.addEventListener('pointerdown', onPointerDown);
    canvasElement.addEventListener('pointerup', onPointerUp);
    canvasElement.addEventListener('mouseleave', release);
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKey);
    const anatomy = new THREE.Group(),
      scope = new THREE.Group();
    scene.add(anatomy, scope);

    let queued = 0;
    const render = () => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        renderer.render(scene, camera);
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
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);

    const center = new THREE.Vector3(...manifest.bounds.min)
      .add(new THREE.Vector3(...manifest.bounds.max))
      .multiplyScalar(0.5);
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(VIEW_DIRECTIONS.anterior.clone().normalize(), 620);
    controls.update();

    const meshes = new Map<string, THREE.Mesh>();
    state.current = { renderer, scene, camera, controls, anatomy, scope, meshes, render };
    resize();

    let disposed = false;
    const structures = new Map(manifest.structures.map((structure) => [structure.key, structure]));
    new GLTFLoader()
      .loadAsync(eusCaseAssetUrl(manifest.assets.model.asset))
      .then((gltf) => {
        if (disposed) return;
        gltf.scene.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          const structure = structures.get(mesh.name) ?? structures.get(mesh.parent?.name ?? '');
          if (!structure) return;
          mesh.geometry.computeVertexNormals();
          const opacity = structureOpacity(structure);
          mesh.material = new THREE.MeshStandardMaterial({
            color: structure.color,
            roughness: 0.62,
            metalness: 0.02,
            transparent: opacity < 1,
            opacity,
            depthWrite: opacity >= 0.8,
            side: THREE.DoubleSide,
          });
          mesh.renderOrder = opacity < 0.8 ? 2 : 1;
          mesh.userData.structure = structure;
          meshes.set(structure.key, mesh);
        });
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
      renderer.dispose();
      renderer.domElement.remove();
      state.current = null;
    };
  }, [manifest]);

  // Layer visibility and the highlighted structure.
  useEffect(() => {
    const current = state.current;
    if (!current) return;
    current.meshes.forEach((mesh, key) => {
      const structure = mesh.userData.structure as EusStructure;
      mesh.visible = !isLayerGroup(structure.group) || layers[structure.group];
      const material = mesh.material as THREE.MeshStandardMaterial;
      const active = key === activeStructure;
      material.emissive.set(active ? '#ffe08a' : '#000000');
      material.emissiveIntensity = active ? 0.55 : 0;
    });
    current.render();
  }, [layers, activeStructure, status]);

  // Scope shaft, transducer and ultrasound fan.
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
      const tube = new THREE.TubeGeometry(curve, Math.max(8, shaft.length * 3), 3.3, 10, false);
      scope.add(
        new THREE.Mesh(
          tube,
          new THREE.MeshStandardMaterial({ color: '#2b3138', roughness: 0.45, metalness: 0.25 }),
        ),
      );
      // The esophagus lies behind the heart and great vessels in most views. A faint pass drawn
      // over the anatomy keeps the scope's course readable without hiding what covers it.
      const ghost = new THREE.Mesh(
        tube.clone(),
        new THREE.MeshBasicMaterial({
          color: '#ffd166',
          transparent: true,
          opacity: 0.26,
          depthTest: false,
          depthWrite: false,
        }),
      );
      ghost.renderOrder = 4;
      scope.add(ghost);
    }
    const origin = web(pose.originLps),
      depth = web(pose.depthAxisLps),
      lateral = web(pose.lateralAxisLps);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(3.6, 18, 14),
      new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#7a5a12', roughness: 0.4 }),
    );
    tip.position.copy(origin);
    scope.add(tip);

    const half = (manifest.probe.sectorAngleDeg * Math.PI) / 360,
      segments = 28,
      positions = [origin.x, origin.y, origin.z],
      outline = [origin.clone()],
      index: number[] = [];
    for (let step = 0; step <= segments; step++) {
      const angle = -half + (2 * half * step) / segments;
      const point = origin
        .clone()
        .addScaledVector(depth, Math.cos(angle) * depthMm)
        .addScaledVector(lateral, Math.sin(angle) * depthMm);
      positions.push(point.x, point.y, point.z);
      outline.push(point);
      if (step) index.push(0, step, step + 1);
    }
    const fanGeometry = new THREE.BufferGeometry();
    fanGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    fanGeometry.setIndex(index);
    const fan = new THREE.Mesh(
      fanGeometry,
      new THREE.MeshBasicMaterial({
        color: '#7fe3ff',
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
      }),
    );
    fan.renderOrder = 5;
    const edge = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(outline),
      new THREE.LineBasicMaterial({ color: '#c8f4ff', depthTest: false }),
    );
    edge.renderOrder = 6;
    scope.add(fan, edge);

    if (followRef.current) {
      // Carry the camera with the tip so the orbit stays centered on the scan.
      const shift = origin.clone().sub(current.controls.target);
      current.controls.target.add(shift);
      current.camera.position.add(shift);
      current.controls.update();
    }
    current.render();
  }, [path, pose, sMm, depthMm, manifest]);

  const setView = (preset: ViewPreset) => {
    const current = state.current;
    if (!current) return;
    const distance = current.camera.position.distanceTo(current.controls.target);
    current.camera.position
      .copy(current.controls.target)
      .addScaledVector(VIEW_DIRECTIONS[preset].clone().normalize(), distance);
    current.camera.up.set(0, 1, 0);
    current.controls.update();
    current.render();
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

  return (
    <section className="eus-pane eus-anatomy-pane" aria-label="3D anatomy">
      <header className="eus-pane-header">
        <div>
          <span className="eus-eyebrow">3D anatomy</span>
          <h2>Scope and scan plane</h2>
        </div>
        <div className="eus-segmented" role="group" aria-label="Camera view">
          {(['anterior', 'left', 'posterior', 'right'] as ViewPreset[]).map((preset) => (
            <button key={preset} type="button" onClick={() => setView(preset)}>
              {preset[0].toUpperCase() + preset.slice(1)}
            </button>
          ))}
        </div>
      </header>
      <div className="eus-anatomy-canvas" ref={host} data-status={status}>
        {status !== 'ready' && (
          <div className="eus-image-message" role="status">
            {status === 'error' ? 'The 3D anatomy could not be loaded.' : 'Loading the 3D anatomy…'}
          </div>
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
      <div className="eus-anatomy-footer">
        <label className="eus-check">
          <input type="checkbox" checked={follow} onChange={(event) => setFollow(event.target.checked)} />
          Keep the scope tip centered
        </label>
        <span className="eus-muted">Drag to orbit. Click the model, then scroll to zoom.</span>
      </div>
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
