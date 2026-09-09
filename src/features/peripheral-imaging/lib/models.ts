import * as THREE from 'three'
import { LESION_RADIUS, SHAFT_RADIUS, WINDOW_RADIUS, type Point3 } from './physics'

/** Original schematic meshes, authored 2026-09-08. No patient or manufacturer assets. */
function material(color: string, opacity = 1) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58,
    metalness: 0.12,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity === 1,
    side: opacity < 1 ? THREE.DoubleSide : THREE.FrontSide,
  })
}
function ellipsoid(
  parent: THREE.Group,
  position: Point3,
  scale: Point3,
  color: string,
  opacity = 1,
) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), material(color, opacity))
  mesh.position.set(...position)
  mesh.scale.set(...scale)
  parent.add(mesh)
  return mesh
}
function box(parent: THREE.Group, position: Point3, size: Point3, color: string, opacity = 1) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color, opacity))
  mesh.position.set(...position)
  parent.add(mesh)
  return mesh
}
export function createStaff(distance: number) {
  const group = new THREE.Group()
  group.name = 'Staff schematic'
  ellipsoid(group, [0, 18, 0], [10, 13, 10], '#a4b7ba')
  ellipsoid(group, [0, -23, 0], [20, 33, 12], '#5b8495')
  const limb = (from: Point3, to: Point3, radius: number) => {
    const start = new THREE.Vector3(...from),
      end = new THREE.Vector3(...to)
    const direction = end.clone().sub(start)
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, Math.max(0, direction.length() - 2 * radius), 6, 16),
      material('#718e9b'),
    )
    mesh.position.copy(start.add(end).multiplyScalar(0.5))
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    group.add(mesh)
  }
  limb([-11, -51, 0], [-13, -121, 3], 7)
  limb([11, -51, 0], [13, -121, 3], 7)
  limb([-21, -6, 0], [-28, -57, 5], 5)
  limb([21, -6, 0], [28, -57, 5], 5)
  ellipsoid(group, [-13, -125, 5], [8, 5, 14], '#344d5a')
  ellipsoid(group, [13, -125, 5], [8, 5, 14], '#344d5a')
  group.position.set(distance * 100, -22, 0)
  return group
}
export function createShield() {
  const group = new THREE.Group()
  group.name = 'Protective barrier schematic'
  box(group, [112, -37, 0], [5, 180, 100], '#88c9d2', 0.55)
  box(group, [112, -132, 0], [27, 5, 111], '#829ca8')
  return group
}
export function disposeModel(model: THREE.Object3D) {
  model.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.geometry.dispose()
      for (const mat of Array.isArray(object.material) ? object.material : [object.material])
        mat.dispose()
    }
  })
}

/** The same fictional side-window geometry used by the analytic MPR exercise. */
export function createSamplingModel(tip: Point3 = [14, 14, 0]) {
  const group = new THREE.Group()
  group.name = 'Authored spherical target and side-window needle'
  ellipsoid(group, [0, 0, 0], [LESION_RADIUS, LESION_RADIUS, LESION_RADIUS], '#ffc27b', 0.3)
  const [x, y, z] = tip
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(SHAFT_RADIUS, SHAFT_RADIUS, 45, 12),
    material('#d0e7f1'),
  )
  shaft.rotation.z = Math.PI / 2
  shaft.position.set(x - 22.5, y, z)
  group.add(shaft)
  const window = new THREE.Mesh(
    new THREE.CylinderGeometry(WINDOW_RADIUS, WINDOW_RADIUS, 8, 12),
    material('#62dcc0'),
  )
  window.rotation.z = Math.PI / 2
  window.position.set(x - 10, y, z)
  group.add(window)
  ellipsoid(group, [x, y, z], [0.8, 0.8, 0.8], '#effaff')
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereGeometry(LESION_RADIUS, 18, 12)),
    new THREE.LineBasicMaterial({ color: '#d99d54', transparent: true, opacity: 0.25 }),
  )
  group.add(wire)
  return group
}
