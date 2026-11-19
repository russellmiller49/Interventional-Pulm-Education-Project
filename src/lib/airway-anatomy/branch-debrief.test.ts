/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'

import { buildGameTargets } from './airway-game'
import { buildBranchDebrief, missedBranchEdgeId } from './branch-debrief'
import { createGraphIndex } from './scope-state'
import type { AirwayAnatomyCaseManifest, AirwayGraph, CenterlineLabels } from './types'

const read = (file: string) =>
  JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'public/airway-anatomy/case-001', file), 'utf8'),
  )
const graph = read('metadata/airway_graph.json') as AirwayGraph
const labels = read('metadata/centerline_labels.json') as CenterlineLabels
const manifest = read('case_manifest.json') as AirwayAnatomyCaseManifest
const index = createGraphIndex(graph)
const targets = buildGameTargets(graph, labels)
const target = (abbr: string) => targets.find((entry) => entry.abbr === abbr)!

const debrief = (abbr: string, pickedEdgeId: number) =>
  buildBranchDebrief({
    index,
    labels,
    ostialLandmarks: manifest.ostialLandmarks,
    target: target(abbr),
    pickedEdgeId,
  })

/** Every branch a learner can enter off the route, before reaching each Bronch Quest target. */
function everyMissedFork() {
  const forks: Array<{ abbr: string; pickedEdgeId: number }> = []
  for (const entry of targets) {
    for (const edgeId of entry.pathEdgeIds) {
      if (entry.edgeIds.includes(edgeId)) break
      const node = index.nodesById.get(index.edgesById.get(edgeId)!.endNodeId)!
      for (const child of node.childEdgeIds) {
        if (!entry.pathEdgeIds.includes(child) && !entry.edgeIds.includes(child)) {
          forks.push({ abbr: entry.abbr, pickedEdgeId: child })
        }
      }
    }
  }
  return forks
}

describe('branch debrief on case-001', () => {
  it('gives every fork on every route a named branch pair and a scope landmark', () => {
    const forks = everyMissedFork()
    expect(forks.length).toBeGreaterThan(60)
    for (const { abbr, pickedEdgeId } of forks) {
      const result = debrief(abbr, pickedEdgeId)
      expect(result).not.toBeNull()
      expect(result!.picked).not.toMatch(/edge|node|branch \d/i)
      expect(result!.intended).not.toEqual(result!.picked)
      expect(result!.scope).toMatch(/at 12/)
      for (const line of [result!.picked, result!.intended, result!.scope, result!.ct ?? '']) {
        expect(line).not.toMatch(/\b(correct|incorrect|wrong)\b/i)
      }
    }
  })

  it('gives every fork on every route a CT line (owner ruling sync-missing-ct-cues)', () => {
    const withoutCt = everyMissedFork()
      .map(({ abbr, pickedEdgeId }) => debrief(abbr, pickedEdgeId)!)
      .filter((result) => result.ct === null)
      .map((result) => `${result.picked} | ${result.intended}`)
    expect([...new Set(withoutCt)]).toEqual([])
  })

  it('supplies the seven cues that were missing, on the plane that separates each pair', () => {
    const lines = Object.fromEntries(
      everyMissedFork()
        .map(({ abbr, pickedEdgeId }) => debrief(abbr, pickedEdgeId)!)
        .map((result) => [`${result.picked} | ${result.intended}`, result.ct]),
    )
    const SAGITTAL = 'Sagittal, anterior on the image left: '
    // The right upper lobe's three segments run up, back and forward.
    expect(lines['RB1 | RB2']).toBe(
      SAGITTAL + 'RB2 toward the image right · RB1 toward the image top',
    )
    expect(lines['RB2 | RB1']).toBe(
      SAGITTAL + 'RB1 toward the image top · RB2 toward the image right',
    )
    expect(lines['RB3 | RB1']).toBe(
      SAGITTAL + 'RB1 toward the image top · RB3 toward the image left',
    )
    expect(lines['the RB1 / RB2 stem | RB3']).toBe(
      SAGITTAL +
        'RB3 toward the image left · RB1 toward the image top · RB2 toward the image right',
    )
    // The superior segments run back while the basal trunk continues down.
    expect(lines['the RLL basal trunk | RB6']).toBe(
      SAGITTAL + 'RB6 toward the image right · RLL basal trunk toward the image bottom',
    )
    expect(lines['the LLL basal trunk | LB6']).toBe(
      SAGITTAL + 'LB6 toward the image right · LLL basal trunk toward the image bottom',
    )
    // RB7 leaves medially; what is left of the trunk runs down and laterally.
    expect(lines['the RLL basal trunk | RB7']).toBe(
      'Axial: RB7 toward the image right · RLL basal trunk toward the image left',
    )
  })

  it('keeps the plane a pair already had: sagittal is used only where axial and coronal fail', () => {
    const sagittal = everyMissedFork()
      .map(({ abbr, pickedEdgeId }) => debrief(abbr, pickedEdgeId)!)
      .filter((result) => result.ct?.startsWith('Sagittal'))
      .map((result) => `${result.picked} | ${result.intended}`)
    expect([...new Set(sagittal)].sort()).toEqual([
      'RB1 | RB2',
      'RB2 | RB1',
      'RB3 | RB1',
      'the LLL basal trunk | LB6',
      'the RB1 / RB2 stem | RB3',
      'the RLL basal trunk | RB6',
    ])
  })

  /*
   * The directions behind the new cues, held against this case's own centrelines (LPS: +x the
   * patient's left, +y posterior, +z superior). Each named branch must run mainly the way its cue
   * says over its first 10 mm: the cue is anatomy the CT in front of the learner actually shows.
   */
  it('agrees with the case’s centrelines at each of the four forks', () => {
    const AXES = {
      right: [-1, 0, 0],
      left: [1, 0, 0],
      anterior: [0, -1, 0],
      posterior: [0, 1, 0],
      superior: [0, 0, 1],
      inferior: [0, 0, -1],
    } as const
    const along = (edgeId: number, toward: (keyof typeof AXES)[]) => {
      const points = index.edgesById.get(edgeId)!.pointsLps
      let travelled = 0
      let end = points[points.length - 1]
      for (let i = 1; i < points.length; i += 1) {
        travelled += Math.hypot(...points[i].map((value, axis) => value - points[i - 1][axis]))
        if (travelled >= 10) {
          end = points[i]
          break
        }
      }
      const run = end.map((value, axis) => value - points[0][axis])
      const length = Math.hypot(...run)
      const sum = toward.reduce(
        (acc, name) => acc.map((value, axis) => value + AXES[name][axis]),
        [0, 0, 0],
      )
      const size = Math.hypot(...sum)
      return run.reduce((acc, value, axis) => acc + (value / length) * (sum[axis] / size), 0)
    }
    const label = (edgeId: number) => labels.edgeLabels[String(edgeId)]?.abbreviatedLabel
    // Right upper lobe: RB1 up, RB2 back, RB3 forward.
    expect([label(13), label(12), label(7)]).toEqual(['RB1', 'RB2', 'RB3'])
    expect(along(13, ['superior'])).toBeGreaterThan(0.7)
    expect(along(12, ['posterior'])).toBeGreaterThan(0.7)
    expect(along(7, ['anterior'])).toBeGreaterThan(0.7)
    // Right lower lobe: RB6 back, the trunk past it down; RB7 medial, the trunk past it down and lateral.
    expect([label(17), label(16), label(35), label(34)]).toEqual(['RB6', 'RLL', 'RB7', 'RLL'])
    expect(along(17, ['posterior'])).toBeGreaterThan(0.7)
    expect(along(16, ['inferior'])).toBeGreaterThan(0.7)
    expect(along(35, ['left'])).toBeGreaterThan(0.5)
    expect(along(34, ['inferior', 'right'])).toBeGreaterThan(0.7)
    // Left lower lobe: LB6 back, the trunk past it down.
    expect([label(10), label(11)]).toEqual(['LB6', 'LLL'])
    expect(along(10, ['posterior'])).toBeGreaterThan(0.7)
    expect(along(11, ['inferior'])).toBeGreaterThan(0.7)
  })

  it('names the reviewed upper-division ostium and the RUL connector as the in-view labels do', () => {
    expect(debrief('LB4', 21)).toMatchObject({
      picked: 'the upper division',
      intended: 'LB4+5',
      target: 'LB4',
      ct: 'Coronal: LB4+5 toward the image bottom · upper division toward the image top',
    })
    expect(debrief('RB3', 6)).toMatchObject({
      picked: 'the RB1 / RB2 stem',
      intended: 'RB3',
      scope:
        "Looking into the RUL, head at 12: RB3 anterior, 8 o'clock · RB1 superior, 12 o'clock · RB2 posterior, 4 o'clock",
      ct: 'Sagittal, anterior on the image left: RB3 toward the image left · RB1 toward the image top · RB2 toward the image right',
    })
  })

  it('reports the fork where the route was left, however deep the scope has gone since', () => {
    // Three generations into RB4 (edge 18), the miss is still RB4 at the RML fork.
    let deepRb4Edge = 18
    for (let generation = 0; generation < 3; generation += 1) {
      const end = index.nodesById.get(index.edgesById.get(deepRb4Edge)!.endNodeId)!
      deepRb4Edge = end.childEdgeIds[0]
    }
    expect(labels.edgeLabels[String(deepRb4Edge)]?.abbreviatedLabel).toBe('RB4')
    expect(missedBranchEdgeId(target('RB5'), deepRb4Edge, index)).toBe(18)
    // Sent to RB6, the same tip left the route earlier, at the end of the bronchus intermedius.
    expect(missedBranchEdgeId(target('RB6'), deepRb4Edge, index)).toBe(9)
  })
})
