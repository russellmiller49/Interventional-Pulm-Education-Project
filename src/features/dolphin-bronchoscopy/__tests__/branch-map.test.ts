/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'

import type { AirwayGraph, CenterlineLabels } from '@/lib/airway-anatomy/types'

import { DOLPHIN_BRANCH_MAP, branchMapByAbbr } from '../content/branchMap'
import { DOLPHIN_SCOPE_STARTS } from '../content/scopeStarts'
import { DOLPHIN_DRILL_SETS, drillTierOf } from '../content/branchDrillSets'
import { DOLPHIN_REPORT_TEMPLATES } from '../content/reportForm'

const caseDir = path.join(process.cwd(), 'public/airway-anatomy/dolphin-001/metadata')
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(caseDir, file), 'utf8'))
const review = read('geometry-review.json') as {
  LMBBranches: { label: string; edgeId: number; fromCarinaMm: number; direction: string }[]
  RMBBranches: { label: string; edgeId: number; fromCarinaMm: number; direction: string }[]
  trachealBronchusDivisions: Record<string, number>
  carinaNodeId: number
}
const labels = read('centerline_labels.json') as CenterlineLabels
const graph = read('airway_graph.json') as AirwayGraph
const abbr = (edgeId: number) => labels.edgeLabels[String(edgeId)]?.abbreviatedLabel

describe('the branch map', () => {
  it('copies this CT’s branches from the geometry review exactly', () => {
    for (const branch of [...review.LMBBranches, ...review.RMBBranches]) {
      const entry = branchMapByAbbr.get(branch.label)!
      expect(entry.thisCt).toEqual({
        present: true,
        edgeId: branch.edgeId,
        fromCarinaMm: branch.fromCarinaMm,
        direction: branch.direction,
      })
      expect(abbr(branch.edgeId)).toBe(branch.label)
    }
    for (const [label, edgeId] of Object.entries(review.trachealBronchusDivisions)) {
      expect(branchMapByAbbr.get(label)!.thisCt.edgeId).toBe(edgeId)
      expect(abbr(edgeId)).toBe(label)
    }
    expect(review.LMBBranches).toHaveLength(14)
    expect(review.RMBBranches).toHaveLength(13)
  })

  it('names RB14 as absent from this CT and present in the series', () => {
    const rb14 = branchMapByAbbr.get('RB14')!
    expect(rb14.thisCt.present).toBe(false)
    expect(rb14.variation.note).toMatch(/Not traced on this module’s CT/)
    expect(Object.values(labels.edgeLabels).some((info) => info?.abbreviatedLabel === 'RB14')).toBe(
      false,
    )
  })

  it('pairs only branches whose origins lie within 10 mm on this CT', () => {
    for (const entry of DOLPHIN_BRANCH_MAP) {
      if (!entry.arisesWith) continue
      const other = branchMapByAbbr.get(entry.arisesWith)!
      expect(other.arisesWith).toBe(entry.abbr)
      expect(
        Math.abs((entry.thisCt.fromCarinaMm ?? 0) - (other.thisCt.fromCarinaMm ?? 0)),
      ).toBeLessThanOrEqual(10)
    }
  })

  it('teaches variation as counts, never percentages', () => {
    for (const entry of DOLPHIN_BRANCH_MAP) expect(entry.variation.note).not.toMatch(/%|percent/)
  })

  it('names every label on the CT except the fornix in a drill tier', () => {
    const all = new Set(Object.values(labels.edgeLabels).map((info) => info!.abbreviatedLabel))
    expect(all.size).toBe(40)
    for (const label of all) {
      if (label === 'NPF') expect(drillTierOf(label)).toBeNull()
      else expect(drillTierOf(label)).not.toBeNull()
    }
    for (const set of DOLPHIN_DRILL_SETS)
      for (const target of set.targets) expect(all.has(target)).toBe(true)
  })
})

describe('the scope starts', () => {
  it('sit on the labels they claim, inside their edges', () => {
    for (const start of Object.values(DOLPHIN_SCOPE_STARTS)) {
      expect(abbr(start.edgeId)).toBe(start.abbr)
      const edge = graph.edges.find((candidate) => candidate.id === start.edgeId)!
      expect(start.distanceMm).toBeGreaterThanOrEqual(0)
      expect(start.distanceMm).toBeLessThanOrEqual(edge.lengthMm)
    }
    const carinaEdge = graph.edges.find((edge) => edge.id === DOLPHIN_SCOPE_STARTS.carina.edgeId)!
    expect(carinaEdge.endNodeId).toBe(review.carinaNodeId)
  })
})

describe('the record form', () => {
  it('holds the 2019 form’s sites and only its return volume', () => {
    const form = DOLPHIN_REPORT_TEMPLATES['nmmp-2019']
    expect(form.sites.map((site) => site.abbr)).toEqual([
      'TRA',
      'RTB',
      'RMB',
      'LMB',
      ...Array.from({ length: 9 }, (_, i) => `RB${i + 1}`),
      ...Array.from({ length: 9 }, (_, i) => `LB${i + 1}`),
    ])
    expect(form.recordsInstilled).toBe(false)
    expect(form.balReturnEntries).toBe(3)
  })
})
