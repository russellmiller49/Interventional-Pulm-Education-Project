/**
 * Cut the frames the click-on-image questions use from the annotated normal survey.
 *
 *   node scripts/bronchoscopy-foundations/build-find-frames.mjs
 *
 * Each frame is one moment of `public/airway-lesson/airway-survey-cropped.mp4` on which the survey's
 * own annotation set (`airway-survey-overlays.json`) outlines two or more openings or structures. The script
 * writes the frame as a JPEG under `public/bronchoscopy-foundations/find-frames/` and its outlines,
 * unchanged and in the annotation set's own coordinates, to
 * `src/features/bronchoscopy-foundations/data/generated/findFrames.generated.ts`. Nothing is drawn
 * on the image and no outline is edited: a question shows the frame and asks the learner to click
 * the named opening.
 *
 * Needs ffmpeg on the PATH. Re-running reproduces the same files from the same video.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const VIDEO = 'public/airway-lesson/airway-survey-cropped.mp4'
const OVERLAYS = 'public/airway-lesson/airway-survey-overlays.json'
const OUT_DIR = 'public/bronchoscopy-foundations/find-frames'
const OUT_TS = 'src/features/bronchoscopy-foundations/data/generated/findFrames.generated.ts'

/**
 * The frames, by the id a section uses. `frame` is the annotation set's frame number. `markers`
 * lists the outlined openings a question may offer, by the lesson's structure id; an outline that
 * only encloses other outlines on the frame (a lobar bronchus around its segments) is left out.
 */
// A marker named by the annotation set's own key, for structures the lesson tree has no node for.
const CORD = { key: 'Vocal cord', id: 'vocal-cord', name: 'True vocal cord' }
const ARYEPIGLOTTIC = {
  key: 'Aryepiglottic_fold',
  id: 'aryepiglottic-fold',
  name: 'Aryepiglottic fold',
}
const CORNICULATE = {
  key: 'Corniculate_cartilage',
  id: 'corniculate-tubercle',
  name: 'Corniculate tubercle',
}
const CUNEIFORM = {
  key: 'Cuneiform_cartilage',
  id: 'cuneiform-tubercle',
  name: 'Cuneiform tubercle',
}

const PICKS = [
  { id: 'carina', frame: 540, markers: ['lmb', 'rmb'] },
  { id: 'right-main', frame: 620, markers: ['rul', 'bronchus-intermedius'] },
  { id: 'right-upper-lobe', frame: 688, markers: ['rb1', 'rb2', 'rb3'] },
  { id: 'intermedius-end', frame: 910, markers: ['rml', 'rb6', 'rb7', 'rb8', 'rb9'] },
  { id: 'right-middle-lobe', frame: 866, markers: ['rb4', 'rb5'] },
  { id: 'right-basal', frame: 1020, markers: ['rb7', 'rb8', 'rb9', 'rb10'] },
  // The larynx from above. Its structures are paired, so each is outlined once on either side.
  { id: 'larynx-inlet', frame: 60, markers: [CORD, ARYEPIGLOTTIC, CORNICULATE, CUNEIFORM] },
  { id: 'larynx-folds', frame: 136, markers: [CORD, ARYEPIGLOTTIC, CUNEIFORM] },
  { id: 'larynx-cords', frame: 170, markers: [CORD, CUNEIFORM] },
]

const overlays = JSON.parse(readFileSync(path.join(root, OVERLAYS), 'utf8'))
const { meta, structures } = overlays
const shapesByFrame = new Map(overlays.frames)
mkdirSync(path.join(root, OUT_DIR), { recursive: true })

const frames = {}
for (const pick of PICKS) {
  const shapes = shapesByFrame.get(pick.frame)
  if (!shapes) throw new Error(`Frame ${pick.frame} (${pick.id}) is not an annotated frame.`)
  const markers = pick.markers.flatMap((marker) => {
    const wanted = typeof marker === 'string' ? { node: marker, id: marker } : marker
    const index = structures.findIndex((structure) =>
      wanted.key ? structure.key === wanted.key : structure.node === wanted.node,
    )
    const outlines = shapes.filter((candidate) => candidate[0] === index)
    if (outlines.length === 0)
      throw new Error(`Frame ${pick.frame} (${pick.id}) has no outline for ${wanted.id}.`)
    const name = wanted.name ?? structures[index].name
    if (outlines.length === 1) return [{ id: wanted.id, name, points: outlines[0].slice(1) }]
    if (outlines.length > 2)
      throw new Error(`Frame ${pick.frame} (${pick.id}) outlines ${wanted.id} more than twice.`)
    // A paired structure: one outline on each side of the image, told apart by where it sits.
    const meanX = (shape) => {
      const points = shape.slice(1)
      let sum = 0
      for (let at = 0; at < points.length; at += 2) sum += points[at]
      return sum / (points.length / 2)
    }
    const [left, right] = [...outlines].sort((a, b) => meanX(a) - meanX(b))
    return [
      { id: `${wanted.id}-image-left`, name: `${name}, left of the image`, points: left.slice(1) },
      {
        id: `${wanted.id}-image-right`,
        name: `${name}, right of the image`,
        points: right.slice(1),
      },
    ]
  })
  const file = `${OUT_DIR}/${pick.id}.jpg`
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-ss',
    (pick.frame / meta.fps).toFixed(4),
    '-i',
    path.join(root, VIDEO),
    '-frames:v',
    '1',
    '-q:v',
    '3',
    path.join(root, file),
  ])
  frames[pick.id] = {
    src: file.replace(/^public/, ''),
    sourceFrame: pick.frame,
    markers,
  }
}

const source = `/**
 * Generated by scripts/bronchoscopy-foundations/build-find-frames.mjs. Do not edit.
 *
 * Frames of the annotated normal survey with the survey's own outlines, for the click-on-image
 * questions. Coordinates are the annotation set's: ${meta.width} by ${meta.height}.
 */
export const FIND_FRAME_SIZE = { width: ${meta.width}, height: ${meta.height} } as const

export const FIND_FRAMES = ${JSON.stringify(frames)} as const
`
writeFileSync(
  path.join(root, OUT_TS),
  await prettier.format(source, {
    ...(await prettier.resolveConfig(path.join(root, OUT_TS))),
    parser: 'typescript',
  }),
)
console.log(`Wrote ${PICKS.length} frames to ${OUT_DIR} and ${OUT_TS}.`)
