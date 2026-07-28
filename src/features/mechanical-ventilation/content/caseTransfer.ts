const caseTransferPairs = {
  'MV-01': 'MV-14',
  'MV-02': 'MV-11',
  'MV-03': 'MV-04',
  'MV-04': 'MV-03',
  'MV-05': 'MV-06',
  'MV-06': 'MV-05',
  'MV-07': 'MV-08',
  'MV-08': 'MV-07',
  'MV-09': 'MV-10',
  'MV-10': 'MV-09',
  'MV-11': 'MV-02',
  'MV-12': 'MV-15',
  'MV-13': 'MV-14',
  'MV-14': 'MV-13',
  'MV-15': 'MV-12',
} as const

export const ventilationCaseTransferById: ReadonlyMap<string, string> = new Map(
  Object.entries(caseTransferPairs),
)

export function selectVentilationTransferCaseId(caseId: string): string | null {
  return ventilationCaseTransferById.get(caseId) ?? null
}
