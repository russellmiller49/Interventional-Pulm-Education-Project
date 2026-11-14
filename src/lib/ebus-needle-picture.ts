import {
  MODEL_GEOMETRY,
  NEEDLE_LAB,
  needleGeometry,
  needlePath,
  type NeedleState,
} from './ebus-model-contract'

/*
 * The needle lab's ultrasound picture (rebuild of 2026-11-11), as one SVG document.
 *
 * A simulated sector drawn from the same geometry the 3D view shows: the airway wall, a node on the
 * needle path, a vessel beyond its far side, and whatever length of the needle lies in the imaging
 * plane. It is drawn the way the screen is read at the bedside, with the needle entering from the
 * upper right, so the model's x axis runs right to left. It replaced a grey bar and an oval.
 *
 * The dashed line is the needle path with a scale in millimetres from the end of the sheath: the
 * depth to the far side of the node is read from it, and the stop is set to that reading.
 *
 * It is built as a string so the lab (a Vite app with its own React) and the lesson page (Next)
 * draw the identical picture from one place, each as an image.
 */
const FAN = NEEDLE_LAB.fan
const AXIS = MODEL_GEOMETRY.needle.axis
const START = MODEL_GEOMETRY.needle.retractedTip
const HALF_SLICE = MODEL_GEOMETRY.needle.sliceHalfThickness
const BOX = { x: -29, y: 3, width: 54, height: 40 }
export const NEEDLE_PICTURE_ASPECT = BOX.width / BOX.height
const n = (value: number) => value.toFixed(2)
/** Model millimetres to screen: the scope's distal direction is to the left. */
const screen = (x: number, y: number): [number, number] => [-x, y]
const fanPoint = (radius: number, degrees: number) => {
  const angle = (degrees * Math.PI) / 180
  return n(-FAN.cx + radius * Math.sin(angle)) + ' ' + n(FAN.cy + radius * Math.cos(angle))
}
const FAN_PATH =
  `M${fanPoint(FAN.near, -FAN.halfAngle)}A${FAN.near} ${FAN.near} 0 0 0 ${fanPoint(FAN.near, FAN.halfAngle)}` +
  `L${fanPoint(FAN.far, FAN.halfAngle)}A${FAN.far} ${FAN.far} 0 0 1 ${fanPoint(FAN.far, -FAN.halfAngle)}Z`
/** A point on the needle path, in millimetres of needle beyond the sheath. */
const onPath = (s: Pick<NeedleState, 'sheath'>, beyondSheath: number) =>
  screen(
    START[0] + AXIS[0] * (s.sheath + beyondSheath),
    START[1] + AXIS[1] * (s.sheath + beyondSheath),
  )
/** Across the path, toward the right of the screen. */
const ACROSS: [number, number] = [AXIS[1], AXIS[0]]
const TICKS = [5, 10, 15, 20]
const FULL = `x="${BOX.x}" y="${BOX.y}" width="${BOX.width}" height="${BOX.height}"`

/** The length of needle, from the sheath, that lies within the thickness of the imaging plane. */
export function needleLengthSeen(s: NeedleState) {
  const sine = Math.abs(Math.sin((s.plane * Math.PI) / 180))
  return Math.min(s.extension, sine > 0 ? (HALF_SLICE / sine + 0.5) / AXIS[0] : s.extension)
}
/** What the picture shows of the needle, in words. */
export function needlePictureStatus(s: NeedleState) {
  if (s.removed) return 'Needle assembly removed.'
  if (s.extension <= 1) return 'Needle inside the sheath.'
  return needleGeometry(s).tipVisible
    ? 'Needle tip in the image.'
    : 'Needle tip not in the image. The line is shaft.'
}
export function needlePictureAlt(s: NeedleState) {
  return (
    'Simulated ultrasound sector with the airway wall at the top, a lymph node on the needle path and a vessel beyond it. ' +
    needlePictureStatus(s)
  )
}
export function needlePictureSvg(
  s: NeedleState,
  options: { reveal?: boolean; scale?: boolean } = {},
) {
  const g = needleGeometry(s)
  const seen = needleLengthSeen(s)
  const from = onPath(s, 0),
    to = onPath(s, seen),
    tip = onPath(s, s.extension)
  const node = NEEDLE_LAB.node,
    vessel = NEEDLE_LAB.vessel
  const [nodeX, nodeY] = screen(node.cx, node.cy)
  const [vesselX, vesselY] = screen(vessel.cx, vessel.cy)
  const tick = (mm: number, half: number) => {
    const [x, y] = onPath(s, mm)
    return `M${n(x - ACROSS[0] * half)} ${n(y - ACROSS[1] * half)}L${n(x + ACROSS[0] * half)} ${n(y + ACROSS[1] * half)}`
  }
  const line = (a: [number, number], b: [number, number]) =>
    `x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}"`
  const out = s.extension > 1 && !s.removed
  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BOX.width * 10}" height="${BOX.height * 10}" viewBox="${BOX.x} ${BOX.y} ${BOX.width} ${BOX.height}" font-family="system-ui, -apple-system, Segoe UI, sans-serif">`,
    '<defs>',
    `<clipPath id="fan"><path d="${FAN_PATH}"/></clipPath>`,
    `<clipPath id="node"><ellipse cx="${n(nodeX)}" cy="${n(nodeY)}" rx="${node.rx}" ry="${node.ry}"/></clipPath>`,
    `<filter id="speckle" ${FULL} filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.9 1.9" numOctaves="2" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.9 0 0 0 -0.62"/></filter>`,
    `<filter id="glow" ${FULL} filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="0.35"/></filter>`,
    '<linearGradient id="depth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></linearGradient>',
    '</defs>',
    `<rect ${FULL} fill="#05080c"/>`,
    '<g clip-path="url(#fan)">',
    `<rect ${FULL} fill="#1d2228"/>`,
    `<rect ${FULL} filter="url(#speckle)" opacity="0.5"/>`,
    // The airway wall: a bright band under the transducer.
    `<rect x="${BOX.x}" y="7.3" width="${BOX.width}" height="${n(NEEDLE_LAB.wallOuter - 7.3)}" fill="#c9d0d6" opacity="0.5"/>`,
    `<path d="M${BOX.x} ${NEEDLE_LAB.wallOuter}H${BOX.x + BOX.width}" stroke="#eef2f5" stroke-width="0.35" opacity="0.8"/>`,
    // The node: darker than the tissue around it, with its own fine echoes.
    `<ellipse cx="${n(nodeX)}" cy="${n(nodeY)}" rx="${node.rx}" ry="${node.ry}" fill="#0c1014"/>`,
    `<g clip-path="url(#node)"><rect ${FULL} filter="url(#speckle)" opacity="0.2"/></g>`,
    `<ellipse cx="${n(nodeX)}" cy="${n(nodeY)}" rx="${node.rx}" ry="${node.ry}" fill="none" stroke="#8d969e" stroke-width="0.25" opacity="0.7"/>`,
    // The vessel beyond the node: echo-free, with a bright wall.
    `<circle cx="${n(vesselX)}" cy="${n(vesselY)}" r="${vessel.r}" fill="#020304" stroke="#aab3bb" stroke-width="0.3"/>`,
    `<rect ${FULL} fill="url(#depth)"/>`,
  )
  if (out) {
    // Reverberation deep to the needle, then the needle itself.
    for (const [gap, opacity] of [
      [0.9, 0.2],
      [1.8, 0.1],
    ])
      parts.push(
        `<line ${line([from[0], from[1] + gap], [to[0], to[1] + gap])} stroke="#e9eef5" stroke-width="0.3" opacity="${opacity}"/>`,
      )
    parts.push(
      `<line ${line(from, to)} stroke="#fff" stroke-width="1.1" opacity="0.5" filter="url(#glow)"/>`,
      `<line ${line(from, to)} stroke="#f6f9ff" stroke-width="0.5" stroke-linecap="round"/>`,
    )
    if (g.tipVisible) parts.push(`<circle cx="${n(to[0])}" cy="${n(to[1])}" r="0.55" fill="#fff"/>`)
  }
  parts.push('</g>', `<path d="${FAN_PATH}" fill="none" stroke="#33414f" stroke-width="0.2"/>`)
  if (!s.removed && options.scale !== false) {
    // The needle path and its scale, in millimetres from the end of the sheath.
    parts.push(
      '<g stroke="#5fe0e6" fill="#9cf0f3">',
      `<line ${line(from, onPath(s, MODEL_GEOMETRY.needle.maxTravel))} stroke-width="0.18" stroke-dasharray="0.7 0.7" opacity="0.8"/>`,
    )
    for (const mm of TICKS) {
      const [x, y] = onPath(s, mm)
      parts.push(
        `<path d="${tick(mm, 0.7)}" stroke-width="0.2"/>`,
        `<text x="${n(x + ACROSS[0] * 1.3)}" y="${n(y + ACROSS[1] * 1.3 + 0.6)}" stroke="none" font-size="1.7">${mm}</text>`,
      )
    }
    parts.push('</g>')
    if (s.stop > 0) {
      const [x, y] = onPath(s, s.stop)
      parts.push(
        `<path d="${tick(s.stop, 1.5)}" stroke="#ffd166" stroke-width="0.4"/>`,
        `<text x="${n(x - ACROSS[0] * 2 - 5.4)}" y="${n(y - ACROSS[1] * 2 + 0.6)}" fill="#ffe29a" font-size="1.7">stop ${s.stop}</text>`,
      )
    }
  }
  parts.push(
    '<g fill="#c4d2de" font-size="1.8">',
    `<text x="${n(nodeX - node.rx - 5.4)}" y="${n(nodeY + 0.6)}">node</text>`,
    `<text x="${n(vesselX - 2.6)}" y="${n(vesselY + vessel.r + 2.3)}">vessel</text>`,
    '<text x="-23.5" y="6.4">airway wall</text>',
    '</g>',
  )
  if (options.reveal && out) {
    if (g.tipVisible)
      parts.push(
        `<text x="${n(to[0] - 3.6)}" y="${n(to[1] + 2.4)}" fill="#91efd5" font-size="1.8">tip</text>`,
      )
    else
      // Where the needle really ends: beyond the end of the line, out of the image.
      parts.push(
        `<line ${line(to, tip)} stroke="#ffb86b" stroke-width="0.3" stroke-dasharray="0.6 0.6"/>`,
        `<circle cx="${n(tip[0])}" cy="${n(tip[1])}" r="0.9" fill="none" stroke="#ffb86b" stroke-width="0.3"/>`,
        `<text x="${n(tip[0] - 15.5)}" y="${n(tip[1] + 3)}" fill="#ffd3a1" font-size="1.8">tip, out of the image</text>`,
      )
  }
  parts.push('</svg>')
  return parts.join('')
}
export const needlePictureUri = (s: NeedleState, options?: { reveal?: boolean; scale?: boolean }) =>
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(needlePictureSvg(s, options))
/** Whether the needle is out and within the node, for the line under the picture. */
export function needleWithinNode(s: NeedleState) {
  const path = needlePath(s)
  return s.extension >= path.nodeNear && s.extension <= path.nodeFar + NEEDLE_LAB.borderMm
}
