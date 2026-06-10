import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { clamp, ctAxisLength, ctCanvasDimensions, ctCanvasPixelToIndex, windowHu } from './geometry'
import type { CtAxis, CtPreviewAsset } from './types'

/**
 * Shared three.js building blocks for the airway anatomy module. Used by both the desktop
 * synchronized viewer (AirwayAnatomyModule) and the immersive WebXR scene (AirwayXRScene) so the
 * endoluminal mucosa, STL geometry, and CT slice imagery stay identical across both surfaces.
 */

const airwayGeometryCache = new Map<string, Promise<THREE.BufferGeometry>>()

/** Load + weld the airway STL once per URL; geometry is shared across viewports and the XR scene. */
export function loadAirwayStlGeometry(stlUrl: string): Promise<THREE.BufferGeometry> {
  const cached = airwayGeometryCache.get(stlUrl)
  if (cached) return cached

  const promise = new STLLoader().loadAsync(stlUrl).then((geometry) => {
    geometry.deleteAttribute('normal')
    const smoothedGeometry = mergeVertices(geometry, 0.001)
    geometry.dispose()
    smoothedGeometry.computeVertexNormals()
    smoothedGeometry.computeBoundingBox()
    smoothedGeometry.computeBoundingSphere()
    return smoothedGeometry
  })
  airwayGeometryCache.set(stlUrl, promise)
  return promise
}

/**
 * Endoluminal mucosa material: pale-pink tissue with submucosal vessels, a headlight that falls off
 * with distance, and a wet specular sheen. Rendered on the BackSide so the camera sits inside the
 * lumen. `toneMapped: false` keeps it consistent whether the scene uses ACES tone mapping or not.
 */
export function createBronchoscopyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    toneMapped: false,
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
        float falloff = mix(0.95, 0.4, smoothstep(30.0, 165.0, dist));

        vec3 p = vWorldPosition * 0.055;
        float broadFold = 0.5 + 0.5 * sin(p.z * 5.5 + p.y * 2.2 + sin(p.x * 2.6) * 1.4);
        float fineFold = 0.5 + 0.5 * sin(p.x * 12.0 + p.y * 7.0 + p.z * 4.0);
        float speckle = hash(floor(vWorldPosition * 0.95));
        float mucosa = 0.76 + broadFold * 0.17 + fineFold * 0.05 + (speckle - 0.5) * 0.04;

        // Pale pink mucosa with deeper shadow tones.
        vec3 shadowTone = vec3(0.32, 0.10, 0.09);
        vec3 midTone = vec3(0.85, 0.45, 0.40);
        vec3 highTone = vec3(1.0, 0.80, 0.74);
        vec3 base = mix(shadowTone, midTone, clamp(mucosa, 0.0, 1.0));
        base = mix(base, highTone, pow(headlight, 2.4) * 0.30);

        // Fine submucosal vessels.
        float vesselA = sin(p.x * 9.0 + sin(p.z * 3.4) * 2.2 + p.y * 1.5);
        float vesselB = sin(p.y * 11.0 + sin(p.x * 4.1) * 1.9 - p.z * 2.0);
        float vessel = smoothstep(0.93, 0.99, max(vesselA, vesselB));
        base = mix(base, vec3(0.58, 0.13, 0.12), vessel * 0.28);

        // Wet specular sheen from the scope light.
        float rimWet = pow(max(dot(reflect(-viewDir, n), viewDir), 0.0), 26.0);
        float sparkleGate = smoothstep(0.982, 1.0, hash(floor(vWorldPosition * 2.15)));
        float sparkle = sparkleGate * pow(headlight, 10.0) * 0.25;

        float exposure = 0.68 + headlight * 0.7;
        vec3 color = base * exposure * falloff;
        color += vec3(1.0, 0.93, 0.88) * (rimWet * 0.26 + sparkle);

        float depthDarken = smoothstep(105.0, 235.0, dist);
        color = mix(color, vec3(0.06, 0.015, 0.012), depthDarken * 0.55);
        color = pow(max(color, vec3(0.0)), vec3(0.92));

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
}

/**
 * Paint the windowed grayscale CT slice for `axis`/`sliceIndex` onto `canvas`, sizing the canvas to
 * the slice. Returns nothing; callers may layer overlays (trail, tip marker) afterward. This is the
 * base image shared by the 2D CT panel, the 3D CT plane, and the XR CT plane.
 */
export function paintCtSliceGrayscale({
  canvas,
  ct,
  volume,
  axis,
  sliceIndex,
  windowLow,
  windowHigh,
}: {
  canvas: HTMLCanvasElement
  ct: CtPreviewAsset
  volume: Int16Array
  axis: CtAxis
  sliceIndex: number
  windowLow: number
  windowHigh: number
}): { width: number; height: number; clampedSlice: number } | null {
  const dimensions = ctCanvasDimensions(ct, axis)
  const clampedSlice = clamp(Math.round(sliceIndex), 0, ctAxisLength(ct, axis) - 1)
  canvas.width = dimensions.width
  canvas.height = dimensions.height
  const context = canvas.getContext('2d')
  if (!context) return null

  const image = context.createImageData(dimensions.width, dimensions.height)
  const [sx, sy] = ct.sizeXyz
  for (let y = 0; y < dimensions.height; y += 1) {
    for (let x = 0; x < dimensions.width; x += 1) {
      const [i, j, k] = ctCanvasPixelToIndex(x, y, axis, clampedSlice, ct)
      const value = volume[k * sx * sy + j * sx + i] ?? -1024
      const gray = windowHu(value, windowLow, windowHigh)
      const offset = (y * dimensions.width + x) * 4
      image.data[offset] = gray
      image.data[offset + 1] = gray
      image.data[offset + 2] = gray
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  return { width: dimensions.width, height: dimensions.height, clampedSlice }
}
