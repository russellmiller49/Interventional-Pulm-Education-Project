/** @jest-environment node */
import {
  COORDINATOR_RISK_FLAGS,
  evaluateCoordinatorRiskFlags,
  type RiskScanFields,
} from './risk-lexicon'

function fields(overrides: Partial<RiskScanFields> = {}): RiskScanFields {
  return {
    title: 'Genome-wide association of coffee consumption preferences',
    abstract: 'We analysed beverage choice in a population cohort.',
    journal: 'Journal of Synthetic Genetics',
    meshTerms: [],
    keywords: [],
    publicationTypes: ['Journal Article'],
    ...overrides,
  }
}

describe('coordinator risk lexicon', () => {
  it('flags nothing on a clearly out-of-domain record', () => {
    expect(evaluateCoordinatorRiskFlags(fields())).toEqual([])
  })

  const cases: readonly [string, Partial<RiskScanFields>][] = [
    ['signal_pulmonary', { title: 'Pulmonary function after exposure' }],
    ['signal_thoracic', { title: 'A transthoracic approach to biopsy' }],
    ['signal_airway', { title: 'Tracheal stenosis in adults' }],
    ['signal_pleural', { title: 'Recurrent pleural effusion management' }],
    ['signal_lung_cancer', { title: 'Screening for lung cancer with biomarkers' }],
    ['signal_mediastinal', { title: 'Mediastinal lymph node staging' }],
    ['signal_bronchoscopy', { title: 'EBUS in clinical practice' }],
    ['signal_pulmonary_procedure', { title: 'Outcomes after tracheostomy' }],
    ['signal_thoracic_oncology', { title: 'Malignant pleural mesothelioma trends' }],
    ['signal_respiratory_failure', { title: 'Mechanical ventilation strategies' }],
    ['signal_critical_care', { title: 'Sepsis outcomes in the ICU' }],
    ['signal_anesthesia', { title: 'One-lung ventilation techniques' }],
    ['signal_pathology', { title: 'Fine-needle aspiration adequacy' }],
    ['signal_imaging', { title: 'Chest CT findings in screening' }],
    ['signal_procedural_complication', { title: 'Massive hemoptysis after intervention' }],
    ['signal_legacy_terminology', { title: 'Thoracoplasty in the sanatorium era' }],
  ]
  it.each(cases)('%s fires on its domain', (flag, overrides) => {
    const flags = evaluateCoordinatorRiskFlags(fields(overrides))
    expect(flags).toContain(flag)
  })

  it('scans mesh terms, keywords, and journal names, not only title and abstract', () => {
    expect(evaluateCoordinatorRiskFlags(fields({ meshTerms: ['Bronchoscopy'] }))).toContain(
      'signal_bronchoscopy',
    )
    expect(evaluateCoordinatorRiskFlags(fields({ keywords: ['pleural manometry'] }))).toContain(
      'signal_pleural',
    )
    expect(
      evaluateCoordinatorRiskFlags(fields({ journal: 'Journal of Thoracic Disease' })),
    ).toContain('signal_thoracic')
  })

  it('raises the title/abstract mismatch flag when domain signals disagree', () => {
    const flags = evaluateCoordinatorRiskFlags(
      fields({
        title: 'Pulmonary implications of a novel therapy',
        abstract: 'A study of knee arthroplasty outcomes.',
      }),
    )
    expect(flags).toContain('signal_title_abstract_mismatch')
    expect(flags).toContain('signal_pulmonary')
  })

  it('does not raise the mismatch flag without an abstract', () => {
    const flags = evaluateCoordinatorRiskFlags(
      fields({ title: 'Pulmonary implications of a novel therapy', abstract: null }),
    )
    expect(flags).not.toContain('signal_title_abstract_mismatch')
  })

  it('is deterministic and returns flags in vocabulary order', () => {
    const input = fields({
      title: 'Bronchoscopy for pleural and mediastinal disease',
      abstract: 'Pulmonary procedures in the ICU.',
    })
    const first = evaluateCoordinatorRiskFlags(input)
    const second = evaluateCoordinatorRiskFlags(input)
    expect(first).toEqual(second)
    const order = COORDINATOR_RISK_FLAGS.filter((flag) => first.includes(flag))
    expect(first).toEqual(order)
  })
})
