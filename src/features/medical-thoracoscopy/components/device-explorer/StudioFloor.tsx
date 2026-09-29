'use client'

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js'
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js'

const RESOLUTION = 512
const BLUR = 2.6
const OPACITY = 0.55

/**
 * A soft contact shadow on an unseen floor under the model, as in the showcase stills: the scene's
 * depth seen from the floor looking up, blurred, and laid on the floor.
 *
 * drei's ContactShadows does the same, but in this version it never releases its render targets
 * and makes new ones whenever its `scale` prop is a new array, so a floor that re-rendered leaked
 * two render targets each time. Here the targets are made once, the floor and its camera are resized
 * in place, and everything is released on unmount. It draws only when the scene draws a frame.
 */
type FloorParts = ReturnType<typeof createFloorParts>

function createFloorParts() {
  const target = new THREE.WebGLRenderTarget(RESOLUTION, RESOLUTION)
  const blurred = new THREE.WebGLRenderTarget(RESOLUTION, RESOLUTION)
  target.texture.generateMipmaps = blurred.texture.generateMipmaps = false
  // Nearer the floor is darker: colour by depth, alpha falling off with height.
  const depth = new THREE.MeshDepthMaterial()
  depth.depthTest = depth.depthWrite = false
  depth.onBeforeCompile = (shader) => {
    shader.uniforms.ucolor = { value: new THREE.Color('#1b1d22') }
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 ucolor;\nvoid main() {')
      .replace(
        'vec4( vec3( 1.0 - fragCoordZ ), opacity );',
        'vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );',
      )
  }
  const horizontal = new THREE.ShaderMaterial(HorizontalBlurShader)
  const vertical = new THREE.ShaderMaterial(VerticalBlurShader)
  horizontal.depthTest = vertical.depthTest = false
  const quadGeometry = new THREE.PlaneGeometry(2, 2)
  const quad = new THREE.Mesh(quadGeometry, horizontal)
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  quadCamera.position.z = 0.5
  const shadowCamera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1)
  shadowCamera.up.set(0, 0, 1)
  // A unit floor in the XZ plane whose texture's up runs along +Z, as the camera above sees it.
  const floorGeometry = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2)
  const floorMaterial = new THREE.MeshBasicMaterial({
    map: target.texture,
    transparent: true,
    opacity: OPACITY,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  return {
    target,
    blurred,
    depth,
    horizontal,
    vertical,
    quadGeometry,
    quad,
    quadCamera,
    shadowCamera,
    floorGeometry,
    floorMaterial,
  }
}

/** Size and place the floor and its camera for a box, in place. */
function fitFloor(parts: FloorParts, mesh: THREE.Mesh | null, box: THREE.Box3): void {
  const size = box.getSize(new THREE.Vector3())
  const centre = box.getCenter(new THREE.Vector3())
  const pad = size.y * 0.06 + 2
  const width = size.x * 1.25 + pad * 4
  const depth = size.z * 1.25 + pad * 6
  const y = box.min.y - pad
  mesh?.position.set(centre.x, y, centre.z)
  mesh?.scale.set(width, 1, depth)
  const camera = parts.shadowCamera
  camera.left = -width / 2
  camera.right = width / 2
  camera.top = depth / 2
  camera.bottom = -depth / 2
  camera.near = 0
  camera.far = size.y * 0.75 + pad
  camera.position.set(centre.x, y, centre.z)
  camera.lookAt(centre.x, y + 1, centre.z)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
}

/** The scene's depth from the floor, blurred twice, into the floor's texture. */
function drawShadow(
  parts: FloorParts,
  mesh: THREE.Mesh,
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
): void {
  const background = scene.background
  const override = scene.overrideMaterial
  mesh.visible = false
  scene.background = null
  scene.overrideMaterial = parts.depth
  gl.setRenderTarget(parts.target)
  gl.render(scene, parts.shadowCamera)
  scene.overrideMaterial = override
  scene.background = background
  for (const amount of [BLUR, BLUR * 0.4]) {
    parts.quad.material = parts.horizontal
    parts.horizontal.uniforms.tDiffuse.value = parts.target.texture
    parts.horizontal.uniforms.h.value = amount / 256
    gl.setRenderTarget(parts.blurred)
    gl.render(parts.quad, parts.quadCamera)
    parts.quad.material = parts.vertical
    parts.vertical.uniforms.tDiffuse.value = parts.blurred.texture
    parts.vertical.uniforms.v.value = amount / 256
    gl.setRenderTarget(parts.target)
    gl.render(parts.quad, parts.quadCamera)
  }
  gl.setRenderTarget(null)
  mesh.visible = true
}

export function StudioFloor({ box }: { box: THREE.Box3 }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const invalidate = useThree((state) => state.invalidate)
  const floor = useRef<THREE.Mesh>(null)

  const parts = useMemo(() => createFloorParts(), [])

  useEffect(
    () => () => {
      for (const item of [
        parts.target,
        parts.blurred,
        parts.depth,
        parts.horizontal,
        parts.vertical,
        parts.quadGeometry,
        parts.floorGeometry,
        parts.floorMaterial,
      ])
        item.dispose()
    },
    [parts],
  )

  useLayoutEffect(() => {
    fitFloor(parts, floor.current, box)
    invalidate()
  }, [box, invalidate, parts])

  useFrame(() => {
    if (floor.current) drawShadow(parts, floor.current, gl, scene)
  })

  return <mesh ref={floor} geometry={parts.floorGeometry} material={parts.floorMaterial} />
}
