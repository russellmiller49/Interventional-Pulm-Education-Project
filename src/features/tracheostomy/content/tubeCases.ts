export interface TubeCaseOption {
  id: string
  label: string
}

export interface TubeSelectionCase {
  id: string
  title: string
  scenario: string
  question: string
  options: TubeCaseOption[]
  answerId: string
  rationale: string
  tradeoff: string
}

export const tracheostomyTubeCases: TubeSelectionCase[] = [
  {
    id: 'deep-neck',
    title: 'Deep skin-to-trachea distance',
    scenario:
      'A ventilated adult has a deep neck. Ultrasound shows a long pretracheal soft-tissue course; a standard tube would place the flange under tension and the distal tip shallow.',
    question: 'Which design feature best addresses the external depth problem?',
    options: [
      { id: 'standard', label: 'Standard-length cuffed tube' },
      { id: 'proximal-xlt', label: 'Extra proximal length or a monitored adjustable flange' },
      { id: 'distal-xlt', label: 'Extra distal length only' },
      { id: 'cuffless', label: 'Short cuffless tube' },
    ],
    answerId: 'proximal-xlt',
    rationale:
      'Extra proximal length bridges an increased skin-to-trachea distance. An adjustable flange can be a monitored temporary solution when depth is uncertain or changing.',
    tradeoff:
      'Confirm intratracheal position and distal-tip clearance; “longer” is not automatically safer.',
  },
  {
    id: 'distal-pathology',
    title: 'Distal airway target',
    scenario:
      'Bronchoscopy shows proximal tracheomalacia and a standard tube tip repeatedly abuts unstable trachea. The team needs to bypass the involved segment while remaining above the carina.',
    question: 'Which feature is most directly relevant?',
    options: [
      { id: 'proximal-xlt', label: 'Extra proximal length' },
      { id: 'distal-xlt', label: 'Extra distal length' },
      { id: 'fenestrated', label: 'Fenestration' },
      { id: 'smaller-id', label: 'Smallest possible inner diameter' },
    ],
    answerId: 'distal-xlt',
    rationale:
      'Extra distal length may bypass selected proximal tracheal pathology. Position must be confirmed because an overly long tube can approach the carina or obstruct a main bronchus.',
    tradeoff: 'Distal length solves a different problem from deep-neck proximal length.',
  },
  {
    id: 'ward-rescue',
    title: 'Ward-level obstruction resilience',
    scenario:
      'A stable patient is transferring from ICU with recurring thick secretions. Staff need a rapid first maneuver if the tube lumen obstructs.',
    question: 'Which tube characteristic strengthens bedside rescue?',
    options: [
      { id: 'single', label: 'Single-cannula design only' },
      { id: 'dual', label: 'Removable dual-cannula design' },
      { id: 'foam', label: 'Foam cuff regardless of indication' },
      { id: 'fenestrated', label: 'Fenestration without an inner cannula' },
    ],
    answerId: 'dual',
    rationale:
      'A blocked removable inner cannula can be taken out quickly, restoring a potential airway while the patient is reassessed.',
    tradeoff:
      'The inner cannula reduces functional inner diameter; humidification, suction planning, and manufacturer-specific care remain essential.',
  },
  {
    id: 'communication',
    title: 'Communication and capping pathway',
    scenario:
      'A non-ventilated patient is stable with manageable secretions, a patent upper airway, and supervised cuff-deflation tolerance. The current tube has a bulky cuff and large outer diameter.',
    question: 'Which next-tube goal best supports translaryngeal airflow?',
    options: [
      { id: 'larger-od', label: 'Increase outer diameter' },
      {
        id: 'smaller-od',
        label: 'Consider a smaller outer diameter or cuffless design after full team assessment',
      },
      { id: 'inflate', label: 'Keep cuff inflated during the speaking-valve trial' },
      { id: 'longer', label: 'Add distal length without another indication' },
    ],
    answerId: 'smaller-od',
    rationale:
      'A smaller outer profile or appropriately selected cuffless tube can create more space for airflow around the tube, which may improve speaking-valve or capping tolerance.',
    tradeoff:
      'A smaller functional inner diameter raises resistance through the tube and may impair ventilation or suction access.',
  },
]
