/**
 * Teaching stills rendered from the course's own 3D models, for teaching screens that had no
 * picture. Runs in a browser page built by `render-teaching-stills.mjs`.
 *
 * Every still is a drawing made from the teaching airway (`lumen.glb` and its graph), not a
 * photograph and not a recording of a patient. Blood, a blocker, a tube and the scope are authored
 * shapes placed in that airway to show where each one is. Sizes and positions are presentation
 * choices.
 *
 * Coordinates are patient LPS millimetres: +X the patient's left, +Y posterior, +Z toward the head.
 */
import * as THREE from 'three'
import {
  createBronchoscopyMaterial,
  loadAirwayStlGeometry,
} from '@/lib/airway-anatomy/airway-render'
import { loadScopeCase } from '../../src/features/bronchoscopy-foundations/engine/scope/scopeCase'
import { applyLumenWallAttribute } from '../../src/features/bronchoscopy-foundations/components/scope/lumenWallAttributes'
import { OPTICAL_FOV_DEG } from '../../src/features/bronchoscopy-foundations/engine/scope/scopeOstia'

const PROFILE = 'adult-teaching-combined-left-basal-v1'
const WIDTH = 1200
const HEIGHT = 900
type V = THREE.Vector3
const v = (p: readonly number[]) => new THREE.Vector3(p[0], p[1], p[2])
const POSTERIOR = new THREE.Vector3(0, 1, 0)
const ANTERIOR = new THREE.Vector3(0, -1, 0)
const SUPERIOR = new THREE.Vector3(0, 0, 1)
const LEFT = new THREE.Vector3(1, 0, 0)

const scopeCase = await loadScopeCase(PROFILE)
const lumen = await loadAirwayStlGeometry(
  `/bronchoscopy-foundations/anatomy/${PROFILE}/lumen.glb`,
  { dracoDecoderPath: '/fluoroview/draco/' },
)
applyLumenWallAttribute(lumen, scopeCase)
const { index } = scopeCase
const edges = [...index.edgesById.values()]
const TRACHEA = 0
const edge = (id: number) => index.edgesById.get(id)!
const parentOf = (id: number) => index.nodesById.get(edge(id).startNodeId)?.parentEdgeId ?? null
const childrenOf = (id: number) => index.nodesById.get(edge(id).endNodeId)?.childEdgeIds ?? []
const subtree = (id: number): number[] => [id, ...childrenOf(id).flatMap(subtree)]
/** The airways from the top of the trachea down to this one. */
const pathTo = (id: number): number[] => {
  const path = [id]
  for (let p = parentOf(id); p !== null; p = parentOf(p)) path.unshift(p)
  return path
}
function pointAt(id: number, mm: number): { point: V; tangent: V } {
  const points = edge(id).pointsLps.map(v)
  let travelled = 0
  for (let i = 1; i < points.length; i += 1) {
    const length = points[i].distanceTo(points[i - 1])
    if (travelled + length >= mm || i === points.length - 1) {
      const t = Math.min(1, Math.max(0, (mm - travelled) / Math.max(length, 1e-6)))
      return {
        point: points[i - 1].clone().lerp(points[i], t),
        tangent: points[i]
          .clone()
          .sub(points[i - 1])
          .normalize(),
      }
    }
    travelled += length
  }
  return { point: points[0], tangent: new THREE.Vector3(0, 0, -1) }
}
/** The centerline from the top of the trachea to a point on an airway, as one polyline. */
function lineTo(id: number, mm: number, fromMm = 0): V[] {
  const line: V[] = []
  let skip = fromMm
  for (const step of pathTo(id)) {
    const points = edge(step).pointsLps.map(v)
    let travelled = 0
    for (let i = 0; i < points.length; i += 1) {
      if (i > 0) travelled += points[i].distanceTo(points[i - 1])
      if (step === id && travelled > mm) {
        line.push(pointAt(id, mm).point)
        return line
      }
      if (skip > 0 && i > 0) {
        skip -= points[i].distanceTo(points[i - 1])
        if (skip > 0) continue
      }
      line.push(points[i])
    }
  }
  return line
}

// ── Which airway each vertex of the wall belongs to, and how far along it ─────────────────────────
const position = lumen.getAttribute('position')
const vertexCount = position.count
const owner = new Int32Array(vertexCount)
const along = new Float32Array(vertexCount)
{
  const segments: { id: number; a: V; d: V; length: number; start: number; radius: number }[] = []
  for (const e of edges) {
    const points = e.pointsLps.map(v)
    let start = 0
    for (let i = 1; i < points.length; i += 1) {
      const d = points[i].clone().sub(points[i - 1])
      const length = d.length()
      if (length > 1e-6)
        segments.push({
          id: e.id,
          a: points[i - 1],
          d: d.divideScalar(length),
          length,
          start,
          radius: e.radiusMm ?? 2,
        })
      start += length
    }
  }
  const p = new THREE.Vector3()
  const q = new THREE.Vector3()
  for (let i = 0; i < vertexCount; i += 1) {
    p.fromBufferAttribute(position, i)
    let best = Infinity
    for (const s of segments) {
      const t = Math.min(s.length, Math.max(0, q.copy(p).sub(s.a).dot(s.d)))
      const distance = q.copy(s.a).addScaledVector(s.d, t).distanceTo(p) / s.radius
      if (distance < best) {
        best = distance
        owner[i] = s.id
        along[i] = s.start + t
      }
    }
  }
}
const triangles = lumen.index
  ? Array.from(lumen.index.array as ArrayLike<number>)
  : Array.from({ length: vertexCount }, (_, i) => i)

// ── Renderer ─────────────────────────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(WIDTH, HEIGHT)
document.body.style.margin = '0'
document.body.appendChild(renderer.domElement)
const camera = new THREE.PerspectiveCamera(40, WIDTH / HEIGHT, 0.2, 2000)

interface Blood {
  /** Airways with blood through them. */
  readonly airways: readonly number[]
  /** The trachea's last millimetres above the carina, when blood has reached it. */
  readonly tracheaLastMm?: number
  /** One airway filled only beyond this distance along it. */
  readonly beyond?: { readonly id: number; readonly mm: number }
}
function bloodVertex(blood: Blood | undefined): (i: number) => boolean {
  if (!blood) return () => false
  const set = new Set(blood.airways)
  const tracheaLength = edge(0).lengthMm
  return (i) => {
    const id = owner[i]
    if (blood.beyond && id === blood.beyond.id) return along[i] >= blood.beyond.mm
    if (id === 0 && blood.tracheaLastMm) return along[i] >= tracheaLength - blood.tracheaLastMm
    return set.has(id)
  }
}

/** A path for a device lying in the airway: the centerline, thinned so it has no kinks, led in from above. */
function devicePath(id: number, mm: number): V[] {
  const line = lineTo(id, mm)
  const thinned = [line[0]]
  for (const point of line.slice(1, -1))
    if (point.distanceTo(thinned[thinned.length - 1]) >= 12) thinned.push(point)
  const end = line[line.length - 1]
  if (thinned.length > 1 && end.distanceTo(thinned[thinned.length - 1]) < 9) thinned.pop()
  thinned.push(end)
  const lead = line[0].clone().sub(pointAt(TRACHEA, 30).point).normalize()
  return [line[0].clone().addScaledVector(lead, 45), ...thinned]
}
function tube(points: V[], radius: number, material: THREE.Material, closed = true): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(24, points.length * 6), radius, 20, false),
    material,
  )
  if (closed) {
    for (const end of [points[0], points[points.length - 1]]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), material)
      cap.position.copy(end)
      mesh.add(cap)
    }
  }
  return mesh
}
/** A balloon or cuff: an ellipsoid lying along the airway at this point. */
function balloon(id: number, mm: number, radius: number, length: number, material: THREE.Material) {
  const { point, tangent } = pointAt(id, mm)
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), material)
  mesh.position.copy(point)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent)
  mesh.scale.set(radius, length / 2, radius)
  return mesh
}

interface OutsideSpec {
  readonly blood?: Blood
  /** The scope, from the top of the trachea to this point. */
  readonly scope?: { readonly id: number; readonly mm: number }
  readonly blocker?: { readonly id: number; readonly mm: number }
  /** A tracheal tube advanced into this airway, cuff up. */
  readonly tube?: { readonly id: number; readonly mm: number }
  readonly center: V
  /** From the middle of the picture to the camera. */
  readonly from: V
  readonly up?: V
  /** Half the height of what the picture holds, in millimetres. */
  readonly halfHeightMm: number
}
function renderOutside(spec: OutsideSpec) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0c1824')
  const isBlood = bloodVertex(spec.blood)
  const clear: number[] = []
  const red: number[] = []
  for (let i = 0; i < triangles.length; i += 3) {
    const count =
      Number(isBlood(triangles[i])) +
      Number(isBlood(triangles[i + 1])) +
      Number(isBlood(triangles[i + 2]))
    ;(count >= 2 ? red : clear).push(triangles[i], triangles[i + 1], triangles[i + 2])
  }
  const part = (indices: number[], material: THREE.Material, order: number) => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', lumen.getAttribute('position'))
    geometry.setAttribute('normal', lumen.getAttribute('normal'))
    geometry.setIndex(indices)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.renderOrder = order
    scene.add(mesh)
  }
  // The airway wall as pale glass, so whatever is inside it shows.
  part(
    clear,
    new THREE.MeshPhysicalMaterial({
      color: '#bfeaf0',
      roughness: 0.25,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    2,
  )
  // Airways with blood in them: solid and dark red.
  if (red.length)
    part(
      red,
      new THREE.MeshPhysicalMaterial({
        color: '#a3121a',
        roughness: 0.3,
        clearcoat: 0.7,
        clearcoatRoughness: 0.2,
        side: THREE.DoubleSide,
      }),
      1,
    )
  if (spec.scope) {
    const line = devicePath(spec.scope.id, spec.scope.mm)
    scene.add(
      tube(line, 2.5, new THREE.MeshStandardMaterial({ color: '#1b222c', roughness: 0.35 })),
    )
    // The scope's own light at its tip.
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(2.3, 20, 14),
      new THREE.MeshBasicMaterial({ color: '#fff3c4', toneMapped: false }),
    )
    const end = line[line.length - 1]
    tip.position.copy(end).addScaledVector(
      end
        .clone()
        .sub(line[line.length - 2])
        .normalize(),
      1.6,
    )
    tip.renderOrder = 5
    scene.add(tip)
    const glow = new THREE.PointLight('#fff1d6', 500, 45, 2)
    glow.position.copy(tip.position)
    scene.add(glow)
  }
  if (spec.blocker) {
    const material = new THREE.MeshPhysicalMaterial({
      color: '#f2d36b',
      roughness: 0.3,
      clearcoat: 0.6,
    })
    scene.add(tube(devicePath(spec.blocker.id, spec.blocker.mm), 1.1, material))
    scene.add(
      balloon(
        spec.blocker.id,
        spec.blocker.mm,
        (edge(spec.blocker.id).radiusMm ?? 5) * 1.12,
        15,
        material,
      ),
    )
  }
  if (spec.tube) {
    const wall = new THREE.MeshPhysicalMaterial({
      color: '#e9f3f7',
      roughness: 0.25,
      clearcoat: 0.6,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    })
    const body = tube(devicePath(spec.tube.id, spec.tube.mm), 4.1, wall, false)
    body.renderOrder = 3
    scene.add(body)
    const cuff = balloon(
      spec.tube.id,
      Math.max(4, spec.tube.mm - 12),
      (edge(spec.tube.id).radiusMm ?? 5) * 1.1,
      16,
      new THREE.MeshPhysicalMaterial({
        color: '#8fc7ea',
        roughness: 0.25,
        clearcoat: 0.7,
        transparent: true,
        opacity: 0.85,
      }),
    )
    cuff.renderOrder = 4
    scene.add(cuff)
  }
  const up = spec.up ?? SUPERIOR
  const direction = spec.from.clone().normalize()
  camera.fov = 40
  const distance = spec.halfHeightMm / Math.tan((camera.fov * Math.PI) / 360)
  camera.position.copy(spec.center).addScaledVector(direction, distance)
  camera.up.copy(up)
  camera.lookAt(spec.center)
  camera.updateProjectionMatrix()
  scene.add(new THREE.HemisphereLight('#eaf2f8', '#3a2e30', 1.6))
  const key = new THREE.DirectionalLight('#ffffff', 2.4)
  key.position.copy(spec.center).addScaledVector(direction, 200).addScaledVector(up, 160)
  key.target.position.copy(spec.center)
  const rim = new THREE.DirectionalLight('#cfe6ff', 1.2)
  rim.position.copy(spec.center).addScaledVector(direction, -200).addScaledVector(up, 80)
  rim.target.position.copy(spec.center)
  scene.add(key, key.target, rim, rim.target)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.autoClear = true
  renderer.render(scene, camera)
}

// ── The view down the scope ───────────────────────────────────────────────────────────────────────
const overlayScene = new THREE.Scene()
const overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
const overlay = new THREE.ShaderMaterial({
  transparent: true,
  depthTest: false,
  uniforms: { uRed: { value: 0 }, uAspect: { value: WIDTH / HEIGHT } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
  fragmentShader: `
    varying vec2 vUv; uniform float uRed; uniform float uAspect;
    void main(){
      vec2 p=(vUv-0.5)*vec2(uAspect,1.0)*2.0;
      float r=length(p);
      // Blood on the lens: a red wash, thickest at the edge, with the lamp's glare left in it.
      vec3 wash=mix(vec3(0.62,0.05,0.05),vec3(0.3,0.01,0.02),smoothstep(0.1,1.0,r));
      float washAlpha=uRed*(0.55+0.45*smoothstep(0.0,0.9,r));
      // The round field of the scope, dark beyond it.
      float field=smoothstep(0.93,0.99,r);
      vec3 color=mix(wash,vec3(0.012,0.016,0.024),field);
      gl_FragColor=vec4(color,max(washAlpha,field));
    }`,
})
overlayScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), overlay))

interface Pool {
  readonly airways: readonly number[]
  /** How far up the wall the blood reaches: 0 none, 0.5 the dependent half, 1 the whole wall. */
  readonly depth: number
  /** Only the last millimetres of the airway (for the trachea just above the carina). */
  readonly lastMm?: number
}
interface ScopeSpec {
  readonly id: number
  readonly mm: number
  /** Blood lying in airways. The patient is supine, so it lies on the posterior wall. */
  readonly pools?: readonly Pool[]
  /** Blood on the lens, 0 to 1. */
  readonly lens?: number
  /** Turn the view toward the posterior wall, in degrees. */
  readonly tiltDeg?: number
}
/**
 * The course's own wall material, with blood drawn on the wall where the still asks for it: dark,
 * wet and red, its edge broken up so it reads as fluid and not as paint.
 */
function bloodyWall(pools: readonly Pool[]) {
  const blood = new Float32Array(vertexCount)
  const centre = new Map<number, V[]>()
  for (const pool of pools) for (const id of pool.airways) centre.set(id, edge(id).pointsLps.map(v))
  const p = new THREE.Vector3()
  for (const pool of pools) {
    for (let i = 0; i < vertexCount; i += 1) {
      const id = owner[i]
      if (!pool.airways.includes(id)) continue
      if (pool.lastMm && along[i] < edge(id).lengthMm - pool.lastMm) continue
      p.fromBufferAttribute(position, i)
      const { point } = pointAt(id, along[i])
      // 1 on the posterior wall, -1 on the anterior wall.
      const height = p.sub(point).dot(POSTERIOR) / Math.max(p.length(), 1e-6)
      const reach = 1 - 2 * pool.depth
      blood[i] = Math.max(blood[i], Math.min(1, Math.max(0, 0.5 + (height - reach) * 2.2)))
    }
  }
  const geometry = lumen.clone()
  geometry.setAttribute('aBlood', new THREE.BufferAttribute(blood, 1))
  const material = createBronchoscopyMaterial(undefined, { anatomy: true, paleWall: true })
  const once = (source: string, find: string, replacement: string) => {
    if (!source.includes(find)) throw new Error(`The wall shader no longer has: ${find}`)
    return source.replace(find, replacement)
  }
  material.vertexShader = once(
    material.vertexShader,
    'void main() {',
    'attribute float aBlood;\nvarying float vBlood;\nvoid main() {\n  vBlood = aBlood;',
  )
  let fragment = material.fragmentShader
  fragment = once(fragment, 'void main() {', 'varying float vBlood;\nvoid main() {')
  fragment = once(
    fragment,
    '  float facing=max(dot(normal,towardLens),0.0);',
    `  float bloodEdge=vBlood+(tissueNoise(vWorldPosition*0.55)-0.5)*0.5+(tissueNoise(vWorldPosition*2.3)-0.5)*0.12;
  float blood=smoothstep(0.36,0.62,bloodEdge);
  // Thin at its edge, where the wall shows through; dark where it lies deep.
  base=mix(base,mix(vec3(0.4,0.03,0.03),vec3(0.2,0.004,0.01),smoothstep(0.55,1.1,bloodEdge)),blood);
  float facing=max(dot(normal,towardLens),0.0);`,
  )
  fragment = once(
    fragment,
    '  float cone=smoothstep(',
    '  wet*=1.0+3.2*blood;\n  float cone=smoothstep(',
  )
  material.fragmentShader = fragment
  return { geometry, material }
}
function renderScope(spec: ScopeSpec) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#050305')
  const { point, tangent } = pointAt(spec.id, spec.mm)
  const up = ANTERIOR.clone().addScaledVector(tangent, -ANTERIOR.dot(tangent)).normalize()
  const forward = tangent.clone()
  if (spec.tiltDeg)
    forward.applyAxisAngle(
      new THREE.Vector3().crossVectors(up, tangent).normalize(),
      (-spec.tiltDeg * Math.PI) / 180,
    )
  camera.fov = OPTICAL_FOV_DEG
  camera.position.copy(point)
  camera.up.copy(up)
  camera.lookAt(point.clone().add(forward))
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  const { geometry, material } = bloodyWall(spec.pools ?? [])
  material.uniforms.uHeadlightAxis.value.copy(forward)
  scene.add(new THREE.Mesh(geometry, material))
  renderer.toneMapping = THREE.NoToneMapping
  renderer.autoClear = true
  renderer.render(scene, camera)
  overlay.uniforms.uRed.value = spec.lens ?? 0
  renderer.autoClear = false
  renderer.render(overlayScene, overlayCamera)
  renderer.autoClear = true
  material.dispose()
  geometry.dispose()
}

// ── The stills ────────────────────────────────────────────────────────────────────────────────────
const TR = TRACHEA
const RMSB = 1
const LMSB = 2
const BI = 4
const RLL = 8
const RML = 9
/** The basal trunk of the right lower lobe: the airway the tip wedges in, and its segments. */
const BASAL = 72
const basalSegments = subtree(BASAL)
const rightLowerLobe = subtree(RLL)
const carina = v(edge(RMSB).pointsLps[0])
const wholeTree = { center: new THREE.Vector3(-6, -172, -178), halfHeightMm: 104 }
const fromFront = ANTERIOR.clone()
const basalStart = pointAt(BASAL, 0).point
/** Where the tip sits when it is wedged: in the mouth of the basal trunk. */
const wedged = { id: 34, mm: edge(34).lengthMm - 1 }

const STILLS: Record<string, () => void> = {
  // Blood kept where it started: the tip wedged in the bleeding airway, blood beyond it only.
  'bleeding-held-in-segment': () =>
    renderOutside({
      ...wholeTree,
      from: fromFront,
      blood: { airways: basalSegments },
      scope: wedged,
    }),
  // Blood not held: up the right side to the carina and over into the left lung.
  'bleeding-floods-both-lungs': () =>
    renderOutside({
      ...wholeTree,
      from: fromFront,
      blood: {
        airways: [...rightLowerLobe, BI, ...subtree(RML), RMSB, LMSB, ...subtree(5)],
        tracheaLastMm: 16,
      },
    }),
  // The first move, close up: the tip wedged, the blood held beyond it.
  'bleeding-wedge-close': () =>
    renderOutside({
      center: basalStart.clone().addScaledVector(SUPERIOR, 10).addScaledVector(LEFT, 6),
      halfHeightMm: 48,
      from: fromFront.clone().addScaledVector(LEFT, 0.2),
      blood: { airways: basalSegments },
      scope: wedged,
    }),
  // Bleeding side down: the patient lying on the right side, seen from in front. Blood stays low.
  'bleeding-side-down': () =>
    renderOutside({
      center: new THREE.Vector3(-6, -172, -190),
      halfHeightMm: 92,
      from: fromFront,
      up: LEFT,
      blood: { airways: [...rightLowerLobe, BI, ...subtree(RML)] },
    }),
  // A blocker in the bleeding bronchus: blood stays beyond the balloon.
  'bleeding-blocker': () =>
    renderOutside({
      center: carina.clone().addScaledVector(SUPERIOR, -34).addScaledVector(LEFT, -4),
      halfHeightMm: 78,
      from: fromFront,
      blood: { airways: [...rightLowerLobe, ...subtree(RML)], beyond: { id: BI, mm: 17 } },
      blocker: { id: BI, mm: 10 },
    }),
  // The tube advanced into the lung that is not bleeding, its cuff sealing that lung off.
  'bleeding-tube-in-other-lung': () =>
    renderOutside({
      center: carina.clone().addScaledVector(SUPERIOR, -30),
      halfHeightMm: 82,
      from: fromFront,
      blood: { airways: [...subtree(RMSB)], tracheaLastMm: 8 },
      tube: { id: LMSB, mm: 30 },
    }),
  // From the scope: blood welling up out of the segments just biopsied.
  'bleeding-scope-wells-up': () =>
    renderScope({
      id: 16,
      mm: 3,
      pools: [
        { airways: basalSegments, depth: 1 },
        { airways: [34, ...subtree(71)], depth: 0.6 },
        { airways: [16, ...subtree(35)], depth: 0.3 },
      ],
      lens: 0.12,
    }),
  // From the scope above the carina: blood coming up out of the right main bronchus.
  'bleeding-scope-at-carina': () =>
    renderScope({
      id: TR,
      mm: edge(TR).lengthMm - 24,
      pools: [
        { airways: [BI, 3, RLL, RML], depth: 0.85 },
        { airways: [RMSB], depth: 0.6 },
        { airways: [TR], depth: 0.3, lastMm: 14 },
        { airways: [LMSB], depth: 0.16 },
      ],
      lens: 0.04,
    }),
}

declare global {
  var teachingStills: { ids: string[]; size: [number, number]; render: (id: string) => void }
}
globalThis.teachingStills = {
  ids: Object.keys(STILLS),
  size: [WIDTH, HEIGHT],
  render: (id) => STILLS[id](),
}
