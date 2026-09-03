import type { SupportMode } from '../engine/types'
import {
  ecmoCircuitSegmentIds,
  resolveEcmoModeText,
  type EcmoCircuitSegmentId,
  type EcmoModeText,
} from './circuitSegments'

/**
 * Where each circuit segment already has a label in the bedside scene.
 *
 * The seam a later circuit walk needs is small: given a segment, which things in the 3D scene are
 * that segment. It is a table of label ids and nothing else — no vectors, no camera, no three.js
 * import — so this file stays as pure as the rest of `content/`, and the scene keeps owning its own
 * geometry. `circuit-segment-model.test.ts` checks every id here against
 * `buildCircuitLayout(mode).labels`, which is where three.js is allowed in.
 *
 * Two facts the table records rather than hides:
 *
 * The pump, both pressure locations either side of it, and the membrane's gas side all resolve to
 * `hls-module`. That is not a gap in the mapping — on this device they are one integrated
 * disposable, and a walk stop at the pump and a walk stop at the membrane are two stops on the same
 * physical object. A package that wants them lit separately has to add scene anchors first, which
 * is an R3 decision with a geometry contract attached (`bedside-scene-geometry.test.ts` requires
 * every anchor to sit clear of every other), not something to paper over here.
 *
 * The distal perfusion catheter exists only under VA, so it is declared separately rather than
 * being filtered out of a shared list at every call site.
 */
export interface EcmoSegmentSceneAnchors {
  readonly segmentId: EcmoCircuitSegmentId
  /** Scene label ids present in both tracks. */
  readonly sceneLabelIds: readonly string[]
  /** Scene label ids the VA scene builds and the VV scene does not. */
  readonly vaOnlySceneLabelIds?: readonly string[]
}

export const ecmoSegmentSceneAnchors: readonly EcmoSegmentSceneAnchors[] = Object.freeze([
  { segmentId: 'patient', sceneLabelIds: ['drainage-site', 'return-site'] },
  { segmentId: 'drainage', sceneLabelIds: ['drainage-site', 'drainage-clamp'] },
  { segmentId: 'pump', sceneLabelIds: ['hls-module'] },
  { segmentId: 'pre-membrane', sceneLabelIds: ['hls-module'] },
  { segmentId: 'membrane', sceneLabelIds: ['hls-module'] },
  { segmentId: 'post-membrane', sceneLabelIds: ['sensor'] },
  {
    segmentId: 'return',
    sceneLabelIds: ['return-site', 'return-clamp'],
    vaOnlySceneLabelIds: ['dpc'],
  },
  { segmentId: 'gas-supply', sceneLabelIds: ['sweep'] },
  { segmentId: 'membrane-gas-side', sceneLabelIds: ['hls-module'] },
])

/**
 * What each scene label says, kept here rather than in the scene that draws it.
 *
 * The bedside scene authored these strings inline next to the vectors that place them, which was
 * fine while the scene was the only thing that said them out loud. It is not any more: the circuit
 * walk has to tell a learner in words which object it has just lit, because the scene hides its
 * labels entirely on a compact viewport and lets anyone switch them off at any width. Printing the
 * label *ids* there — `drainage-site · drainage-clamp` — is not text a learner can read, and
 * writing the names out a second time in the walk would be two copies of one vocabulary.
 *
 * So the words move to the seam and the scene reads them back. `layout.ts` still owns every
 * position; it no longer owns any prose. `console` is here without being any segment's anchor,
 * because the scene labels it and a caller asking what a label says should get an answer.
 */
export const ecmoSceneLabelText: Readonly<Record<string, EcmoModeText>> = Object.freeze({
  'drainage-site': 'Femoral vein — drainage',
  'return-site': {
    vv: 'Femoral vein — return · tip toward right atrium',
    va: 'Femoral artery — return',
  },
  dpc: 'Distal perfusion catheter',
  'drainage-clamp': 'Drainage clamp',
  'return-clamp': 'Return clamp',
  'hls-module': 'HLS module — pump + oxygenator',
  sensor: 'Flow / bubble sensor',
  sweep: 'Air–O₂ blender — sweep-gas source',
  console: 'CARDIOHELP console',
})

export function ecmoSceneLabelName(labelId: string, supportMode: SupportMode): string {
  const text = ecmoSceneLabelText[labelId]
  if (!text) throw new Error(`No text declared for ECMO scene label: ${labelId}`)
  return resolveEcmoModeText(text, supportMode)
}

const anchorsBySegmentId: ReadonlyMap<EcmoCircuitSegmentId, EcmoSegmentSceneAnchors> = new Map(
  ecmoSegmentSceneAnchors.map((anchor) => [anchor.segmentId, anchor]),
)

export function ecmoSceneLabelIdsForSegment(
  segmentId: EcmoCircuitSegmentId,
  supportMode: SupportMode,
): readonly string[] {
  const anchor = anchorsBySegmentId.get(segmentId)
  if (!anchor) throw new Error(`No scene anchors declared for ECMO circuit segment: ${segmentId}`)
  if (supportMode !== 'va' || !anchor.vaOnlySceneLabelIds) return anchor.sceneLabelIds
  return [...anchor.sceneLabelIds, ...anchor.vaOnlySceneLabelIds]
}

export function validateEcmoSegmentSceneAnchors(): readonly string[] {
  const errors: string[] = []
  const declared = ecmoSegmentSceneAnchors.map((anchor) => anchor.segmentId)

  if (new Set(declared).size !== declared.length) errors.push('a segment is declared twice')
  for (const segmentId of ecmoCircuitSegmentIds) {
    if (!declared.includes(segmentId)) errors.push(`no scene anchors declared for ${segmentId}`)
  }
  for (const anchor of ecmoSegmentSceneAnchors) {
    if (!(ecmoCircuitSegmentIds as readonly string[]).includes(anchor.segmentId)) {
      errors.push(`anchors declared for unknown segment ${anchor.segmentId}`)
    }
    if (anchor.sceneLabelIds.length === 0) {
      errors.push(`${anchor.segmentId}: declared with no scene label`)
    }
    for (const labelId of anchor.vaOnlySceneLabelIds ?? []) {
      // Listing the same label twice would light it twice under VA and never under VV.
      if (anchor.sceneLabelIds.includes(labelId)) {
        errors.push(`${anchor.segmentId}: ${labelId} is declared both shared and VA-only`)
      }
    }
    // An anchor with no words is an anchor a lesson cannot name, which is the whole point of the
    // table above: the walk tells a learner what it has lit even when the scene cannot.
    for (const labelId of [...anchor.sceneLabelIds, ...(anchor.vaOnlySceneLabelIds ?? [])]) {
      if (!ecmoSceneLabelText[labelId]) {
        errors.push(`${anchor.segmentId}: ${labelId} has no declared text`)
      }
    }
  }

  for (const [labelId, text] of Object.entries(ecmoSceneLabelText)) {
    for (const supportMode of ['vv', 'va'] as const) {
      if (resolveEcmoModeText(text, supportMode).length === 0) {
        errors.push(`${labelId}: no ${supportMode} text`)
      }
    }
  }

  return errors
}

const sceneAnchorErrors = validateEcmoSegmentSceneAnchors()
if (sceneAnchorErrors.length > 0) {
  throw new Error(`Invalid ECMO segment scene anchors:\n- ${sceneAnchorErrors.join('\n- ')}`)
}
