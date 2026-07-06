import { readFileSync } from 'fs'
import path from 'path'

import { AIRWAY_NODES } from '@/data/airway-anatomy-lesson/airway-map'

import type { QuizFramesData } from './airway-quiz'
import {
  buildAirwayAtlas,
  buildFindFrameCandidates,
  buildIndex,
  currentScopeSegmentAt,
  hitTestMarker,
  isAtlasTargetStructure,
  makeStructureChoices,
  markersAtFrame,
  representativeNodeId,
  type OverlayData,
} from './video-atlas'

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), 'utf8')) as T
}

const overlayData = readJson<OverlayData>('public/airway-lesson/airway-survey-overlays.json')
const scopeSegmentData = readJson<OverlayData>(
  'public/airway-lesson/airway-scope-segment-overlays.json',
)
const quizData = readJson<QuizFramesData>('public/airway-lesson/airway-quiz-frames.json')
const ctNodeIds = new Set(
  Object.keys(
    readJson<{ structures: Record<string, unknown> }>('public/airway-lesson/airway-survey-ct.json')
      .structures,
  ),
)

describe('airway video atlas helpers', () => {
  it('uses cropped overlay coordinates for the learner-facing bronchoscopy field', () => {
    expect(overlayData.meta.video).toBe('airway-survey-cropped.mp4')
    expect(overlayData.meta.width).toBe(1368)
    expect(overlayData.meta.height).toBe(1080)
    expect(overlayData.meta.annotationSet).toBe('visible-anatomy')
    expect(overlayData.meta.crop).toEqual({ x: 552, y: 0, width: 1368, height: 1080 })
  })

  it('keeps current-scope-segment annotations separate from visible anatomy targets', () => {
    expect(scopeSegmentData.meta.annotationSet).toBe('current-scope-segment')
    expect(scopeSegmentData.meta.width).toBe(overlayData.meta.width)
    expect(scopeSegmentData.meta.height).toBe(overlayData.meta.height)
    expect(scopeSegmentData.structures.length).toBeLessThan(overlayData.structures.length)

    const scopeIndex = buildIndex(scopeSegmentData)
    expect(currentScopeSegmentAt(scopeIndex, 850)?.structure.node).toBe('rml')
    expect(currentScopeSegmentAt(scopeIndex, 1500)?.structure.node).toBe('lul-upper')
  })

  it('includes upper-airway structures as video-atlas targets without requiring 3D nodes', () => {
    const index = buildIndex(overlayData)
    const earlyMarkers = markersAtFrame(index, 0, { atlasTargetsOnly: true })
    const earlyNames = earlyMarkers.map((marker) => marker.structure.name)

    expect(earlyNames).toEqual(
      expect.arrayContaining([
        'Aryepiglottic fold',
        'Cuneiform tubercle',
        'Corniculate tubercle',
        'Vocal cords',
      ]),
    )
    expect(
      index.structures
        .filter((structure) => structure.group === 'larynx')
        .every((structure) => isAtlasTargetStructure(structure)),
    ).toBe(true)
    expect(
      index.structures.some((structure) => structure.group === 'larynx' && !structure.node),
    ).toBe(true)
  })

  it('builds atlas coverage for every airway node and handles LB1/LB2 explicitly', () => {
    const index = buildIndex(overlayData)
    const atlas = buildAirwayAtlas(index, { quizFrames: quizData, ctNodeIds })
    for (const node of AIRWAY_NODES) {
      expect(atlas[node.id]).toBeDefined()
      expect(atlas[node.id].hasCt).toBe(true)
    }

    expect(representativeNodeId('lb1')).toBe('lb1-2')
    expect(representativeNodeId('lb2')).toBe('lb1-2')
    expect(atlas.lb1.representativeNodeId).toBe('lb1-2')
    expect(atlas.lb2.representativeNodeId).toBe('lb1-2')
    expect(atlas.lb1.quizEligible).toBe(false)
    expect(atlas.lb2.quizEligible).toBe(false)
    expect(atlas.lb1.coverageNote).toMatch(/LB1\+2/)
  })

  it('hit-tests marker dots and falls back to polygon interiors', () => {
    const index = buildIndex(overlayData)
    const rb1Index = index.structures.findIndex((structure) => structure.node === 'rb1')
    const rb1Frame = quizData.structures.rb1?.frame
    expect(rb1Index).toBeGreaterThanOrEqual(0)
    expect(rb1Frame).toBeDefined()

    const marker = markersAtFrame(index, rb1Frame!, { nodeOnly: true }).find(
      (item) => item.structIndex === rb1Index,
    )
    expect(marker).toBeDefined()
    expect(hitTestMarker(index, rb1Frame!, marker!.x, marker!.y)).toBe(rb1Index)
  })

  it('builds same-region-first answer choices without losing the target', () => {
    const index = buildIndex(overlayData)
    const target = index.structures.findIndex((structure) => structure.node === 'rb6')
    const choices = makeStructureChoices(index.structures, target, 4, () => 0.42)
    expect(choices).toContain(target)
    expect(new Set(choices).size).toBe(choices.length)
    expect(choices.length).toBe(4)
  })

  it('finds paused-video frames with multiple clickable airway markers', () => {
    const index = buildIndex(overlayData)
    const candidates = buildFindFrameCandidates(index)
    expect(candidates.length).toBeGreaterThan(20)
    expect(candidates.some((candidate) => candidate.targets.length >= 3)).toBe(true)
  })
})
