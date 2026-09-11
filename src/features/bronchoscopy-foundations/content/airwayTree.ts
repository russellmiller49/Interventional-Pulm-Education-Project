import type { Lobe } from '@/lib/airway-anatomy-lesson/types'

import { AIRWAY_LABELS, type AirwayLabel } from '../components/scope/types'
import { MANIFEST_ANATOMY } from '../data/generated/anatomy.generated'

/**
 * The teaching tree: the manifest's 31-node profile `adult-teaching-combined-left-basal-v1`, with
 * ids verbatim, and the bridges to the three other airway vocabularies in this repository.
 *
 * - `label` — the teaching graph's centerline label (the scope engine's vocabulary);
 * - `lessonId` — the airway-anatomy lesson's node id, which keys the endoscopic stills, the CT
 *   correlation slices and the annotated survey video;
 * - `requiredName` — the descriptive name the knowledge specification requires (§6.3, §6.4).
 *
 * The two basal groups are educational groupings, not simultaneous bifurcations, and carry no
 * label. Three rules are enforced at import: A03 (the bronchus intermedius is not a lobe; RB6
 * belongs to the RLL; the lingula belongs to the LUL), A04 (right B4 lateral and B5 medial, left
 * B4 superior and B5 inferior lingular; one declared left basal convention), and A05 (no airway
 * id, label or alias can be read as a lymph-node station).
 */
export interface TeachingTreeNode {
  readonly id: string
  readonly parentId: string | null
  readonly type: 'trachea' | 'bronchus' | 'educational_group' | 'segmental_bronchus'
  readonly side: 'right' | 'left' | null
  readonly manifestLabel: string
  readonly label: AirwayLabel | null
  readonly lessonId: string | null
  readonly requiredName: string
  readonly lobe: Lobe
}

const BRIDGE: Readonly<
  Record<
    string,
    { label: AirwayLabel | null; lessonId: string | null; requiredName: string; lobe: Lobe }
  >
> = {
  TRACHEA: { label: 'TR', lessonId: 'trachea', requiredName: 'Trachea', lobe: 'central' },
  RMB: { label: 'RMSB', lessonId: 'rmb', requiredName: 'Right main bronchus', lobe: 'central' },
  LMB: { label: 'LMSB', lessonId: 'lmb', requiredName: 'Left main bronchus', lobe: 'central' },
  RUL: { label: 'RUL', lessonId: 'rul', requiredName: 'Right upper lobe bronchus', lobe: 'RUL' },
  BI: {
    label: 'BI',
    lessonId: 'bronchus-intermedius',
    requiredName: 'Bronchus intermedius',
    lobe: 'central',
  },
  RML: { label: 'RML', lessonId: 'rml', requiredName: 'Right middle lobe bronchus', lobe: 'RML' },
  RLL: { label: 'RLL', lessonId: 'rll', requiredName: 'Right lower lobe bronchus', lobe: 'RLL' },
  R_BASAL_GROUP: {
    label: null,
    lessonId: null,
    requiredName: 'Right basal group (educational grouping)',
    lobe: 'RLL',
  },
  RB1: { label: 'RB1', lessonId: 'rb1', requiredName: 'Apical', lobe: 'RUL' },
  RB2: { label: 'RB2', lessonId: 'rb2', requiredName: 'Posterior', lobe: 'RUL' },
  RB3: { label: 'RB3', lessonId: 'rb3', requiredName: 'Anterior', lobe: 'RUL' },
  RB4: { label: 'RB4', lessonId: 'rb4', requiredName: 'Lateral', lobe: 'RML' },
  RB5: { label: 'RB5', lessonId: 'rb5', requiredName: 'Medial', lobe: 'RML' },
  RB6: { label: 'RB6', lessonId: 'rb6', requiredName: 'Superior', lobe: 'RLL' },
  RB7: { label: 'RB7', lessonId: 'rb7', requiredName: 'Medial basal', lobe: 'RLL' },
  RB8: { label: 'RB8', lessonId: 'rb8', requiredName: 'Anterior basal', lobe: 'RLL' },
  RB9: { label: 'RB9', lessonId: 'rb9', requiredName: 'Lateral basal', lobe: 'RLL' },
  RB10: { label: 'RB10', lessonId: 'rb10', requiredName: 'Posterior basal', lobe: 'RLL' },
  LUL: { label: 'LUL', lessonId: 'lul', requiredName: 'Left upper lobe bronchus', lobe: 'LUL' },
  LLL: { label: 'LLL', lessonId: 'lll', requiredName: 'Left lower lobe bronchus', lobe: 'LLL' },
  LUL_UPPER: {
    label: 'LUL-UD',
    lessonId: 'lul-upper',
    requiredName: 'Left upper division',
    lobe: 'LUL',
  },
  LINGULA: {
    label: 'LB4+5',
    lessonId: 'lingula',
    requiredName: 'Lingular division',
    lobe: 'lingula',
  },
  L_BASAL_GROUP: {
    label: null,
    lessonId: null,
    requiredName: 'Left basal group (educational grouping)',
    lobe: 'LLL',
  },
  'LB1+2': { label: 'LB1+2', lessonId: 'lb1-2', requiredName: 'Apicoposterior', lobe: 'LUL' },
  LB3: { label: 'LB3', lessonId: 'lb3', requiredName: 'Anterior', lobe: 'LUL' },
  LB4: { label: 'LB4', lessonId: 'lb4', requiredName: 'Superior lingular', lobe: 'lingula' },
  LB5: { label: 'LB5', lessonId: 'lb5', requiredName: 'Inferior lingular', lobe: 'lingula' },
  LB6: { label: 'LB6', lessonId: 'lb6', requiredName: 'Superior', lobe: 'LLL' },
  'LB7+8': { label: 'LB7+8', lessonId: 'lb7-8', requiredName: 'Anteromedial basal', lobe: 'LLL' },
  LB9: { label: 'LB9', lessonId: 'lb9', requiredName: 'Lateral basal', lobe: 'LLL' },
  LB10: { label: 'LB10', lessonId: 'lb10', requiredName: 'Posterior basal', lobe: 'LLL' },
}

export const TEACHING_PROFILE_ID = MANIFEST_ANATOMY.profileId

export const TEACHING_TREE: readonly TeachingTreeNode[] = MANIFEST_ANATOMY.nodes.map((node) => {
  const bridge = BRIDGE[node.id]
  if (!bridge) throw new Error(`The teaching tree has no bridge for manifest node ${node.id}`)
  return {
    id: node.id,
    parentId: node.parentId,
    type: node.type,
    side: node.side,
    manifestLabel: node.label,
    ...bridge,
  }
})

const BY_ID = new Map(TEACHING_TREE.map((node) => [node.id, node] as const))
const BY_LABEL = new Map(
  TEACHING_TREE.flatMap((node) => (node.label ? [[node.label, node] as const] : [])),
)

export function treeNodeByLabel(label: AirwayLabel): TeachingTreeNode {
  const node = BY_LABEL.get(label)
  if (!node) throw new Error(`No teaching-tree node carries ${label}`)
  return node
}

/** The labelled parent of an airway (skipping educational groups), or null at the trachea. */
export function parentLabel(label: AirwayLabel): AirwayLabel | null {
  let parent = BY_ID.get(treeNodeByLabel(label).parentId ?? '')
  while (parent && !parent.label) parent = BY_ID.get(parent.parentId ?? '')
  return parent?.label ?? null
}

/** Labels from the trachea down to this airway. */
export function labelAncestry(label: AirwayLabel): readonly AirwayLabel[] {
  const chain: AirwayLabel[] = [label]
  let current = parentLabel(label)
  while (current) {
    chain.unshift(current)
    current = parentLabel(current)
  }
  return chain
}

/** "RB4 · Right middle lobe, lateral" — the display a pin, a ledger row and a caption share. */
export function airwayDisplayName(label: AirwayLabel): string {
  const node = treeNodeByLabel(label)
  if (node.type !== 'segmental_bronchus') return node.requiredName
  const lobeWords: Readonly<Record<Lobe, string>> = {
    central: '',
    RUL: 'Right upper lobe',
    RML: 'Right middle lobe',
    RLL: 'Right lower lobe',
    LUL: 'Left upper lobe',
    lingula: 'Lingula',
    LLL: 'Left lower lobe',
  }
  return `${label} · ${lobeWords[node.lobe]}, ${node.requiredName.toLowerCase()}`
}

const STATION = /^(station\s*)?(1[0-4]|[1-9])\s*[RL]?$/i

export function validateTeachingTree(): readonly string[] {
  const errors: string[] = []
  const parent = (id: string) => BY_ID.get(id)?.parentId
  if (parent('BI') !== 'RMB')
    errors.push('A03: the bronchus intermedius must arise from the right main bronchus.')
  if (BY_ID.get('BI')?.type !== 'bronchus')
    errors.push('A03: the bronchus intermedius is a bronchus, not a lobe.')
  if (parent('RB6') !== 'RLL') errors.push('A03: RB6 belongs to the right lower lobe.')
  if (parent('LINGULA') !== 'LUL') errors.push('A03: the lingula belongs to the left upper lobe.')
  if (!BY_ID.has('RML')) errors.push('A03: the right middle lobe is part of every complete survey.')
  const names: Readonly<Record<string, string>> = {
    RB4: 'Lateral',
    RB5: 'Medial',
    LB4: 'Superior lingular',
    LB5: 'Inferior lingular',
  }
  for (const [id, name] of Object.entries(names)) {
    if (BY_ID.get(id)?.requiredName !== name) errors.push(`A04: ${id} must be named ${name}.`)
  }
  if (BY_ID.has('LB7') || BY_ID.has('LB8'))
    errors.push(
      'A04: this profile declares combined LB7+8; separate LB7 or LB8 needs its own profile.',
    )
  const labels = TEACHING_TREE.flatMap((node) => (node.label ? [node.label] : []))
  if (new Set(labels).size !== labels.length)
    errors.push('Two teaching-tree nodes carry the same label.')
  for (const label of AIRWAY_LABELS) {
    if (!labels.includes(label)) errors.push(`The airway label ${label} has no teaching-tree node.`)
  }
  for (const node of TEACHING_TREE) {
    for (const value of [
      node.id,
      node.label ?? '',
      ...MANIFEST_ANATOMY.nodes.find((n) => n.id === node.id)!.aliases,
    ]) {
      if (value && STATION.test(value))
        errors.push(`A05: ${node.id} carries "${value}", which reads as a lymph-node station.`)
    }
    if (node.parentId && !BY_ID.has(node.parentId))
      errors.push(`${node.id} has an unknown parent ${node.parentId}.`)
  }
  return errors
}

const treeErrors = validateTeachingTree()
if (treeErrors.length > 0)
  throw new Error(`The teaching tree is invalid:\n${treeErrors.join('\n')}`)
