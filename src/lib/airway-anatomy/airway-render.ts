import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mucosaVertexShader, mucosaFragmentShader } from '../bronchoscopy-core/mucosa'
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

  const promise = (async () => {
    let geometry: THREE.BufferGeometry
    if (/\.glb(?:$|\?)/i.test(stlUrl)) {
      const gltf = await new GLTFLoader().loadAsync(stlUrl)
      gltf.scene.updateMatrixWorld(true)
      const meshes: THREE.Mesh[] = []
      gltf.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) meshes.push(object)
      })
      if (meshes.length !== 1) throw new Error('Reviewed lumen must contain one surface')
      geometry = meshes[0].geometry.clone().applyMatrix4(meshes[0].matrixWorld)
      meshes[0].geometry.dispose()
    } else {
      const source = await new STLLoader().loadAsync(stlUrl)
      source.deleteAttribute('normal')
      geometry = mergeVertices(source, 0.001)
      source.dispose()
    }
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return geometry
  })().catch((error) => {
    airwayGeometryCache.delete(stlUrl)
    throw error
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
    uniforms: {
      uWallAlpha: { value: 1 },
      uHeadlightAxis: { value: new THREE.Vector3(0, 0, -1) },
      uHeadlightFalloff: { value: 0 },
    },
    vertexShader: mucosaVertexShader,
    fragmentShader: mucosaFragmentShader,
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
