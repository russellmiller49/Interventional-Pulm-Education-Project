import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { patientToEbusWeb } from '@bronchoscopy-core/devices';
import type { Point3 } from '@bronchoscopy-core/frame';

import {
  APERTURE_FEATHER,
  APERTURE_RADIUS,
  BARREL_K1,
  BARREL_K2,
  EDGE_BLUR_END_RADIUS,
  EDGE_BLUR_MAX_OFFSET_UV,
  EDGE_BLUR_START_RADIUS,
} from '../simulator/optics';
import {
  clearLensDistanceMm,
  computeEusEndoscopeCamera,
  EUS_ENDOSCOPE_CLEARANCE_MM,
  EUS_ENDOSCOPE_FOV_DEG,
} from './eusEndoscope';
import type { EusPose } from './eusPose';
import { eusCaseAssetUrl } from './paths';
import type { EusCaseManifest, EusScopePath } from './types';

const web = (point: Point3) => new THREE.Vector3(...patientToEbusWeb(point));
const glsl = (value: number) => value.toFixed(6);

const MUCOSA_VERTEX = `
varying vec3 vWorldPosition;
varying vec3 vNormalWorld;
varying float vRegion;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  vNormalWorld = normalize(mat3(modelMatrix) * normal);
  vRegion = uv.x;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

/**
 * Upper gastrointestinal mucosa, after the airway mucosa shader the EBUS simulator uses
 * (src/lib/bronchoscopy-core/mucosa.ts): a headlight on the lens, distance falloff and a wet
 * sheen. This one adds what the esophagus and stomach need: pale squamous mucosa that gives way
 * to redder gastric mucosa across an irregular junction line, and folds that run along the organ.
 * The colors and folds are authored for recognition. They are not taken from this patient.
 */
const MUCOSA_FRAGMENT = `
varying vec3 vWorldPosition;
varying vec3 vNormalWorld;
varying float vRegion;
uniform vec3 uHeadlightAxis;
uniform vec3 uEsophagusAxis;
uniform vec3 uStomachAxis;
float hash3(vec3 p) {
  p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float tissueNoise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),
                 mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),
                 mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float ridges(vec3 p) { return 1.0 - abs(2.0 * tissueNoise(p) - 1.0); }
void main() {
  vec3 towardLens = normalize(cameraPosition - vWorldPosition);
  vec3 normal = normalize(vNormalWorld);
  if (dot(normal, towardLens) < 0.0) normal = -normal;
  float distanceMm = length(cameraPosition - vWorldPosition);
  vec3 dx = dFdx(vWorldPosition), dy = dFdy(vWorldPosition);
  // How much surface detail this pixel can carry. A surface seen edge-on, or far away, covers
  // millimetres of tissue per pixel: patterns in tissue coordinates would alias into speckle and
  // screen-space derivatives blow up, so detail fades toward its average there.
  float detail = smoothstep(0.06, 0.38, dot(normal, towardLens)) *
    (1.0 - smoothstep(0.7, 2.2, max(length(dx), length(dy))));
  // 0 on esophageal mucosa, 1 on gastric mucosa, across an irregular junction line.
  float gastric = smoothstep(
    0.4, 0.6, vRegion + (tissueNoise(vWorldPosition * 0.55) - 0.5) * 0.32 * detail);
  // Folds run along each organ, so its pattern is stretched along its long axis. The two
  // patterns are evaluated in their own fixed coordinates and then blended: blending the
  // coordinates instead would scramble the pattern across the junction.
  vec3 alongEsophagus = uEsophagusAxis * dot(vWorldPosition, uEsophagusAxis);
  vec3 across = vWorldPosition - alongEsophagus;
  vec3 alongStomach = uStomachAxis * dot(vWorldPosition, uStomachAxis);
  float folds = mix(
    pow(ridges(across * 0.3 + alongEsophagus * 0.028), 1.3),
    pow(ridges((vWorldPosition - alongStomach) * 0.15 + alongStomach * 0.028), 2.2),
    gastric);
  float fine = tissueNoise(vWorldPosition * 2.2);
  // Relief in millimetres. Only the fold pattern is differentiated, so the change of fold height
  // across the junction does not show up as a ridge of its own.
  float relief = folds + fine * 0.02;
  float reliefMm = mix(0.55, 3.2, gastric) * detail;
  vec3 rx = cross(dy, normal), ry = cross(normal, dx);
  float determinant = dot(dx, rx);
  vec3 gradient = sign(determinant) * reliefMm * (dFdx(relief) * rx + dFdy(relief) * ry);
  if (abs(determinant) > 0.0000001) normal = normalize(abs(determinant) * normal - gradient);
  float broad = tissueNoise(vWorldPosition * 0.17);
  vec3 squamous = mix(vec3(0.56, 0.31, 0.30), vec3(0.76, 0.47, 0.45), broad);
  vec3 columnar = mix(vec3(0.56, 0.17, 0.10), vec3(0.80, 0.31, 0.18), broad);
  vec3 base = mix(squamous, columnar, gastric);
  // Fine longitudinal vessels show through the thin esophageal mucosa.
  float vessel = smoothstep(0.8, 0.94, ridges(across * 0.9 + alongEsophagus * 0.05));
  base = mix(base, vec3(0.5, 0.17, 0.16), vessel * 0.3 * (1.0 - gastric) * detail);
  // Valleys between folds sit in shade; the junction line is a little paler.
  float shade = mix(mix(0.8, 0.5, gastric), 1.08, smoothstep(0.05, 0.75, folds));
  base *= mix(mix(0.97, 0.86, gastric), shade, detail);
  base = mix(base, vec3(0.86, 0.68, 0.62), (1.0 - abs(gastric * 2.0 - 1.0)) * 0.22);
  base *= 0.96 + fine * 0.08 * detail;
  float facing = max(dot(normal, towardLens), 0.0);
  float diffuse = 0.19 + 0.81 * pow(facing, 0.68);
  float falloff = 1.0 / (1.0 + pow(distanceMm / 30.0, 1.65));
  float roughness = mix(0.16, 0.3, tissueNoise(vWorldPosition * 0.6));
  vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 lightDirection = normalize(cameraPosition + cameraRight * 1.1 - vWorldPosition);
  vec3 halfVector = normalize(lightDirection + towardLens);
  float wet = pow(max(dot(normal, halfVector), 0.0), 2.0 / (roughness * roughness)) * 0.5 * detail;
  float cone = smoothstep(0.5, 0.94, dot(-towardLens, normalize(uHeadlightAxis)));
  vec3 color = (base * diffuse * 1.35 + vec3(0.92, 0.84, 0.77) * wet) * falloff * (0.22 + 0.78 * cone);
  // The light source holds exposure, as the console's automatic brightness does: mucosa close
  // to the lens rolls off instead of burning out.
  color = 1.0 - exp(-color * 1.7);
  color = mix(vec3(0.012, 0.004, 0.004), color, 1.0 - smoothstep(110.0, 240.0, distanceMm));
  color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.0));
  gl_FragColor = vec4(color, 1.0);
}`;

/**
 * Lens pass: the circular field stop, mild barrel distortion and the soft edge of the field, with
 * the same constants as the EBUS simulator's optical pane. The distortion is scaled so the rim of
 * the field stop still shows the lens's full field of view.
 */
const LENS_FRAGMENT = `
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform float uAspect;
void main() {
  vec2 p = (vUv * 2.0 - 1.0) * vec2(uAspect, 1.0) / min(1.0, uAspect);
  float radius = length(p);
  float r2 = dot(p, p);
  vec2 q = p * (1.0 + ${glsl(BARREL_K1)} * r2 + ${glsl(BARREL_K2)} * r2 * r2) / ${glsl(1 + BARREL_K1 + BARREL_K2)};
  vec2 source = clamp((q * min(1.0, uAspect) / vec2(uAspect, 1.0)) * 0.5 + 0.5, 0.0, 1.0);
  vec3 color = texture2D(tDiffuse, source).rgb;
  float blur = smoothstep(${glsl(EDGE_BLUR_START_RADIUS)}, ${glsl(EDGE_BLUR_END_RADIUS)}, radius) * ${glsl(EDGE_BLUR_MAX_OFFSET_UV)};
  if (blur > 0.0001) {
    color += texture2D(tDiffuse, clamp(source + vec2(blur, blur), 0.0, 1.0)).rgb;
    color += texture2D(tDiffuse, clamp(source + vec2(-blur, blur), 0.0, 1.0)).rgb;
    color += texture2D(tDiffuse, clamp(source + vec2(blur, -blur), 0.0, 1.0)).rgb;
    color += texture2D(tDiffuse, clamp(source + vec2(-blur, -blur), 0.0, 1.0)).rgb;
    color /= 5.0;
  }
  color *= 1.0 - smoothstep(${glsl(APERTURE_RADIUS - APERTURE_FEATHER)}, ${glsl(APERTURE_RADIUS)}, radius);
  gl_FragColor = vec4(color, 1.0);
}`;

interface EusEndoscopeViewProps {
  manifest: EusCaseManifest;
  path: EusScopePath;
  pose: EusPose;
  sMm: number;
  /** Estimated depth from the incisors, as shown elsewhere on the page. */
  depthLabel: string;
  /** The control that swaps this pane between the endoscope and the CT. */
  viewSwitch: ReactNode;
}

/** Mean direction of a stretch of the scope path, in the web frame. */
function meanTangent(path: EusScopePath, fromMm: number, toMm: number) {
  const sum = new THREE.Vector3();
  const from = Math.round(fromMm / path.stepMm),
    to = Math.min(Math.round(toMm / path.stepMm), path.tangentsLps.length - 1);
  for (let i = from; i <= to; i++) sum.add(web(path.tangentsLps[i]));
  return sum.lengthSq() > 0 ? sum.normalize() : new THREE.Vector3(0, -1, 0);
}

/**
 * The view through the EBUS endoscope's lens as it passes down the esophagus into the stomach.
 *
 * The lumen surface is built once; the camera is re-aimed from the scope pose and the frame is
 * drawn only when the pose changes.
 */
export function EusEndoscopeView({
  manifest,
  path,
  pose,
  sMm,
  depthLabel,
  viewSwitch,
}: EusEndoscopeViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const draw = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const live = useRef({ path, pose, sMm });
  live.current = { path, pose, sMm };

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor('#070303', 1);
    element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Simulated endoscopic view');
    renderer.domElement.setAttribute('role', 'img');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(EUS_ENDOSCOPE_FOV_DEG, 1, 0.4, 900);
    const material = new THREE.ShaderMaterial({
      // Both faces: the surface is seen from inside, whichever way the case build wound it.
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: {
        uHeadlightAxis: { value: new THREE.Vector3(0, 0, -1) },
        uEsophagusAxis: { value: meanTangent(path, 0, path.gejSMm) },
        uStomachAxis: { value: meanTangent(path, path.gejSMm, path.totalLengthMm) },
      },
      vertexShader: MUCOSA_VERTEX,
      fragmentShader: MUCOSA_FRAGMENT,
    });

    // Multisampled, so wall edges are as smooth here as they would be drawn straight to the canvas.
    const target = new THREE.WebGLRenderTarget(4, 4, { samples: 4 });
    const lensScene = new THREE.Scene();
    const lensCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const lensMaterial = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: target.texture }, uAspect: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: LENS_FRAGMENT,
    });
    const lensQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lensMaterial);
    lensQuad.frustumCulled = false;
    lensScene.add(lensQuad);

    let lumen: THREE.Mesh | null = null;
    const raycaster = new THREE.Raycaster();
    const look = new THREE.Vector3();
    const render = () => {
      if (!lumen) return;
      const at = live.current;
      const view = computeEusEndoscopeCamera(at.path, at.pose, at.sMm);
      const anchor = web(view.anchorLps),
        forward = web(view.forwardLps);
      // Keep the lens off the wall: it sits on the line from the lumen's middle toward its place
      // on the shaft, stopping short of the first wall on that line.
      const reach = web(view.eyeLps).sub(anchor),
        wanted = reach.length();
      camera.position.copy(anchor);
      if (wanted > 1e-4) {
        reach.multiplyScalar(1 / wanted);
        raycaster.set(anchor, reach);
        raycaster.far = wanted + EUS_ENDOSCOPE_CLEARANCE_MM;
        const wall = raycaster.intersectObject(lumen, false)[0];
        camera.position.addScaledVector(reach, clearLensDistanceMm(wall ? wall.distance : null, wanted));
      }
      camera.up.copy(web(view.upLps));
      camera.lookAt(look.copy(camera.position).add(forward));
      (material.uniforms.uHeadlightAxis.value as THREE.Vector3).copy(forward);
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(lensScene, lensCamera);
    };
    draw.current = render;

    const resize = () => {
      const width = element.clientWidth,
        height = element.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      const ratio = renderer.getPixelRatio(),
        aspect = width / height;
      target.setSize(Math.round(width * ratio), Math.round(height * ratio));
      camera.aspect = aspect;
      // The lens's field of view spans the circular field stop, whatever the pane's shape.
      camera.fov =
        (2 * Math.atan(Math.tan((EUS_ENDOSCOPE_FOV_DEG * Math.PI) / 360) / Math.min(1, aspect)) * 180) /
        Math.PI;
      camera.updateProjectionMatrix();
      lensMaterial.uniforms.uAspect.value = aspect;
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);

    let disposed = false;
    new GLTFLoader()
      .loadAsync(eusCaseAssetUrl(manifest.assets.lumen.asset, manifest.assets.lumen.sha256))
      .then((gltf) => {
        if (disposed) return;
        gltf.scene.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh || lumen) return;
          mesh.geometry.computeVertexNormals();
          (mesh.material as THREE.Material).dispose();
          mesh.material = material;
          lumen = mesh;
        });
        if (!lumen) throw new Error('The lumen model has no surface.');
        scene.add(gltf.scene);
        scene.updateMatrixWorld(true);
        setStatus('ready');
        resize();
      })
      .catch(() => {
        if (!disposed) setStatus('error');
      });

    return () => {
      disposed = true;
      draw.current = null;
      observer.disconnect();
      lumen?.geometry.dispose();
      material.dispose();
      lensMaterial.dispose();
      lensQuad.geometry.dispose();
      target.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [manifest, path]);

  useEffect(() => {
    draw.current?.();
  }, [path, pose, sMm, status]);

  return (
    <section className="eus-pane eus-endoscope-pane" aria-label="Simulated endoscopic view">
      <header className="eus-pane-header">
        <div>
          <span className="eus-eyebrow">Endoscope</span>
          <h2>{pose.region === 'stomach' ? 'In the stomach' : 'In the esophagus'}</h2>
        </div>
        {viewSwitch}
      </header>
      <div className="eus-endoscope-image" ref={host} data-status={status}>
        {status !== 'ready' && (
          <div className="eus-image-message" role="status">
            {status === 'error'
              ? 'The endoscopic view could not be loaded.'
              : 'Loading the endoscopic view…'}
          </div>
        )}
        <span className="eus-endoscope-mark">Transducer side</span>
        <span className="eus-image-badge">Simulated</span>
        <div className="eus-image-readout">
          {depthLabel} · {pose.region}
        </div>
      </div>
      <p className="eus-pane-caption">
        The view through the EBUS endoscope’s lens. The lens looks forward and up toward the
        transducer, so the lumen ahead sits low in the image and the scan plane runs up its middle.
      </p>
    </section>
  );
}
