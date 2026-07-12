import type { ComplicationPathway } from '../engine/learningLabTypes'

export const complicationRegistry: readonly ComplicationPathway[] = [
  {
    id: 'granulation',
    label: 'Granulation tissue',
    recognitionPatterns: [
      'Recurrent cough, wheeze, secretion change, or focal narrowing near an end or interface transition.',
      'Bronchoscopic tissue may coexist with retained secretions, infection, migration, or recurrent disease.',
    ],
    plausibleContributors: [
      'Fit mismatch, focal end or edge contact, straightening, or repeated relative motion.',
      'Retained secretions, colonization, biofilm, or lower-respiratory infection.',
      'Foreign-body and wound-healing responses interacting with dwell time, host biology, and disease.',
    ],
    contributorDomains: ['mechanical', 'infectious-secretory', 'biologic-time'],
    reassessmentQuestions: [
      'Where is the tissue relative to the device end, curve, cover transition, or exposed cells?',
      'Are mucus, purulence, infection, tumor, migration, or structural failure also present?',
      'Does the original indication remain, and is the current fit and architecture still defensible?',
    ],
    responseDomains: [
      'Restore airway patency.',
      'Evaluate and manage secretion or infectious burden.',
      'Reassess fit, position, architecture, and the ongoing indication.',
      'Consider repositioning, exchange, removal, or another strategy as clinically appropriate.',
      'Define follow-up and an exit plan.',
    ],
    evidenceRefs: [
      'ost-infection-granulation-2012',
      'hu-granulation-diameter-2011',
      'gupta-granulation-review-2025',
    ],
  },
  {
    id: 'mucus',
    label: 'Mucus plugging',
    recognitionPatterns: [
      'New secretion burden, airflow limitation, lobar change, or intraluminal material.',
      'Symptoms may overlap with infection, granulation, tumor, or malposition.',
    ],
    plausibleContributors: [
      'Interrupted mucociliary transport across solid or covered surfaces.',
      'Pooling at junctions, gaps, branches, or incompletely expanded segments.',
      'Airway clearance limitations and changing clinical condition.',
    ],
    contributorDomains: ['mechanical', 'infectious-secretory'],
    reassessmentQuestions: [
      'Where are secretions collecting and why?',
      'Is an underlying fit, position, infection, or branch-patency problem present?',
    ],
    responseDomains: [
      'Restore patency and evaluate airway clearance.',
      'Assess for infection and correct anatomic or device contributors.',
      'Reassess the ongoing indication and surveillance plan.',
    ],
    evidenceRefs: [
      'wabip-malignant-stenting-2024',
      'wabip-benign-stenting-2025',
      'ost-infection-granulation-2012',
    ],
  },
  {
    id: 'migration',
    label: 'Migration',
    recognitionPatterns: [
      'Loss of intended coverage, new obstruction, or a changed device position.',
      'Migration may follow poor fixation or a change in airway caliber or disease burden.',
    ],
    plausibleContributors: [
      'Landing-zone mismatch or insufficient geometry-dependent fixation.',
      'Tumor response, airway remodeling, cough, or changing external compression.',
    ],
    contributorDomains: ['mechanical', 'biologic-time'],
    reassessmentQuestions: [
      'What changed in anatomy, disease, or the intended job?',
      'Are branches, fistula coverage, or distal patency compromised?',
    ],
    responseDomains: [
      'Restore a safe airway configuration.',
      'Reassess fit, fixation strategy, ongoing indication, and exit plan.',
    ],
    evidenceRefs: ['wabip-malignant-stenting-2024', 'wabip-benign-stenting-2025'],
  },
  {
    id: 'ingrowth',
    label: 'Tissue ingrowth or overgrowth',
    recognitionPatterns: [
      'Tissue traverses exposed cells or extends beyond a covered segment.',
      'Fixation and removal difficulty may change as tissue incorporates.',
    ],
    plausibleContributors: [
      'Exposed scaffold cells or uncovered ends.',
      'Disease progression, wound healing, and dwell time.',
    ],
    contributorDomains: ['mechanical', 'biologic-time'],
    reassessmentQuestions: [
      'Is the obstruction tumor, benign tissue response, or both?',
      'How has incorporation changed removal or exchange feasibility?',
    ],
    responseDomains: [
      'Restore patency while defining the tissue process.',
      'Reassess coverage, removal consequences, and ongoing indication.',
    ],
    evidenceRefs: ['wabip-benign-stenting-2025', 'wabip-malignant-stenting-2024'],
  },
  {
    id: 'infection',
    label: 'Infection or biofilm-associated obstruction',
    recognitionPatterns: [
      'Purulence, systemic or respiratory symptoms, secretion change, or recurrent obstruction.',
      'Infection may coexist with mucus retention and granulation.',
    ],
    plausibleContributors: [
      'Retained secretions and altered clearance at the device surface.',
      'Biofilm, host factors, disease, and dwell time.',
    ],
    contributorDomains: ['infectious-secretory', 'biologic-time'],
    reassessmentQuestions: [
      'Is infection driving obstruction, tissue response, or both?',
      'What device or airway feature is sustaining secretion retention?',
    ],
    responseDomains: [
      'Restore patency and evaluate the infectious burden.',
      'Correct secretion, fit, position, or ongoing-device contributors.',
    ],
    evidenceRefs: ['ost-infection-granulation-2012', 'gupta-granulation-review-2025'],
  },
  {
    id: 'structural',
    label: 'Structural stent failure',
    recognitionPatterns: [
      'Loss of support, fractured elements, deformation, or a new sharp interface.',
      'A static appearance earlier in the course does not exclude a later cyclic failure.',
    ],
    plausibleContributors: [
      'Repeated bending, compression, torsion, or connector strain.',
      'Architecture, location, dwell time, and device-specific factors.',
    ],
    contributorDomains: ['mechanical', 'biologic-time'],
    reassessmentQuestions: [
      'Where did failure occur relative to a curve, connector, or landing zone?',
      'Has the airway or intended job changed?',
    ],
    responseDomains: [
      'Protect and restore airway patency.',
      'Reassess the architecture, fit, ongoing indication, and replacement or removal strategy.',
    ],
    evidenceRefs: ['chung-airway-fracture-2008', 'pelton-nitinol-fatigue-2008'],
  },
  {
    id: 'cover-failure',
    label: 'Cover tear or delamination',
    recognitionPatterns: [
      'Loss of sealing or ingrowth protection, a loose interface, or exposed scaffold.',
      'Failure may be focal at a fold, end, connector, or repeatedly deformed region.',
    ],
    plausibleContributors: [
      'Repeated deformation, abrasion, cover folding, or scaffold-cover interaction.',
      'Dwell time and device-specific construction.',
    ],
    contributorDomains: ['mechanical', 'biologic-time'],
    reassessmentQuestions: [
      'Is sealing still required, and what tissue or scaffold is now exposed?',
      'Is there associated infection, ingrowth, or structural failure?',
    ],
    responseDomains: [
      'Restore the required airway or sealing function.',
      'Reassess exchange, removal, and the ongoing indication.',
    ],
    evidenceRefs: ['mckenna-covered-braid-2021', 'pelton-nitinol-fatigue-2008'],
  },
  {
    id: 'malposition',
    label: 'Malposition or branch obstruction',
    recognitionPatterns: [
      'A device end, wall, or limb compromises an airway that should remain patent.',
      'Symptoms and imaging may resemble mucus, recurrent compression, or migration.',
    ],
    plausibleContributors: [
      'Length, limb, branch-angle, or landing-zone mismatch.',
      'Deployment position or later anatomic change.',
    ],
    contributorDomains: ['mechanical', 'biologic-time'],
    reassessmentQuestions: [
      'Which branch or orifice is compromised?',
      'Does the whole-device geometry still match the intended job?',
    ],
    responseDomains: [
      'Restore required branch patency.',
      'Reassess position, fit, architecture, and the exit strategy.',
    ],
    evidenceRefs: ['wabip-malignant-stenting-2024', 'wabip-benign-stenting-2025'],
  },
  {
    id: 'recurrent-obstruction',
    label: 'Recurrent external compression or tumor',
    recognitionPatterns: [
      'Progressive narrowing within, beyond, or around the supported segment.',
      'The device may remain intact while the clinical problem changes.',
    ],
    plausibleContributors: [
      'Tumor progression or changing external load.',
      'Coverage length, landing zones, and response to other therapy.',
    ],
    contributorDomains: ['mechanical', 'biologic-time'],
    reassessmentQuestions: [
      'Is the original mechanical job still the correct one?',
      'Is obstruction due to disease, tissue response, secretion, or a combination?',
    ],
    responseDomains: [
      'Restore patency while defining the cause.',
      'Coordinate the airway plan with the broader treatment strategy.',
      'Reassess surveillance and exit planning.',
    ],
    evidenceRefs: ['chest-cao-guideline-2024', 'wabip-malignant-stenting-2024'],
  },
]

export const complicationById = Object.freeze(
  Object.fromEntries(complicationRegistry.map((pathway) => [pathway.id, pathway])) as Record<
    ComplicationPathway['id'],
    ComplicationPathway
  >,
)
