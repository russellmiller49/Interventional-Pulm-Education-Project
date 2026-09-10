import { useEffect, useRef } from 'react';
import * as THREE from 'three';

import {
  APERTURE_FEATHER,
  APERTURE_RADIUS,
  BARREL_K1,
  BARREL_K2,
  EDGE_BLUR_END_RADIUS,
  EDGE_BLUR_MAX_OFFSET_UV,
  EDGE_BLUR_START_RADIUS,
  HEADLIGHT_FLOOR,
  HEADLIGHT_INNER_CONE_DEG,
  HEADLIGHT_OUTER_CONE_DEG,
  WALL_SEE_THROUGH_ALPHA,
  approachInflation,
  distalTipScreenDirection,
  insideChannelEyeDistanceMm,
  proximityPullbackMm,
  resolveEndoscopeOptics,
  type SimulatorEndoscopeOptics,
} from './optics';
import {
  GLB_SCENE_TO_WEB_MM_MATRIX,
  cleanModelColor,
  cleanModelLayer,
  cleanModelStructureId,
  loadGlbModel,
  primaryCleanModel,
} from './AnatomyScene';
import {
  resolveCalibratedOpticalAxis,
  resolveEndoscopeCameraCalibration,
  resolveOpticalImageUp,
  resolveScopeFrame,
  type SimulatorProbePose,
  type SimulatorScopeFrame,
} from './pose';
import type {
  SimulatorCaseManifest,
  SimulatorEndoscopeCamera,
  SimulatorLayerState,
  SimulatorLoadedAssets,
  Vec3,
} from './types';

/**
 * A structure rendered behind the semi-transparent channel wall in see-through mode: a point
 * cloud with the same key/color the external anatomy view uses, tagged so target regions and
 * flow channels can be styled differently.
 */
export interface SimulatorBronchOverlayStructure {
  key: string;
  kind: 'station' | 'vessel';
  color: string;
  points: Vec3[];
}

/** Format a TS lens constant as a GLSL float literal. */
function glslFloat(value: number): string {
  return value.toFixed(6);
}

/**
 * Endoluminal mucosa material — pale-pink airway wall lit by a camera-mounted headlight that falls
 * off with distance, with submucosal vessels and a wet sheen. Drawn on the BackSide so the camera
 * sits inside the lumen. Mirrors the airway-anatomy module's bronchoscopy shader so the EBUS
 * simulator's virtual scope view matches the rest of the platform.
 *
 * When the calibration record enables `headlight_falloff`, the headlight additionally falls off
 * with angle from the optical axis (`uHeadlightAxis`), not just with distance from the camera, so
 * the lit spot follows the forward-oblique view direction. `uHeadlightFalloff` stays 0 otherwise
 * and the output is bit-identical to the flagless shader.
 */
function createBronchoscopyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uHeadlightAxis: { value: new THREE.Vector3(0, 0, -1) },
      uHeadlightFalloff: { value: 0 },
      uWallAlpha: { value: 1 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec3 vNormalWorld;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      varying vec3 vNormalWorld;

      uniform vec3 uHeadlightAxis;
      uniform float uHeadlightFalloff;
      uniform float uWallAlpha;

      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 n = normalize(vNormalWorld);
        if (dot(n, viewDir) < 0.0) {
          n = -n;
        }

        float dist = length(cameraPosition - vWorldPosition);
        float headlight = max(dot(n, viewDir), 0.0);
        float falloff = mix(0.95, 0.4, smoothstep(8.0, 70.0, dist));

        vec3 p = vWorldPosition * 0.13;
        float broadFold = 0.5 + 0.5 * sin(p.z * 5.5 + p.y * 2.2 + sin(p.x * 2.6) * 1.4);
        float fineFold = 0.5 + 0.5 * sin(p.x * 12.0 + p.y * 7.0 + p.z * 4.0);
        float speckle = hash(floor(vWorldPosition * 2.2));
        float mucosa = 0.76 + broadFold * 0.17 + fineFold * 0.05 + (speckle - 0.5) * 0.04;

        vec3 shadowTone = vec3(0.32, 0.10, 0.09);
        vec3 midTone = vec3(0.85, 0.45, 0.40);
        vec3 highTone = vec3(1.0, 0.80, 0.74);
        vec3 base = mix(shadowTone, midTone, clamp(mucosa, 0.0, 1.0));
        base = mix(base, highTone, pow(headlight, 2.4) * 0.30);

        float vesselA = sin(p.x * 9.0 + sin(p.z * 3.4) * 2.2 + p.y * 1.5);
        float vesselB = sin(p.y * 11.0 + sin(p.x * 4.1) * 1.9 - p.z * 2.0);
        float vessel = smoothstep(0.93, 0.99, max(vesselA, vesselB));
        base = mix(base, vec3(0.58, 0.13, 0.12), vessel * 0.28);

        float rimWet = pow(max(dot(reflect(-viewDir, n), viewDir), 0.0), 26.0);
        float sparkleGate = smoothstep(0.982, 1.0, hash(floor(vWorldPosition * 5.0)));
        float sparkle = sparkleGate * pow(headlight, 10.0) * 0.25;

        float exposure = 0.68 + headlight * 0.7;
        vec3 color = base * exposure * falloff;
        color += vec3(1.0, 0.93, 0.88) * (rimWet * 0.26 + sparkle);

        // Headlight cone around the optical axis (mirrors headlightConeGain in optics.ts).
        float coneGain = smoothstep(
          ${glslFloat(Math.cos(THREE.MathUtils.degToRad(HEADLIGHT_OUTER_CONE_DEG)))},
          ${glslFloat(Math.cos(THREE.MathUtils.degToRad(HEADLIGHT_INNER_CONE_DEG)))},
          dot(-viewDir, uHeadlightAxis)
        );
        color *= mix(1.0, mix(${glslFloat(HEADLIGHT_FLOOR)}, 1.0, coneGain), uHeadlightFalloff);

        float depthDarken = smoothstep(45.0, 100.0, dist);
        color = mix(color, vec3(0.06, 0.015, 0.012), depthDarken * 0.55);
        color = pow(max(color, vec3(0.0)), vec3(0.92));

        // See-through mode fades the wall so structures behind it stay readable; 1.0 otherwise.
        gl_FragColor = vec4(color, uWallAlpha);
      }
    `,
  });
}

// See-through structure points (fallback when the case ships no structure-mesh model): target
// regions read slightly larger than flow channels, and the active preset's target region is
// emphasized so trainees can spot what they are aiming at.
const OVERLAY_POINT_SIZE_STATION = 1.3;
const OVERLAY_POINT_SIZE_VESSEL = 1.0;
const OVERLAY_POINT_SIZE_FOCUS = 1.9;
const OVERLAY_POINT_OPACITY = 0.5;
const OVERLAY_POINT_OPACITY_FOCUS = 0.85;

// See-through structure meshes (preferred): the same structure-mesh model the external anatomy
// view renders, so flow channels read as coherent tubes rather than dot clouds.
const OVERLAY_MESH_OPACITY_BY_LAYER: Partial<Record<keyof SimulatorLayerState, number>> = {
  vessels: 0.5,
  heart: 0.3,
  stations: 0.35,
};
const OVERLAY_MESH_OPACITY_FOCUS = 0.85;

interface SeeThroughMeshEntry {
  structureId: string;
  layer: keyof SimulatorLayerState;
  material: THREE.MeshBasicMaterial;
}

/** Soft round sprite for the see-through structure points, so near points read as glowing dots
 * instead of hard screen-space squares. */
function createPointSpriteTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * Structures shown behind the semi-transparent wall in see-through mode, with the same colors the
 * external anatomy view uses so the two panes read consistently. Starts as point clouds (always
 * available) and upgrades in place to the case's structure-mesh model once it loads, so flow
 * channels read as coherent tubes. Hidden by default; the render loop toggles visibility and
 * moves the focus emphasis when the active preset changes.
 */
function createSeeThroughStructures(scene: THREE.Scene, structures: SimulatorBronchOverlayStructure[]) {
  const pointsGroup = new THREE.Group();
  pointsGroup.visible = false;
  scene.add(pointsGroup);

  let meshGroup: THREE.Group | null = null;
  let meshEntries: SeeThroughMeshEntry[] = [];
  let visible = false;
  let focusStationKey: string | null = null;

  const sprite = createPointSpriteTexture();
  const pointEntries = structures
    .filter((structure) => structure.points.length > 0)
    .map((structure) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(structure.points.flat(), 3),
      );
      const material = new THREE.PointsMaterial({
        color: structure.color,
        depthWrite: false,
        map: sprite,
        opacity: OVERLAY_POINT_OPACITY,
        size:
          structure.kind === 'station' ? OVERLAY_POINT_SIZE_STATION : OVERLAY_POINT_SIZE_VESSEL,
        transparent: true,
      });
      const points = new THREE.Points(geometry, material);
      // Draw before the transparent wall (renderOrder 2) so the wall tint reads over them.
      points.renderOrder = 1;
      pointsGroup.add(points);
      return { structure, geometry, material };
    });

  const applyVisibility = () => {
    pointsGroup.visible = visible && !meshGroup;
    if (meshGroup) {
      meshGroup.visible = visible;
    }
  };

  const applyFocus = () => {
    for (const { structure, material } of pointEntries) {
      const focused = structure.kind === 'station' && structure.key === focusStationKey;
      material.size = focused
        ? OVERLAY_POINT_SIZE_FOCUS
        : structure.kind === 'station'
          ? OVERLAY_POINT_SIZE_STATION
          : OVERLAY_POINT_SIZE_VESSEL;
      material.opacity = focused ? OVERLAY_POINT_OPACITY_FOCUS : OVERLAY_POINT_OPACITY;
    }
    for (const { structureId, layer, material } of meshEntries) {
      const focused = structureId === focusStationKey;
      material.opacity = focused
        ? OVERLAY_MESH_OPACITY_FOCUS
        : (OVERLAY_MESH_OPACITY_BY_LAYER[layer] ?? 0.35);
    }
  };

  return {
    setVisible(nextVisible: boolean) {
      visible = nextVisible;
      applyVisibility();
    },
    setFocus(nextFocusStationKey: string | null) {
      focusStationKey = nextFocusStationKey;
      applyFocus();
    },
    /** Swap the point-cloud fallback for the loaded structure-mesh model. */
    adoptCleanModel(model: THREE.Group, entries: SeeThroughMeshEntry[]) {
      meshGroup = model;
      meshEntries = entries;
      scene.add(model);
      applyVisibility();
      applyFocus();
    },
    dispose() {
      scene.remove(pointsGroup);
      sprite.dispose();
      for (const { geometry, material } of pointEntries) {
        geometry.dispose();
        material.dispose();
      }
      if (meshGroup) {
        // Geometry is shared with the cached model template; dispose only our materials.
        scene.remove(meshGroup);
        for (const { material } of meshEntries) {
          material.dispose();
        }
      }
    },
  };
}

/**
 * Load the case's structure-mesh model (the one the external anatomy view renders) and hand its
 * target-region, flow-channel, and heart meshes to the see-through overlay. The channel wall and
 * context structures stay hidden — the optical pane draws its own lumen. Resolves quietly to the
 * point-cloud fallback on load failure.
 */
function upgradeSeeThroughToCleanModel(
  overlay: ReturnType<typeof createSeeThroughStructures>,
  caseData: SimulatorCaseManifest,
  isCancelled: () => boolean,
) {
  const cleanModel = primaryCleanModel(caseData);

  if (!cleanModel) {
    return;
  }

  loadGlbModel(cleanModel)
    .then((template) => {
      if (isCancelled()) {
        return;
      }

      const model = template.clone(true);
      model.name = `bronch-see-through:${cleanModel.key}`;
      model.applyMatrix4(GLB_SCENE_TO_WEB_MM_MATRIX);
      const entries: SeeThroughMeshEntry[] = [];
      model.traverse((object) => {
        const mesh = object as THREE.Mesh;

        if (!mesh.isMesh) {
          return;
        }

        const structureId = cleanModelStructureId(mesh.name || mesh.parent?.name || '');
        const layer = cleanModelLayer(structureId);

        if (layer === 'airway' || layer === 'context') {
          mesh.visible = false;
          return;
        }

        const material = new THREE.MeshBasicMaterial({
          color: cleanModelColor(structureId, caseData.color_map),
          depthWrite: false,
          opacity: OVERLAY_MESH_OPACITY_BY_LAYER[layer] ?? 0.35,
          side: THREE.DoubleSide,
          transparent: true,
        });
        mesh.userData.sharedAssetGeometry = true;
        mesh.material = material;
        mesh.renderOrder = 1;
        entries.push({ structureId, layer, material });
      });
      overlay.adoptCleanModel(model, entries);
    })
    .catch(() => {
      // Structure-mesh model unavailable — the point-cloud fallback stays active.
    });
}

const DEBUG_AXIS_LENGTH_MM = 20;

/**
 * ?bronchDebug=1 overlay: three colored lines from the scope position — shaft axis (blue), optical
 * axis (yellow), scan-side depth axis (red). Only constructed when the flag is set, so it stays out
 * of the normal render path.
 */
function createBronchDebugAxes(scene: THREE.Scene) {
  const lines = ['#4dc3ff', '#ffd24d', '#ff5d5d'].map((color) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, depthTest: false }));
    line.renderOrder = 10;
    line.frustumCulled = false;
    scene.add(line);
    return line;
  });

  const setLine = (line: THREE.Line, origin: THREE.Vector3, direction: THREE.Vector3) => {
    const attribute = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    const tip = origin.clone().add(direction.clone().multiplyScalar(DEBUG_AXIS_LENGTH_MM));
    attribute.setXYZ(0, origin.x, origin.y, origin.z);
    attribute.setXYZ(1, tip.x, tip.y, tip.z);
    attribute.needsUpdate = true;
  };

  return {
    update(frame: SimulatorScopeFrame, opticalAxis: THREE.Vector3) {
      setLine(lines[0], frame.position, frame.shaftAxis);
      setLine(lines[1], frame.position, opticalAxis);
      setLine(lines[2], frame.position, frame.depthAxis);
    },
    dispose() {
      for (const line of lines) {
        scene.remove(line);
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
    },
  };
}

// Distal-tip overlay layout, expressed at a fixed depth in front of the lens. Vertical extents are
// fractions of the view half-height there (so the silhouette covers the same frame fraction at any
// FOV); widths are fractions of the view half-width so the domes span the frame at any aspect.
const TIP_OVERLAY_DISTANCE_MM = 2.5;
// Transducer housing: a wide, shallow dark dome nosing in from the bottom edge (reaches ~18% up
// the frame), matching how little of the tip is visible on reference stills when the distal
// contact cap is deflated.
const TIP_OCCLUDER_WIDTH_FRACTION = 1.45;
const TIP_OCCLUDER_HEIGHT_FRACTION = 0.62;
const TIP_OCCLUDER_EDGE_FRACTION = 1.26;
// Inflated distal contact cap: a circular-silhouette membrane dome anchored below the frame, so
// its rim reads as one uniform arch across the bottom of the visual field at any pane aspect.
// With the aperture at radius ~0.98 (half-height units), a radius-1.4 dome centered 1.85 below
// the frame center crests at -0.45 and meets the field stop near its lower quarters.
const CONTACT_CAP_RADIUS_FRACTION = 1.4;
const CONTACT_CAP_CENTER_FRACTION = 1.85;

const TIP_OVERLAY_VERTEX_SHADER = `
  varying vec3 vNormalView;
  varying vec3 vPositionView;

  void main() {
    vNormalView = normalize(normalMatrix * normal);
    vec4 positionView = modelViewMatrix * vec4(position, 1.0);
    vPositionView = positionView.xyz;
    gl_Position = projectionMatrix * positionView;
  }
`;

/** Dark rounded transducer housing catching the headlight along its silhouette. */
function createTipHousingMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    vertexShader: TIP_OVERLAY_VERTEX_SHADER,
    fragmentShader: `
      varying vec3 vNormalView;
      varying vec3 vPositionView;

      void main() {
        vec3 n = normalize(vNormalView);
        vec3 v = normalize(-vPositionView);
        float rim = pow(1.0 - abs(dot(n, v)), 2.4);
        vec3 base = vec3(0.085, 0.055, 0.045);
        vec3 color = base + vec3(1.0, 0.82, 0.72) * rim * 0.34;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

/** Saline-filled membrane: an opaque milky-white dome that occludes the channel behind it, with a
 * bright silhouette rim and gentle top light so it still reads as curved. */
function createContactCapMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexShader: TIP_OVERLAY_VERTEX_SHADER,
    fragmentShader: `
      varying vec3 vNormalView;
      varying vec3 vPositionView;

      void main() {
        vec3 n = normalize(vNormalView);
        vec3 v = normalize(-vPositionView);
        float rim = pow(1.0 - abs(dot(n, v)), 2.4);
        // View-space up-facing normals catch the headlight, shading the dome's crest.
        float topLight = clamp(n.y, 0.0, 1.0);
        vec3 base = vec3(0.90, 0.92, 0.94);
        vec3 color = base * (0.8 + 0.14 * topLight) + vec3(1.0) * rim * 0.3;
        gl_FragColor = vec4(color, 0.985);
      }
    `,
  });
}

/**
 * Simplified distal-tip overlay: instead of loading the full scope model AnatomyScene poses, a
 * dark rounded housing dome (plus an optional translucent distal contact cap) rides the camera at
 * the bottom of the frame — the transducer sits distal to the lens along the shaft, and the lens
 * tilts away from it toward the scan side, so the hardware intrudes from the image bottom. Drawn
 * without depth testing so the silhouette stays in front of the channel wall even in near contact.
 */
function createDistalTipOverlay(
  camera: THREE.PerspectiveCamera,
  calibration: SimulatorEndoscopeCamera,
  optics: SimulatorEndoscopeOptics,
) {
  const group = new THREE.Group();
  group.position.set(0, 0, -TIP_OVERLAY_DISTANCE_MM);
  camera.add(group);

  const [edgeX, edgeY] = distalTipScreenDirection(calibration);
  const halfHeightMm =
    TIP_OVERLAY_DISTANCE_MM * Math.tan(THREE.MathUtils.degToRad(calibration.fov_deg / 2));
  const meshes: THREE.Mesh[] = [];

  const addDome = (material: THREE.ShaderMaterial, renderOrder: number) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), material);
    mesh.renderOrder = renderOrder;
    mesh.frustumCulled = false;
    group.add(mesh);
    meshes.push(mesh);
    return mesh;
  };

  const occluder = optics.scopeTipOcclusion ? addDome(createTipHousingMaterial(), 8) : null;
  const cap = optics.contactCap ? addDome(createContactCapMaterial(), 9) : null;

  // The cap dome is anchored below the frame edge, so scaling it by the inflation state makes it
  // rise into the frame as it fills and sink away as it empties (deflated during navigation,
  // inflated at station contact).
  let capInflation = 0;
  const capBaseScale = new THREE.Vector3(1, 1, 1);

  const applyCapInflation = () => {
    if (!cap) {
      return;
    }
    cap.visible = capInflation > 0.02;
    cap.scale.copy(capBaseScale).multiplyScalar(Math.max(capInflation, 0.001));
  };

  const layoutDome = (
    mesh: THREE.Mesh,
    aspect: number,
    widthFraction: number,
    heightFraction: number,
    edgeFraction: number,
  ) => {
    const halfWidthMm = halfHeightMm * aspect;
    const verticalMm = halfHeightMm * heightFraction;
    mesh.scale.set(halfWidthMm * widthFraction, verticalMm, verticalMm * 0.6);
    mesh.position.set(
      edgeX * halfWidthMm * edgeFraction,
      edgeY * halfHeightMm * edgeFraction,
      0,
    );
  };

  return {
    layout(aspect: number) {
      if (occluder) {
        layoutDome(
          occluder,
          aspect,
          TIP_OCCLUDER_WIDTH_FRACTION,
          TIP_OCCLUDER_HEIGHT_FRACTION,
          TIP_OCCLUDER_EDGE_FRACTION,
        );
      }
      if (cap) {
        // Circular silhouette (x and y scales equal), independent of the pane aspect, so the
        // membrane rim arches uniformly across the bottom of the field.
        const radiusMm = halfHeightMm * CONTACT_CAP_RADIUS_FRACTION;
        cap.scale.set(radiusMm, radiusMm, radiusMm * 0.45);
        cap.position.set(
          edgeX * halfHeightMm * CONTACT_CAP_CENTER_FRACTION,
          edgeY * halfHeightMm * CONTACT_CAP_CENTER_FRACTION,
          0,
        );
        capBaseScale.copy(cap.scale);
        applyCapInflation();
      }
    },
    setCapInflation(value: number) {
      if (value !== capInflation) {
        capInflation = value;
        applyCapInflation();
      }
    },
    dispose() {
      camera.remove(group);
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    },
  };
}

/**
 * Render-to-texture lens pass for the circular aperture mask and the mild barrel distortion /
 * radial edge blur. Only constructed when at least one of the two flags is enabled, so flagless
 * cases keep rendering straight to the canvas. The GLSL mirrors the pure helpers in optics.ts
 * (apertureMaskAlpha, barrelDistortUv) with the shared constants injected from TS.
 */
function createLensPostPipeline(
  renderer: THREE.WebGLRenderer,
  optics: SimulatorEndoscopeOptics,
  width: number,
  height: number,
) {
  const pixelRatio = renderer.getPixelRatio();
  const renderTarget = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio);
  const postScene = new THREE.Scene();
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: renderTarget.texture },
      uAspect: { value: width / height },
      uApertureEnabled: { value: optics.circularAperture ? 1 : 0 },
      uDistortionEnabled: { value: optics.lensDistortion ? 1 : 0 },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;

      uniform sampler2D tDiffuse;
      uniform float uAspect;
      uniform float uApertureEnabled;
      uniform float uDistortionEnabled;

      // Mirrors barrelDistortUv in optics.ts.
      vec2 distortUv(vec2 uv) {
        vec2 p = uv * 2.0 - 1.0;
        float r2 = dot(p, p);
        p *= 1.0 + ${glslFloat(BARREL_K1)} * r2 + ${glslFloat(BARREL_K2)} * r2 * r2;
        return p * 0.5 + 0.5;
      }

      void main() {
        vec2 sourceUv = mix(vUv, distortUv(vUv), uDistortionEnabled);
        vec3 color = texture2D(tDiffuse, clamp(sourceUv, 0.0, 1.0)).rgb;

        // Radius in image-height units, as in apertureMaskAlpha.
        float radius = length((vUv * 2.0 - 1.0) * vec2(uAspect, 1.0));

        float blurOffset = smoothstep(
          ${glslFloat(EDGE_BLUR_START_RADIUS)},
          ${glslFloat(EDGE_BLUR_END_RADIUS)},
          radius
        ) * ${glslFloat(EDGE_BLUR_MAX_OFFSET_UV)} * uDistortionEnabled;
        if (blurOffset > 0.0001) {
          vec3 blurred = color;
          blurred += texture2D(tDiffuse, clamp(sourceUv + vec2(blurOffset, blurOffset), 0.0, 1.0)).rgb;
          blurred += texture2D(tDiffuse, clamp(sourceUv + vec2(-blurOffset, blurOffset), 0.0, 1.0)).rgb;
          blurred += texture2D(tDiffuse, clamp(sourceUv + vec2(blurOffset, -blurOffset), 0.0, 1.0)).rgb;
          blurred += texture2D(tDiffuse, clamp(sourceUv + vec2(-blurOffset, -blurOffset), 0.0, 1.0)).rgb;
          color = blurred / 5.0;
        }

        float aperture = 1.0 - smoothstep(
          ${glslFloat(APERTURE_RADIUS - APERTURE_FEATHER)},
          ${glslFloat(APERTURE_RADIUS)},
          radius
        );
        color *= mix(1.0, aperture, uApertureEnabled);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  postScene.add(quad);

  return {
    render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
    },
    setSize(nextWidth: number, nextHeight: number) {
      const nextPixelRatio = renderer.getPixelRatio();
      renderTarget.setSize(nextWidth * nextPixelRatio, nextHeight * nextPixelRatio);
      material.uniforms.uAspect.value = nextWidth / nextHeight;
    },
    dispose() {
      renderTarget.dispose();
      quad.geometry.dispose();
      material.dispose();
    },
  };
}

// The proximity ray starts this far behind the desired camera position so a wall the camera has
// already reached (distance ahead <= 0) is still detected.
const PROXIMITY_RAY_BACKOFF_MM = 3;

/**
 * First-person virtual bronchoscopy from the EBUS scope tip. The airway lumen is built once from the
 * shared mesh (same web-mm space as the centerline/pose); the camera is re-aimed from the live probe
 * pose every frame, so advancing/retracting and roll on the control rail drive the endoluminal view
 * in lockstep with the external anatomy and EBUS sector panes.
 */
export function BronchoscopyView({
  pose,
  assets,
  camera: cameraRecord,
  seeThroughWall = false,
  structures,
  focusStationKey = null,
  balloonInflated = false,
  caseData,
}: {
  pose: SimulatorProbePose;
  assets: SimulatorLoadedAssets;
  camera?: SimulatorEndoscopeCamera;
  /** Fade the channel wall and reveal the structures behind it (teaching aid). */
  seeThroughWall?: boolean;
  /** Structures shown behind the wall in see-through mode. Stable identity per case. */
  structures?: SimulatorBronchOverlayStructure[];
  /** Station key of the active preset, emphasized among the see-through structures. */
  focusStationKey?: string | null;
  /** Manual distal contact cap control: eased toward inflated while true. */
  balloonInflated?: boolean;
  /** Case manifest; provides the structure-mesh model for see-through mode when present. */
  caseData?: SimulatorCaseManifest;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const poseRef = useRef(pose);
  poseRef.current = pose;
  const seeThroughRef = useRef(seeThroughWall);
  seeThroughRef.current = seeThroughWall;
  const focusStationRef = useRef(focusStationKey);
  focusStationRef.current = focusStationKey;
  const balloonRef = useRef(balloonInflated);
  balloonRef.current = balloonInflated;

  useEffect(() => {
    const container = containerRef.current;
    // The manifest's device-calibration record drives the optics; absent fields fall back to the
    // default profile so manifests that predate the record keep working.
    const calibration = resolveEndoscopeCameraCalibration(cameraRecord);

    if (!container) {
      return;
    }

    const width = container.clientWidth || 480;
    const height = container.clientHeight || 360;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor('#070303', 1);
    container.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight('#ffd9c0', 0.5));

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(assets.airway.vertices.flat(), 3),
    );
    geometry.setIndex(assets.airway.triangles.flat());
    geometry.computeVertexNormals();
    const material = createBronchoscopyMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    // Above the see-through structure points (renderOrder 1) so the faded wall tints them.
    mesh.renderOrder = 2;
    scene.add(mesh);

    const seeThroughStructures =
      structures?.length || (caseData && primaryCleanModel(caseData))
        ? createSeeThroughStructures(scene, structures ?? [])
        : null;
    let seeThroughUpgradeCancelled = false;
    if (seeThroughStructures && caseData) {
      upgradeSeeThroughToCleanModel(
        seeThroughStructures,
        caseData,
        () => seeThroughUpgradeCancelled,
      );
    }

    const camera = new THREE.PerspectiveCamera(
      calibration.fov_deg,
      width / height,
      calibration.near_mm,
      calibration.far_mm,
    );

    // Lens realism, each behind its calibration flag; flagless records skip all of it and render
    // exactly as before.
    const optics = resolveEndoscopeOptics(calibration);
    const tipOverlay =
      optics.scopeTipOcclusion || optics.contactCap
        ? createDistalTipOverlay(camera, calibration, optics)
        : null;
    if (tipOverlay) {
      // Camera-attached meshes only render when the camera itself is part of the scene graph.
      scene.add(camera);
      tipOverlay.layout(width / height);
    }
    const lensPipeline =
      optics.circularAperture || optics.lensDistortion
        ? createLensPostPipeline(renderer, optics, width, height)
        : null;
    if (optics.headlightFalloff) {
      material.uniforms.uHeadlightFalloff.value = 1;
    }

    // Inside-lumen clamp: the probe pose rides pressed against the channel wall (the station's
    // radial contact offset applies along the whole centerline), so on bends the raw eye position
    // can cross the wall — and the lumen is drawn BackSide-only, so an outside camera sees nothing.
    // Cast from the pose's centerline anchor (always inside the channel) toward the desired eye
    // and clamp the eye to the calibrated clearance inside the first wall hit. Re-cast only when
    // the pose moves, like the forward-proximity clamp below.
    const insideRaycaster = optics.contactMinDistanceMm > 0 ? new THREE.Raycaster() : null;
    const insideRayDirection = new THREE.Vector3();
    const lastInsideAnchor = new THREE.Vector3();
    const lastInsideDesiredEye = new THREE.Vector3();
    let hasInsideSample = false;
    let insideClampedDistance = Infinity;

    const clampEyeInsideChannel = (anchor: THREE.Vector3 | undefined) => {
      if (!insideRaycaster || !anchor) {
        return;
      }

      const moved =
        !hasInsideSample ||
        lastInsideAnchor.distanceToSquared(anchor) > 1e-6 ||
        lastInsideDesiredEye.distanceToSquared(camera.position) > 1e-6;

      if (moved) {
        lastInsideAnchor.copy(anchor);
        lastInsideDesiredEye.copy(camera.position);
        hasInsideSample = true;
        insideRayDirection.copy(camera.position).sub(anchor);
        const desiredDistance = insideRayDirection.length();

        if (desiredDistance < 1e-4) {
          insideClampedDistance = Infinity;
        } else {
          insideRayDirection.multiplyScalar(1 / desiredDistance);
          insideRaycaster.set(anchor, insideRayDirection);
          insideRaycaster.far = desiredDistance + optics.contactMinDistanceMm;
          const hit = insideRaycaster.intersectObject(mesh, false)[0];
          insideClampedDistance = insideChannelEyeDistanceMm(
            hit ? hit.distance : null,
            desiredDistance,
            optics.contactMinDistanceMm,
          );
        }
      }

      if (Number.isFinite(insideClampedDistance)) {
        camera.position.copy(anchor).addScaledVector(insideRayDirection, insideClampedDistance);
      }
    };

    // Native three.js raycast against the channel mesh (~28k triangles — no BVH needed at one ray
    // per frame), re-cast only when the pose moves so an idle view costs nothing.
    const proximityRaycaster = optics.contactMinDistanceMm > 0 ? new THREE.Raycaster() : null;
    const proximityRayOrigin = new THREE.Vector3();
    const lastProximityPosition = new THREE.Vector3();
    const lastProximityForward = new THREE.Vector3();
    let hasProximitySample = false;
    let proximityPullback = 0;

    const clampCameraToChannel = (forward: THREE.Vector3) => {
      if (!proximityRaycaster) {
        return;
      }

      const moved =
        !hasProximitySample ||
        lastProximityPosition.distanceToSquared(camera.position) > 1e-6 ||
        lastProximityForward.distanceToSquared(forward) > 1e-8;

      if (moved) {
        lastProximityPosition.copy(camera.position);
        lastProximityForward.copy(forward);
        hasProximitySample = true;
        proximityRayOrigin.copy(camera.position).addScaledVector(forward, -PROXIMITY_RAY_BACKOFF_MM);
        proximityRaycaster.set(proximityRayOrigin, forward);
        proximityRaycaster.far = PROXIMITY_RAY_BACKOFF_MM + optics.contactMinDistanceMm;
        const hit = proximityRaycaster.intersectObject(mesh, false)[0];
        proximityPullback = proximityPullbackMm(
          hit ? hit.distance - PROXIMITY_RAY_BACKOFF_MM : null,
          optics.contactMinDistanceMm,
        );
      }

      camera.position.addScaledVector(forward, -proximityPullback);
    };

    // Size sync shared by the ResizeObserver and the render loop. The loop check makes pane
    // promotions/demotions in the focus layout take effect on the next frame even when observer
    // delivery lags the grid reflow — a stale canvas otherwise crops inside the smaller slot.
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
      tipOverlay?.layout(camera.aspect);
      lensPipeline?.setSize(nextWidth, nextHeight);
    };

    const target = new THREE.Vector3();
    const bronchDebugEnabled =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('bronchDebug') === '1';
    const debugAxes = bronchDebugEnabled ? createBronchDebugAxes(scene) : null;

    // Per-frame view state, re-applied only when it changes: wall opacity (see-through mode),
    // the emphasized target region, and the contact cap's eased inflation.
    let appliedSeeThrough: boolean | null = null;
    let appliedFocusStation: string | null | undefined;
    let capInflation = 0;
    let lastFrameMs: number | null = null;

    let frameId = 0;
    const render = () => {
      applyViewSize(container.clientWidth, container.clientHeight);
      const probe = poseRef.current;

      const seeThrough = seeThroughRef.current;
      if (seeThrough !== appliedSeeThrough) {
        appliedSeeThrough = seeThrough;
        material.transparent = seeThrough;
        material.depthWrite = !seeThrough;
        material.uniforms.uWallAlpha.value = seeThrough ? WALL_SEE_THROUGH_ALPHA : 1;
        seeThroughStructures?.setVisible(seeThrough);
      }
      if (focusStationRef.current !== appliedFocusStation) {
        appliedFocusStation = focusStationRef.current;
        seeThroughStructures?.setFocus(appliedFocusStation ?? null);
      }

      const nowMs = performance.now();
      const dtMs = lastFrameMs === null ? 0 : nowMs - lastFrameMs;
      lastFrameMs = nowMs;
      if (tipOverlay) {
        capInflation = approachInflation(capInflation, balloonRef.current ? 1 : 0, dtMs);
        tipOverlay.setCapInflation(capInflation);
      }
      // Forward-oblique optics: the view direction is the shaft axis rotated toward the scan side,
      // and the camera rides the scope frame so roll on the control rail rolls the image with it.
      const frame = resolveScopeFrame(probe);
      const forward = resolveCalibratedOpticalAxis(frame, calibration);

      camera.position
        .copy(frame.position)
        .add(frame.shaftAxis.clone().multiplyScalar(calibration.eye_offset_mm.shaft))
        .add(frame.depthAxis.clone().multiplyScalar(calibration.eye_offset_mm.depth))
        .add(frame.lateralAxis.clone().multiplyScalar(calibration.eye_offset_mm.lateral));
      clampEyeInsideChannel(probe.centerlinePosition);
      clampCameraToChannel(forward);
      // Image-up faces the calibrated scan side, so the distal hardware (and anything touched by
      // the transducer) reads at the bottom of the frame, as on the reference device.
      camera.up.copy(resolveOpticalImageUp(frame, calibration));
      camera.lookAt(target.copy(camera.position).add(forward));

      (material.uniforms.uHeadlightAxis.value as THREE.Vector3).copy(forward);

      debugAxes?.update(frame, forward);

      if (lensPipeline) {
        lensPipeline.render(scene, camera);
      } else {
        renderer.render(scene, camera);
      }
      frameId = window.requestAnimationFrame(render);
    };
    render();

    const resizeObserver = new ResizeObserver(() => {
      applyViewSize(container.clientWidth, container.clientHeight);
    });
    resizeObserver.observe(container);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      seeThroughUpgradeCancelled = true;
      debugAxes?.dispose();
      tipOverlay?.dispose();
      lensPipeline?.dispose();
      seeThroughStructures?.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [assets, cameraRecord, structures, caseData]);

  return <div className="simulator-bronch-canvas" ref={containerRef} />;
}
