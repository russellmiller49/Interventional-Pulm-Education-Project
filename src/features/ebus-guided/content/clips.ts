import { BUILT_CLIPS, type BuiltClip } from './clips.generated'

/**
 * The owner's patient EBUS recordings, and what is drawn over their paused frames.
 *
 * What each clip shows is the owner's own description (2026-11-11). The marks are positions on
 * one paused frame, as fractions of the frame (0 to 1 from the left and from the top). They are
 * shown only on that still frame, never over the moving picture, so a mark is always on the
 * frame it was drawn for.
 *
 * `outlines` says who placed the marks. 'draft' marks were placed by the course author from the
 * owner's description and have not been checked by him; a clip stays 'draft' until he has.
 */
export type ClipMarkKind = 'node' | 'vessel' | 'pleura' | 'needle' | 'stylet'
export type ClipShape =
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { type: 'line'; points: [number, number][] }
  | { type: 'polygon'; points: [number, number][] }
export interface ClipMark {
  label: string
  kind: ClipMarkKind
  shape: ClipShape
}
export interface ClipStop {
  /** A stop built by `scripts/ebus-guided/build-clips.mjs`. */
  id: string
  label: string
  marks: ClipMark[]
}
export interface TeachingClip {
  slug: string
  title: string
  /** One sentence on what the recording is, shown under it. */
  what: string
  outlines: 'draft' | 'owner-checked'
  stops: ClipStop[]
}

/** Positions on the Doppler clip's 654 x 480 frame, as fractions of it. */
const d = (x: number, y: number): [number, number] => [x / 654, y / 480]
const ellipse = (cx: number, cy: number, rx: number, ry: number): ClipShape => ({
  type: 'ellipse',
  cx: cx / 654,
  cy: cy / 480,
  rx: rx / 654,
  ry: ry / 480,
})
/**
 * The node, as the owner outlined it on these two frames (2026-11-11). His outlines were drawn on
 * screenshots of the same recording; each was matched to its frame of the clip (1.1 s and 8.2 s)
 * and traced, so the points are his line, not a redrawing.
 */
const NODE_AT_FLOW: [number, number][] = [
  [0.421, 0.343], [0.432, 0.323], [0.44, 0.306], [0.448, 0.289], [0.455, 0.272], [0.465, 0.252],
  [0.478, 0.228], [0.497, 0.223], [0.515, 0.237], [0.529, 0.253], [0.542, 0.267], [0.554, 0.281],
  [0.567, 0.297], [0.582, 0.316], [0.59, 0.343], [0.586, 0.371], [0.568, 0.39], [0.555, 0.406],
  [0.545, 0.425], [0.53, 0.436], [0.513, 0.44], [0.497, 0.441], [0.481, 0.436], [0.466, 0.43],
  [0.451, 0.422], [0.436, 0.41], [0.417, 0.396], [0.412, 0.369],
] // prettier-ignore
const NODE_AT_LATE: [number, number][] = [
  [0.439, 0.334], [0.441, 0.301], [0.454, 0.273], [0.469, 0.25], [0.486, 0.231], [0.509, 0.229],
  [0.529, 0.232], [0.546, 0.236], [0.561, 0.246], [0.574, 0.255], [0.587, 0.264], [0.602, 0.273],
  [0.623, 0.284], [0.64, 0.305], [0.644, 0.334], [0.647, 0.365], [0.636, 0.393], [0.62, 0.414],
  [0.604, 0.433], [0.584, 0.439], [0.563, 0.432], [0.546, 0.425], [0.532, 0.42], [0.518, 0.413],
  [0.505, 0.404], [0.491, 0.394], [0.479, 0.378], [0.461, 0.36],
] // prettier-ignore

export const TEACHING_CLIPS: TeachingClip[] = [
  {
    slug: 'doppler-node-vessels',
    title: 'Colour Doppler around a node',
    what: 'A patient recording with colour Doppler on, from a case in which a tract was then made into the node for cryobiopsy. The small picture at the lower right is the white-light view.',
    // The node outlines are the owner's own. The vessel and pleura marks were placed by the course
    // author on the colour signals and the bright band; the owner checked all of them on both
    // frames on 2026-11-11.
    outlines: 'owner-checked',
    stops: [
      { id: 'quiet', label: 'A frame with little colour', marks: [] },
      {
        id: 'flow',
        label: 'A frame with colour flow',
        marks: [
          { label: 'Node', kind: 'node', shape: { type: 'polygon', points: NODE_AT_FLOW } },
          {
            label: 'Small vessel at the margin of the node',
            kind: 'vessel',
            shape: ellipse(381, 140, 13, 16),
          },
          {
            label: 'Pleura',
            kind: 'pleura',
            // Along the bright band, measured column by column on this frame.
            shape: {
              type: 'line',
              points: [d(278, 201), d(298, 211), d(318, 228), d(338, 239), d(358, 243)],
            },
          },
          {
            label: 'Small vessel at the pleural line, probably a collateral',
            kind: 'vessel',
            shape: ellipse(332, 250, 16, 10),
          },
        ],
      },
      {
        id: 'late',
        label: 'A later frame',
        marks: [
          { label: 'Node', kind: 'node', shape: { type: 'polygon', points: NODE_AT_LATE } },
          {
            label: 'Pleura',
            kind: 'pleura',
            shape: {
              type: 'line',
              points: [
                d(288, 206),
                d(314, 206),
                d(340, 221),
                d(366, 230),
                d(392, 235),
                d(418, 247),
              ],
            },
          },
          {
            label: 'Small vessel at the pleural line, probably a collateral',
            kind: 'vessel',
            shape: ellipse(390, 256, 14, 9),
          },
        ],
      },
    ],
  },
]

export interface ResolvedClip extends TeachingClip {
  built: BuiltClip
}
export function teachingClip(slug: string): ResolvedClip | undefined {
  const clip = TEACHING_CLIPS.find((entry) => entry.slug === slug)
  const built = BUILT_CLIPS.find((entry) => entry.slug === slug)
  return clip && built ? { ...clip, built } : undefined
}
