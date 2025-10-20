import type { Branch } from './types'

export interface BranchGroup {
  key: string
  label: string
  members: string[]
}

export const BRANCH_GROUPS: BranchGroup[] = [
  { key: 'trachea', label: 'Trachea', members: ['Trachea'] },
  {
    key: 'rmb',
    label: 'Right Main Bronchus',
    members: ['Right Mainstem', 'Bronchus Intermedius'],
  },
  { key: 'lmb', label: 'Left Main Bronchus', members: ['Left Mainstem'] },
  {
    key: 'rul',
    label: 'Right Upper Lobe',
    members: ['Right Upper Lobe', 'RB1', 'RB2', 'RB3'],
  },
  {
    key: 'rml',
    label: 'Right Middle Lobe',
    members: ['Right Middle Lobe', 'RB4', 'RB5'],
  },
  {
    key: 'rll',
    label: 'Right Lower Lobe',
    members: ['Right Lower Lobe', 'RB6', 'RB7', 'RB8', 'RB9', 'RB10'],
  },
  {
    key: 'lul',
    label: 'Left Upper Lobe',
    members: [
      'Left Upper Lobe',
      'Left Upper Lobe Upper Division',
      'Lingula',
      'LB1',
      'LB2',
      'LB3',
      'LB4',
      'LB5',
    ],
  },
  {
    key: 'lll',
    label: 'Left Lower Lobe',
    members: ['Left Lower Lobe', 'LB6', 'LB7', 'LB8', 'LB9', 'LB10', 'LB12', 'LB78'],
  },
]

export function groupKeyForLabel(label: string): string {
  for (const group of BRANCH_GROUPS) {
    if (group.members.includes(label)) {
      return group.key
    }
  }
  return 'other'
}

export function ensureGroupAssignment(branches: Branch[]): void {
  const known = new Set<string>()
  for (const group of BRANCH_GROUPS) {
    for (const member of group.members) {
      known.add(member)
    }
  }
  const missing = branches.map((b) => b.label).filter((label) => !known.has(label))
  if (missing.length) {
    console.warn("⚠️ Unassigned labels (defaulting to group 'other'):", missing)
  }
}
