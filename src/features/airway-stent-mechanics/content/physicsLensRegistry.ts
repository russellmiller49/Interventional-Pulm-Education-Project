import type { PhysicsLensConfig, PhysicsLensPreset } from '../engine/learningLabTypes'

export const physicsLensRegistry = {
  'residual-extrinsic-load': {
    preset: 'residual-extrinsic-load',
    architectureIds: ['studded-silicone', 'hook-cross-covered', 'laser-cut-covered'],
    loadMode: 'radial',
    clinicalQuestion: 'How does the architecture respond to persistent external narrowing?',
    observationPrompts: [
      'Inspect whether narrowing is distributed or becomes focal.',
      'Follow the load path through a continuous wall, captured scaffold, or linked rings.',
      'Look at both landing zones rather than the midsection alone.',
    ],
    debrief:
      'The scene can expose different load paths under the same imposed motion. It cannot identify a clinical winner or a patient-specific support threshold.',
    evidenceBoundary:
      'The narrowing is an authored schematic displacement, not a measured force, airway pressure, or treatment recommendation.',
    evidenceRefs: ['ratnovsky-airway-mechanics-2015', 'wabip-malignant-stenting-2024'],
  },
  'curve-end-loading': {
    preset: 'curve-end-loading',
    architectureIds: ['studded-silicone', 'laser-cut-covered', 'single-wire-knit-partial-cover'],
    loadMode: 'bend',
    clinicalQuestion: 'Where could a curved airway create gapping or repeated end contact?',
    observationPrompts: [
      'Inspect the inner curve for crowding or gapping.',
      'Inspect the outer curve and both device ends for concentrated contact.',
      'Ask whether straightening tendency changes the landing-zone plan.',
    ],
    debrief:
      'Visible end motion identifies a place to inspect clinically; it does not calculate mucosal stress or prove a complication mechanism.',
    evidenceBoundary:
      'This scene shows plausible relative motion only. It does not calculate tissue pressure or prove the cause of granulation in an individual patient.',
    evidenceRefs: [
      'ratnovsky-airway-mechanics-2015',
      'hu-granulation-diameter-2011',
      'gupta-granulation-review-2025',
    ],
  },
  'eccentric-ovalization': {
    preset: 'eccentric-ovalization',
    architectureIds: ['dynamic-d-silicone', 'free-crossing-braid', 'laser-cut-covered'],
    loadMode: 'ovalization',
    clinicalQuestion: 'How might eccentric compression change contact and lumen shape?',
    observationPrompts: [
      'Compare the narrowed axis with the perpendicular axis.',
      'Inspect whether the architecture reconfigures, gaps, or develops focal contact.',
      'Consider whether one cross-section represents the full diseased segment.',
    ],
    debrief:
      'Ovalization makes direction and geometry visible; it does not establish a safe force or predict procedural success.',
    evidenceBoundary:
      'Displayed ovalization is deliberately amplified and is not calibrated to a tumor load, airway pressure, or clinical risk category.',
    evidenceRefs: ['ratnovsky-airway-mechanics-2015', 'jung-gina-2021'],
  },
  'bifurcation-mismatch': {
    preset: 'bifurcation-mismatch',
    architectureIds: ['silicone-y'],
    loadMode: 'bend',
    clinicalQuestion: 'What must be inspected when a bifurcated device meets the main carina?',
    observationPrompts: [
      'Inspect the carinal saddle and the direction of each limb.',
      'Check both distal pathways rather than judging the tracheal limb alone.',
      'Consider how limb length or branch-angle mismatch could shift contact.',
    ],
    debrief:
      'Bifurcated fixation depends on the whole geometry. A straight-tube metric cannot substitute for carinal and limb fit.',
    evidenceBoundary:
      'The generic Y geometry is not patient anatomy, exact product CAD, or a sizing recommendation.',
    evidenceRefs: ['wabip-malignant-stenting-2024', 'wabip-benign-stenting-2025'],
  },
  'cough-micromotion': {
    preset: 'cough-micromotion',
    architectureIds: ['studded-silicone', 'hook-cross-covered', 'single-wire-knit-partial-cover'],
    loadMode: 'cough',
    clinicalQuestion: 'Where could cough produce repeated relative motion at the interface?',
    observationPrompts: [
      'Inspect device ends, exposed-cell transitions, and cover transitions.',
      'Look for gap-and-recontact behavior rather than motion magnitude alone.',
      'Connect the visual finding to secretion, infection, dwell time, and host biology.',
    ],
    debrief:
      'Repeated motion is one plausible contributor within a multifactorial tissue response, not a standalone granulation equation.',
    evidenceBoundary:
      'The pulse is an amplified teaching motion. It does not reproduce cough force or estimate an individual complication probability.',
    evidenceRefs: [
      'ost-infection-granulation-2012',
      'hu-granulation-diameter-2011',
      'gupta-granulation-review-2025',
    ],
  },
  'coverage-interface': {
    preset: 'coverage-interface',
    architectureIds: ['studded-silicone', 'hook-cross-covered', 'single-wire-knit-partial-cover'],
    loadMode: 'breathing',
    clinicalQuestion: 'How does a continuous or partially covered surface change the interface?',
    observationPrompts: [
      'Trace where secretions could travel, pool, or encounter a junction.',
      'Locate exposed cells, cover transitions, and device ends.',
      'Ask how sealing, ingrowth protection, removability, and clearance trade off.',
    ],
    debrief:
      'Coverage changes the surface and tissue interface while creating secretion and transition-zone considerations.',
    evidenceBoundary:
      'The scene identifies surfaces to inspect; it does not simulate mucociliary clearance, biofilm, tissue incorporation, or removal difficulty.',
    evidenceRefs: [
      'wabip-benign-stenting-2025',
      'ost-infection-granulation-2012',
      'mckenna-covered-braid-2021',
    ],
  },
} as const satisfies Record<PhysicsLensPreset, PhysicsLensConfig>

export function getPhysicsLens(preset: PhysicsLensPreset): PhysicsLensConfig {
  return physicsLensRegistry[preset]
}
