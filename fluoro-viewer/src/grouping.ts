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
    members: [
      'Right Upper Lobe',
      'Right upper Lobe (full)',
      'RUL Apical Segment (RB1)',
      'RUL Posterior Segment (RB2)',
      'RUL Anterior Segment (RB3)',
    ],
  },
  {
    key: 'rml',
    label: 'Right Middle Lobe',
    members: [
      'Right Middle Lobe',
      'Right Middle Lobe (full)',
      'RML Lateral Segment (RB4)',
      'RML Medial Segment (RB5)',
    ],
  },
  {
    key: 'rll',
    label: 'Right Lower Lobe',
    members: [
      'Right Lower Lobe',
      'RLL Superior Segment (RB6)',
      'RLL Medial Basal Segment (RB7)',
      'RLL Anterior Basal Segment (RB8)',
      'RLL Lateral Basal Segment (RB9)',
      'RLL Posterior Basal Segment (RB10)',
    ],
  },
  {
    key: 'lul',
    label: 'Left Upper Lobe',
    members: [
      'Left Upper Lobe',
      'Left Upper Lobe Upper Division',
      'LUL Apicalposterior Segment (LB1+2)',
      'LUL Anterior Segment (LB3)',
      'LUL Apical Branch of Apicalposterior Segment (LB1)',
      'LUL Posterior Branch of Apicalposterior Segment (LB2',
      'Lingula',
      'Lingula Lateral Segment (LB4)',
      'Lingula Medial Segment (LB5)',
    ],
  },
  {
    key: 'lll',
    label: 'Left Lower Lobe',
    members: [
      'Left Lower Lobe',
      'LLL Superior Segment (LB6)',
      'LLL Anterior Mediasl Basal Segment (LB7+8)',
      'LLL Mediasl Branch of Anteriormedial Basal Segment (LB7)',
      'LLL Anteror Branch of Anteriormedial Basal Segment (LB8)',
      'LLL Lateral Basal Segment (LB9)',
      'LLL Posterior Basal Segment (LB10)',
    ],
  },
]

export function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function groupKeyForLabel(label: string): string {
  const normalized = normalizeLabel(label)
  for (const group of BRANCH_GROUPS) {
    if (group.members.some((member) => normalizeLabel(member) === normalized)) {
      return group.key
    }
  }
  return 'other'
}

export function ensureGroupAssignment(items: { label: string }[]): void {
  const known = new Set<string>()
  for (const group of BRANCH_GROUPS) {
    for (const member of group.members) {
      known.add(normalizeLabel(member))
    }
  }
  const missing = items
    .map((item) => normalizeLabel(item.label))
    .filter((label) => !known.has(label))
  if (missing.length) {
    console.warn("⚠️ Unassigned labels (defaulting to group 'other'):", missing)
  }
}
