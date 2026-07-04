import { AIRWAY_NODES, SURVEY_STEPS } from '@/data/airway-anatomy-lesson/airway-map'

import {
  AIRWAY_BY_ID,
  CHILD_IDS,
  computeDiagramLayout,
  extractSegmentCode,
  getDescendantSegments,
  glbNodeToAirwayId,
  resolveHighlightIds,
} from './airway-graph'

// The 24 node names embedded in public/fluoroview/airway_segments_new.glb.
const GLB_NODE_NAMES = [
  'Trachea.001',
  'Left Mainstem.001',
  'Right Mainstem.001',
  'LLL Posterior Basal Segment (LB10).001',
  'Bronchus Intermedius.001',
  'RML Lateral Segment (RB4).003',
  'RLL Posterior Basal Segment (RB10).001',
  'RUL Posterior Segment (RB2).001',
  'RUL Apical Segment (RB1).001',
  'RUL Anterior Segment (RB3).001',
  'RML Medial Segment (RB5).001',
  'RLL Superior Segment (RB6).001',
  'RLL Medial Basal Segment (RB7).001',
  'RLL Anterior Basal Segment (RB8).001',
  'RLL Lateral Basal Segment (RB9).001',
  'LLL Superior Segment (LB6).001',
  'LLL Anterior Mediasl Basal Segment (LB7+8).001',
  'LLL Lateral Basal Segment (LB9).001',
  'Lingula Inferior Segment (LB5)',
  'Lingula Superior Segment (LB4)',
  'LUL Anterior Segment (LB3).001',
  'LUL Posterior Branch of  Apicalposterior Segment (LB2.001',
  'LUL Apical Branch of  Apicalposterior Segment (LB1).001',
  'Tracheobronchial_tree_full.001',
]

describe('airway-anatomy graph', () => {
  it('has unique node ids', () => {
    const ids = AIRWAY_NODES.map((node) => node.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every parentId points at a real node', () => {
    for (const node of AIRWAY_NODES) {
      if (node.parentId !== null) {
        expect(AIRWAY_BY_ID[node.parentId]).toBeDefined()
      }
    }
  })

  it('has exactly one root', () => {
    const roots = AIRWAY_NODES.filter((node) => node.parentId === null)
    expect(roots).toHaveLength(1)
    expect(roots[0].id).toBe('larynx')
  })

  it('every endoscopic opening references an actual child', () => {
    for (const node of AIRWAY_NODES) {
      if (!node.endoscopicView) continue
      const children = new Set(CHILD_IDS[node.id] ?? [])
      for (const opening of node.endoscopicView.openings) {
        expect(children.has(opening.childId)).toBe(true)
      }
    }
  })

  it('every unique code is well-formed and unique', () => {
    const codes = AIRWAY_NODES.map((node) => node.code).filter(Boolean) as string[]
    expect(new Set(codes).size).toBe(codes.length)
    for (const code of codes) {
      expect(code).toMatch(/^[RL]B\d{1,2}(\+\d{1,2})?$/)
    }
  })

  it('resolves every labeled GLB segment mesh to a node, and ignores the full-tree mesh', () => {
    for (const rawName of GLB_NODE_NAMES) {
      const id = glbNodeToAirwayId(rawName)
      if (rawName.toLowerCase().includes('tracheobronchial')) {
        expect(id).toBeUndefined()
      } else {
        expect(id).toBeDefined()
        expect(AIRWAY_BY_ID[id!]).toBeDefined()
      }
    }
  })

  it('does not mis-tag the full-tree mesh as the trachea', () => {
    expect(glbNodeToAirwayId('Tracheobronchial_tree_full.001')).toBeUndefined()
    expect(glbNodeToAirwayId('Trachea.001')).toBe('trachea')
  })

  it('extractSegmentCode handles fused and unbalanced names', () => {
    expect(extractSegmentCode('LLL Anterior Mediasl Basal Segment (LB7+8).001')).toBe('LB7+8')
    expect(extractSegmentCode('LUL Posterior Branch of  Apicalposterior Segment (LB2.001')).toBe(
      'LB2',
    )
    expect(extractSegmentCode('Trachea.001')).toBeNull()
  })

  it('highlighting a lobar stem lights up its segment meshes', () => {
    // RUL has no mesh of its own → highlights RB1/RB2/RB3.
    expect(resolveHighlightIds('rul')).toEqual(new Set(['rb1', 'rb2', 'rb3']))
    // A segment highlights only itself.
    expect(resolveHighlightIds('rb6')).toEqual(new Set(['rb6']))
    // A central airway with its own mesh highlights only itself.
    expect(resolveHighlightIds('trachea')).toEqual(new Set(['trachea']))
  })

  it('getDescendantSegments reaches the left upper division leaves', () => {
    const ids = getDescendantSegments('lul').map((node) => node.id)
    expect(ids).toEqual(expect.arrayContaining(['lb1', 'lb2', 'lb3', 'lb4', 'lb5']))
  })

  it('lays out one leaf per terminal airway', () => {
    const layout = computeDiagramLayout()
    const leafCount = AIRWAY_NODES.filter((node) => (CHILD_IDS[node.id] ?? []).length === 0).length
    expect(layout.leafCount).toBe(leafCount)
    // All coordinates normalized to [0, 1].
    for (const item of layout.nodes) {
      expect(item.x).toBeGreaterThanOrEqual(0)
      expect(item.x).toBeLessThanOrEqual(1)
      expect(item.y).toBeGreaterThanOrEqual(0)
      expect(item.y).toBeLessThanOrEqual(1)
    }
  })

  it('every survey step targets a real node', () => {
    for (const step of SURVEY_STEPS) {
      expect(AIRWAY_BY_ID[step.nodeId]).toBeDefined()
    }
  })
})
