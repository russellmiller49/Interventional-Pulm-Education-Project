import type { EvidenceDesign } from './types'

export const EVIDENCE_DESIGN_LABELS: Readonly<Record<EvidenceDesign, string>> = {
  rct: 'randomised trial',
  'meta-analysis': 'meta-analysis',
  registry: 'registry',
  cohort: 'cohort study',
  guideline: 'guideline',
  consensus: 'consensus statement',
}
