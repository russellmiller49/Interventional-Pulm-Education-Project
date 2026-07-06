import type { PleuralLesson } from '@/features/pleural-procedures/content/types'

/**
 * Teaching statements for the Rigid Bronchoscopy module. Each statement is
 * paraphrased in our own words and carries `referenceIds` into the module's
 * `airwayReferences` list; the references page renders exactly the set cited
 * here. Simulation/education framing only.
 *
 * (The `PleuralLesson` shape is reused only as a generic "lesson with cited
 * statements" container — the content is airway, not pleural.)
 */
export const rigidBronchoscopyLessons: PleuralLesson[] = [
  {
    id: 'equipment-indications',
    title: 'Equipment, indications, and airway assessment',
    timeMinutes: 20,
    objectives: [
      'Identify the parts of a ventilating rigid bronchoscope and the ablative/hemostatic instruments.',
      'State the core indications and contraindications for rigid bronchoscopy.',
    ],
    statements: [
      {
        id: 'indications',
        statement:
          'Rigid bronchoscopy is taught for central-airway problems that need a secured large-bore airway: malignant or benign central airway obstruction (coring/debulking, dilation, stenting), massive haemoptysis, and large foreign-body retrieval.',
        referenceIds: ['chest-ip-2003', 'ernst-cao-2004'],
        lastReviewed: '2026-07-04',
        reviewer: 'Pending clinical review',
      },
      {
        id: 'contraindications',
        statement:
          'Relative contraindications taught include an unstable cervical spine, severely restricted mouth opening or neck mobility, and the inability to ventilate or oxygenate the patient during the procedure.',
        referenceIds: ['chest-ip-2003'],
        lastReviewed: '2026-07-04',
        reviewer: 'Pending clinical review',
      },
    ],
  },
  {
    id: 'ventilation-therapeutics',
    title: 'Ventilation coordination and therapeutic modalities',
    timeMinutes: 25,
    objectives: [
      'Coordinate ventilation in the shared airway and anticipate barotrauma.',
      'Match ablative modalities to the task and to airway-fire risk.',
    ],
    statements: [
      {
        id: 'shared-airway',
        statement:
          'Rigid bronchoscopy is taught as a shared-airway procedure requiring explicit coordination with anaesthesia (commonly total intravenous anaesthesia) using controlled or jet ventilation and apnoeic oxygenation; jetting against obstructed expiratory egress can cause barotrauma.',
        referenceIds: ['chest-ip-2003'],
        lastReviewed: '2026-07-04',
        reviewer: 'Pending clinical review',
      },
      {
        id: 'ablative-toolkit',
        statement:
          'The therapeutic toolkit taught includes mechanical coring, dilation, stents, and ablative modalities — Nd:YAG laser, argon plasma coagulation, and cryotherapy — chosen by task (immediate hemostasis vs delayed cryo-adhesion) and by airway-fire risk.',
        referenceIds: ['ernst-cao-2004', 'folch-stents-2018'],
        lastReviewed: '2026-07-04',
        reviewer: 'Pending clinical review',
      },
    ],
  },
  {
    id: 'safety-complications',
    title: 'Airway-fire safety and hemorrhage',
    timeMinutes: 15,
    objectives: [
      'Apply the fire-prevention algorithm and FiO₂ reduction during airway energy use.',
      'Manage central-airway hemorrhage with positioning, tamponade, and hemostasis.',
    ],
    statements: [
      {
        id: 'fire-safety',
        statement:
          'Before using laser or electrosurgery in the shared airway, FiO₂ is taught to be reduced to the lowest tolerated level and nitrous oxide avoided, following the operating-room fire-prevention algorithm, because oxidiser, ignition, and fuel together form the fire triad.',
        referenceIds: ['asa-or-fire-2013'],
        lastReviewed: '2026-07-04',
        reviewer: 'Pending clinical review',
      },
      {
        id: 'hemorrhage',
        statement:
          'Central-airway hemorrhage is taught to be managed by protecting the airway first — bleeding side down and lung isolation to protect the contralateral lung — then tamponade and topical/pharmacologic endobronchial hemostasis.',
        referenceIds: ['sakr-dutau-2010', 'ernst-cao-2004'],
        lastReviewed: '2026-07-04',
        reviewer: 'Pending clinical review',
      },
    ],
  },
]
