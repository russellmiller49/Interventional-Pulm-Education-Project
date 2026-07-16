/**
 * Loader for the cross-modal identify quiz's endoscopic still frames.
 *
 * The JPGs and this manifest are generated offline by
 * scripts/airway-lesson/extract-quiz-frames.py from the annotated survey: for
 * each airway structure it picks the frame where the structure is clearest,
 * crops to the scope image, and records the outline polygon. The quiz shows the
 * real endoscopic photo (outlined but unlabeled) next to the CT slice and the 3D
 * highlight, and asks the learner to name the airway.
 */
import { getNode } from './airway-graph'
import type { Lobe } from './types'

export const QUIZ_FRAMES_URL = '/airway-lesson/airway-quiz-frames.json'

export interface QuizFrameStructure {
  /** Endoscopic still image URL, cropped to the scope field. */
  img: string
  /** Source frame number the still was taken from. */
  frame: number
  /** Outline polygon [x0,y0,x1,y1,…] in the cropped image's pixel space. */
  poly: number[]
  /** Full display name, e.g. "RB2 · Posterior". */
  name: string
  short: string
  lobe: Lobe
  group: string
  /** True when the outline is a distinct orifice; false when the scope fills the airway. */
  isOrifice: boolean
  /** Whether a CT correlation slice exists for this structure. */
  hasCt: boolean
}

export interface QuizFramesData {
  meta: { width: number; height: number; note: string }
  /** Lesson AirwayNode id → its quiz still. */
  structures: Record<string, QuizFrameStructure | undefined>
}

export interface AirwayQuizQuestion {
  target: string
  options: string[]
}

export const QUIZ_EXCLUDED_NODE_IDS = new Set(['lb1', 'lb2'])

function shuffle<T>(arr: T[], random: () => number = Math.random): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function quizPoolOf(data: QuizFramesData): string[] {
  return Object.keys(data.structures).filter(
    (id) => data.structures[id]?.hasCt && getNode(id) && !QUIZ_EXCLUDED_NODE_IDS.has(id),
  )
}

export function buildIdentifyQuestion(
  data: QuizFramesData,
  avoid: string[] = [],
  random: () => number = Math.random,
): AirwayQuizQuestion | null {
  const pool = quizPoolOf(data)
  if (pool.length < 4) return null
  const fresh = pool.filter((id) => !avoid.includes(id))
  const candidates = fresh.length >= 4 ? fresh : pool
  const target = candidates[Math.floor(random() * candidates.length)]
  const group = data.structures[target]?.group
  const sameGroup = pool.filter((id) => id !== target && data.structures[id]?.group === group)
  const others = pool.filter((id) => id !== target && data.structures[id]?.group !== group)
  const distractors = Array.from(
    new Set([...shuffle(sameGroup, random), ...shuffle(others, random)]),
  ).slice(0, 3)
  return { target, options: shuffle([target, ...distractors], random) }
}

let cache: Promise<QuizFramesData> | null = null

/** Load the quiz-frames manifest, memoised at module scope (no caller signal —
 *  see the note in ct-correlation.ts). */
export function loadQuizFrames(): Promise<QuizFramesData> {
  if (cache) return cache
  cache = fetch(QUIZ_FRAMES_URL, { cache: 'force-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load quiz frames: ${res.status}`)
      return res.json() as Promise<QuizFramesData>
    })
    .catch((err) => {
      cache = null
      throw err
    })
  return cache
}
