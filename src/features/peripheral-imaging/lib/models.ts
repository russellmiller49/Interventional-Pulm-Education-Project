import * as THREE from 'three'
import { LESION_CENTER, LESION_RADIUS, SHAFT_RADIUS, WINDOW_RADIUS, type Point3 } from './physics'

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
function tube(parent: THREE.Group, points: Point3[], radius: number, color: string, opacity = 1) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(12, points.length * 8), radius, 10, false),
    material(color, opacity),
  )
  parent.add(mesh)
  return mesh
}
export function createThorax() {
  const body = new THREE.Group()
  body.name = 'Authored thorax and airway'
  ellipsoid(body, [0, -2, 6], [78, 44, 112], '#547380', 0.09)
  for (const side of [-1, 1]) {
    const lung = ellipsoid(
      body,
      [side * 35, 1, 5],
      [30, 31, 69],
      side === 1 ? '#76bcae' : '#7da3b8',
      0.22,
    )
    lung.name = side === 1 ? 'Schematic left lung' : 'Schematic right lung'
    // Shape an apical taper; retain transparent lobar contours and a simple hilum.
    const positions = lung.geometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i)
      positions.setX(i, positions.getX(i) * (0.85 - 0.16 * z))
    }
    lung.geometry.computeVertexNormals()
    for (let rib = 0; rib < 7; rib++) {
      const z = -55 + rib * 19
      const points: Point3[] = []
      for (let k = 0; k <= 18; k++) {
        const a = (k / 18) * Math.PI
        points.push([
          side * Math.sin(a) * (68 - Math.max(0, rib - 4) * 5),
          -Math.cos(a) * 34 - 2,
          z + Math.sin(a) * 7,
        ])
      }
      tube(body, points, 1.8, '#c4d1d5', 0.25)
    }
    tube(
      body,
      [
        [0, 7, 36],
        [side * 18, 5, 18],
        [side * 34, 0, -12],
        [side * 38, -2, -49],
      ],
      3.6,
      '#90d9cb',
      0.9,
    )
    for (const sign of [-1, 1]) {
      tube(
        body,
        [
          [side * 20, 5, 14],
          [side * 35, 7 * sign, 32],
          [side * 42, 12 * sign, 58],
        ],
        2.3,
        '#90d9cb',
        0.85,
      )
      tube(
        body,
        [
          [side * 32, 1, -8],
          [side * 47, 12 * sign, -19],
          [side * 54, 18 * sign, -38],
        ],
        2.1,
        '#90d9cb',
        0.85,
      )
      tube(
        body,
        [
          [side * 38, -2, -32],
          [side * 39, 18 * sign, -48],
          [side * 45, 21 * sign, -60],
        ],
        1.5,
        '#90d9cb',
        0.85,
      )
    }
  }
  tube(
    body,
    [
      [0, 8, 109],
      [0, 8, 68],
      [0, 7, 36],
    ],
    5,
    '#c8ece3',
    0.9,
  )
  tube(
    body,
    [
      [0, -37, -84],
      [0, -37, 4],
      [0, -32, 96],
    ],
    5.5,
    '#adbdc6',
    0.48,
  )
  ellipsoid(body, [-10, 18, 0], [22, 23, 34], '#a36e7f', 0.33).rotation.z = -0.2
  ellipsoid(body, [0, 0, 149], [27, 33, 36], '#7a9099', 0.3)
  const target = ellipsoid(body, LESION_CENTER, [9, 9, 9], '#ffb45e', 0.96)
  target.name = 'Teaching lesion'
  return body
}
export function createCArm() {
  const group = new THREE.Group()
  group.name = 'Authored source detector C-arm'
  const arc = new THREE.Mesh(
    new THREE.TorusGeometry(148, 5.5, 12, 80, Math.PI),
    material('#b9cad0'),
  )
  arc.rotation.z = Math.PI / 2
  group.add(arc)
  box(group, [0, -139, 0], [24, 22, 28], '#cbd4d7')
  box(group, [0, -125, 0], [15, 5, 17], '#ffb45e')
  box(group, [0, 133, 0], [70, 8, 56], '#abc1cb')
  box(group, [0, 127, 0], [64, 2, 50], '#35535e')
  const verts = new Float32Array([
    0, -123, 0, -31, 126, -24, 31, 126, -24, 0, -123, 0, 31, 126, -24, 31, 126, 24, 0, -123, 0, 31,
    126, 24, -31, 126, 24, 0, -123, 0, -31, 126, 24, -31, 126, -24,
  ])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geometry.computeVertexNormals()
  group.add(
    new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: '#e6bc73',
        transparent: true,
        opacity: 0.07,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    ),
  )
  return group
}
export function createTable() {
  const group = new THREE.Group()
  group.name = 'Teaching radiolucent table'
  box(group, [0, -51, 25], [101, 6, 343], '#5d7680', 0.85)
  box(group, [0, -95, -95], [23, 85, 47], '#70818d')
  box(group, [0, -141, -95], [98, 7, 68], '#3d525e')
  return group
}
export function createSupport(kind: 'fixed' | 'mobile') {
  const group = new THREE.Group()
  group.name = kind + ' schematic support'
  if (kind === 'fixed') {
    box(group, [-164, 83, 0], [13, 202, 24], '#93a9b4')
    box(group, [-75, 183, 0], [194, 10, 65], '#536d7a')
    box(group, [-165, -11, 0], [31, 28, 31], '#546f7b')
  } else {
    box(group, [-182, -84, 0], [26, 112, 39], '#93a9b4')
    box(group, [-179, -140, 0], [86, 20, 83], '#586f7c')
    for (const x of [-209, -150])
      for (const z of [-30, 30]) ellipsoid(group, [x, -155, z], [8, 8, 8], '#182f3e')
  }
  return group
}
export function createStaff(distance: number) {
  const group = new THREE.Group()
  group.name = 'Staff schematic'
  ellipsoid(group, [0, 15, 0], [13, 16, 13], '#d1cbc0')
  box(group, [0, -30, 0], [34, 58, 20], '#508fbb')
  box(group, [-10, -90, 0], [12, 63, 15], '#597283')
  box(group, [10, -90, 0], [12, 63, 15], '#597283')
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
