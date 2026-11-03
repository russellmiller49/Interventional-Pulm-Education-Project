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

  it('leaves out the CT line only where the lesson gives one side no direction or no plane separates them', () => {
    const withoutCt = everyMissedFork()
      .map(({ abbr, pickedEdgeId }) => debrief(abbr, pickedEdgeId)!)
      .filter((result) => result.ct === null)
      .map((result) => `${result.picked} | ${result.intended}`)
    expect([...new Set(withoutCt)].sort()).toEqual([
      'RB1 | RB2',
      'RB2 | RB1',
      'RB3 | RB1',
      'the LLL basal trunk | LB6',
      'the RB1 / RB2 stem | RB3',
      'the RLL basal trunk | RB6',
      'the RLL basal trunk | RB7',
    ])
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
      ct: null,
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
