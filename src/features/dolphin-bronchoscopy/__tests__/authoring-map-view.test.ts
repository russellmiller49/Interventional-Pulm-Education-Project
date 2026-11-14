/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'

import { dolphinFrameById } from '../content/frameBank'
import { DOLPHIN_SCOPE_STARTS } from '../content/scopeStarts'
import { belowTheLarynx } from '../content/sections/below-the-larynx'
import { findingANamedBranch } from '../content/sections/finding-a-named-branch'
import { readingThePicture } from '../content/sections/reading-the-picture'
import { sameInEveryDolphin } from '../content/sections/same-in-every-dolphin'
import { theNumberedMap } from '../content/sections/the-numbered-map'
import { precommitSurfaces, validateDolphinSection } from '../content/stageLessons'
import { toDolphinClinicalItem } from '../content/stageItems'
import { dolphinDrillSetById } from '../content/branchDrillSets'
import type { DolphinSectionDefinition } from '../content/types'

const caseDir = path.join(process.cwd(), 'public/airway-anatomy/dolphin-001/metadata')
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(caseDir, file), 'utf8'))
const airwayGraph = read('airway_graph.json') as { edges: { id: number; lengthMm: number }[] }
const centerlineLabels = read('centerline_labels.json') as {
  edgeLabels: Record<string, { abbreviatedLabel: string }>
}

const SECTIONS: readonly DolphinSectionDefinition[] = [
  belowTheLarynx,
  theNumberedMap,
  sameInEveryDolphin,
  readingThePicture,
  findingANamedBranch,
]

it.each(SECTIONS)('$id validates', (section) => {
  expect(validateDolphinSection(section)).toEqual([])
  toDolphinClinicalItem(section.id, section.prediction, 'predict')
  toDolphinClinicalItem(section.id, section.transfer, 'transfer')
  for (const c of section.practice) toDolphinClinicalItem(section.id, c.item, 'predict')
})

it.each(SECTIONS)(
  '$id keeps its keyed answer off the pre-commit surfaces, frame alt text included',
  (section) => {
    const frameIds = [section.prediction.media?.frameId].filter((id): id is string => Boolean(id))
    const alts = frameIds.map((id) => dolphinFrameById.get(id)?.preCommitAlt ?? '')
    const text = [...precommitSurfaces(section).map((s) => s.text), ...alts].join('\n')
    for (const pattern of section.precommitDenyPatterns) expect(text).not.toMatch(pattern)
  },
)

it('names only frames the bank has, and every identify answer is one of its choices', () => {
  if (readingThePicture.act.kind !== 'identify')
    throw new Error('reading-the-picture is an identify act')
  const rows = readingThePicture.act.identify.rows
  expect(rows.length).toBeGreaterThanOrEqual(4)
  for (const row of rows) {
    expect(dolphinFrameById.has(row.frameId)).toBe(true)
    expect(row.choices.length).toBeGreaterThanOrEqual(3)
    expect(row.choices.length).toBeLessThanOrEqual(5)
    expect(row.choices.map((c) => c.id)).toContain(row.answerId)
  }
  expect(dolphinFrameById.has('carina')).toBe(true)
})

it('poses each new frame on an edge that carries its location label', () => {
  const labels = centerlineLabels.edgeLabels
  for (const id of ['rmb-rb1', 'lmb-lb2']) {
    const frame = dolphinFrameById.get(id)!
    expect(frame.rights.kind).toBe('simulator-render')
    if (frame.rights.kind !== 'simulator-render') continue
    const pose = frame.rights.pose
    if ('start' in pose) {
      expect(DOLPHIN_SCOPE_STARTS[pose.start].abbr).toBe(frame.location)
      continue
    }
    const edge = airwayGraph.edges.find((e) => e.id === pose.edgeId)!
    expect(labels[String(pose.edgeId)].abbreviatedLabel).toBe(frame.location)
    expect(pose.distanceMm).toBeGreaterThan(0)
    expect(pose.distanceMm).toBeLessThan(edge.lengthMm)
  }
})

it('drills a set that exists', () => {
  if (findingANamedBranch.act.kind !== 'branch-drill')
    throw new Error('finding-a-named-branch is a drill')
  const set = dolphinDrillSetById.get(findingANamedBranch.act.set)
  expect(set?.start).toBe('carina')
  expect(findingANamedBranch.act.count).toBeLessThanOrEqual(set!.targets.length)
})
