import type { EvidenceReference } from '../engine/types'

export const cardiohelpEvidence: readonly EvidenceReference[] = [
  {
    id: 'ifu-us-2025-scope',
    sourceClass: 'manufacturer',
    title: 'CARDIOHELP-i Instructions for Use, United States',
    citation:
      'Getinge. CARDIOHELP-i Instructions for Use. Revision 2.3; software 03.04.10.00 or higher. January 2025.',
    pages: '2, 13-21, 29, 90-91',
    url: 'https://www.getinge.com/us/products/cardiohelp-system/',
    supports: [
      'Target device identity and U.S. configuration',
      'Cardiopulmonary Support thApp restriction',
      'Need for trained staff and independent patient monitoring',
    ],
    limitations:
      'The current U.S. labeling covers partial cardiopulmonary bypass or temporary surgical circulatory bypass for less than six hours. It is used here only for console behavior, not as prolonged-ECMO clinical guidance.',
  },
  {
    id: 'ifu-console-workflow',
    sourceClass: 'manufacturer',
    title: 'CARDIOHELP-i console controls and screen workflow',
    citation: 'Getinge CARDIOHELP-i IFU, revision 2.3.',
    pages: '30, 35-58, 71-96, 111-158, 196-205',
    url: 'https://www.getinge.com/us/products/cardiohelp-system/',
    supports: [
      'Physical controls, RPM/LPM modes, lock, zero-flow, power, alarms, tabs, and menus',
      'pVen, pInt, and pArt pressure-protection and bubble-intervention workflows',
      'Backflow protection, factory alarm-limit orientation, and user-controlled timers',
      'Six-item alarm history and display ranges',
    ],
    limitations:
      'This module paraphrases behavior in an original schematic interface. Service/password surfaces, unsupported thApps, and proprietary artwork are excluded.',
  },
  {
    id: 'ifu-anomaly-boundary',
    sourceClass: 'manufacturer',
    title: 'IFU discrepancy boundary',
    citation: 'Getinge CARDIOHELP-i IFU, revision 2.3.',
    pages: '20, 136, 165, 199',
    supports: [
      'Scenario-triggered bubble event without a numerical bubble threshold',
      'Pressure-drop display as a trend without a fixed alarm-priority claim',
    ],
    limitations:
      'The supplied IFU is internally inconsistent on a bubble-size threshold and on pressure-drop alarm priority. Those values are intentionally not encoded pending device review.',
  },
  {
    id: 'ecmo-book-ch9',
    sourceClass: 'textbook',
    title: 'The ECMO Book - Components, Sensors, and Circuit Access',
    citation: 'Chapter 9: Components, Sensors, and Circuit Access.',
    pages: '92-101',
    supports: [
      'Centrifugal pump preload dependence and afterload sensitivity',
      'Circuit pressure zones, sensor orientation, inspection, and backup readiness',
    ],
    limitations:
      'Paraphrased teaching concepts only. No textbook pages, figures, or long excerpts are redistributed.',
  },
  {
    id: 'ecmo-book-ch16',
    sourceClass: 'textbook',
    title: 'The ECMO Book - Introduction to ECMO Management Principles',
    citation: 'Chapter 16: Introduction to ECMO Management Principles.',
    pages: '170-172',
    supports: [
      'Name a patient-centered endpoint before changing support',
      'Use ECMO to reduce toxicity of conventional support',
    ],
    limitations:
      'General adult ECMO teaching; local protocols and clinician judgment remain authoritative.',
  },
  {
    id: 'ecmo-book-ch17',
    sourceClass: 'textbook',
    title: 'The ECMO Book - Blood Flow Titration',
    citation: 'Chapter 17: Blood Flow Titration.',
    pages: '173-180',
    supports: [
      'Blood flow as a titrated dose with preload, afterload, and recirculation limits',
      'VV separation testing with blood flow maintained',
    ],
    limitations:
      'Relationships are contextual teaching principles, not patient-specific treatment targets.',
  },
  {
    id: 'ecmo-book-ch18',
    sourceClass: 'textbook',
    title: 'The ECMO Book - Sweep Gas Flow Titration',
    citation: 'Chapter 18: Sweep Gas Flow Titration.',
    pages: '182-189',
    supports: [
      'Sweep primarily changes carbon-dioxide clearance',
      'Sweep-gas FiO2 is distinct from sweep flow',
      'Phase-aware titration and VV off-sweep reassessment order',
    ],
    limitations:
      'Any numerical response shown in the simulator is a bounded educational curve and must not be used as a bedside prescription.',
  },
  {
    id: 'elso-adult-vv-2021',
    sourceClass: 'clinical-guidance',
    title: 'ELSO guideline for adult respiratory failure managed with VV ECMO',
    citation:
      'Tonna JE, et al. Management of Adult Patients Supported with Venovenous Extracorporeal Membrane Oxygenation. ASAIO J. 2021.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8315725/',
    supports: [
      'Adult VV ECMO monitoring and multidisciplinary management context',
      'Use of independent patient assessment alongside circuit data',
    ],
    limitations:
      'Guidance does not replace local policy, device training, or patient-specific expert management.',
  },
  {
    id: 'elso-adult-va-2021',
    sourceClass: 'clinical-guidance',
    title: 'ELSO interim guideline for adult cardiac patients supported with VA ECMO',
    citation:
      'Lorusso R, et al. ELSO Interim Guidelines for Venoarterial Extracorporeal Membrane Oxygenation in Adult Cardiac Patients. ASAIO J. 2021;67:827-844.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/34339398/',
    supports: [
      'Adult peripheral VA monitoring and multidisciplinary management context',
      'Recognition of LV loading, native ejection, differential oxygenation, and the need for independent patient assessment',
    ],
    limitations:
      'This draft teaches recognition and escalation only. It does not encode cannulation, unloading-device selection, numeric treatment targets, or a VA weaning protocol.',
  },
  {
    id: 'elso-neuro-monitoring-2024',
    sourceClass: 'clinical-guidance',
    title: 'ELSO consensus guidance for neurologic monitoring during adult ECMO',
    citation:
      'Cho S-M, et al. Neurological Monitoring and Management for Adult Extracorporeal Membrane Oxygenation Patients: ELSO Consensus Guidelines. Crit Care. 2024.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11380208/',
    supports: [
      'Right-radial arterial monitoring for cerebral and upper-body oxygenation during peripheral VA ECMO',
      'Recognition of differential oxygenation when cardiac recovery precedes lung recovery',
    ],
    limitations:
      'Monitoring guidance is presented as a recognition cue and does not provide a patient-specific corrective algorithm.',
  },
  {
    id: 'elso-circuit-2022',
    sourceClass: 'clinical-guidance',
    title: 'ELSO guideline for ECMO circuits',
    citation:
      'Gajkowski EF, et al. ELSO Guidelines for Adult and Pediatric Extracorporeal Membrane Oxygenation Circuits. ASAIO J. 2022.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35089258/',
    supports: ['Circuit components, monitoring, emergency planning, and safety context'],
    limitations:
      'Consult the current ELSO guideline library and local protocol for operational decisions.',
  },
  {
    id: 'attached-ecmo-case-curriculum',
    sourceClass: 'educational-model',
    title: 'ECMO CASES clinical simulation curriculum draft',
    citation: 'Unpublished 30-case curriculum supplied by the course author; reviewed July 2026.',
    supports: [
      'Original clinical presentation structure and signature clues for Practice cases',
      'Case progression, expected team actions, response patterns, and debrief prompts',
    ],
    limitations:
      'Curriculum source only, not independent clinical evidence. Every case remains draft-gated and requires adult ECMO and device review before publication.',
  },
  {
    id: 'bounded-educational-model',
    sourceClass: 'educational-model',
    title: 'CARDIOHELP ECMO lab bounded response curves',
    citation: 'Original educational simulation model created for this module.',
    supports: [
      'Deterministic RPM-flow-pressure trends',
      'Simplified recirculation and sweep-to-PaCO2 responses',
      'Simplified peripheral-VA upper-body oxygenation and LV-loading response cues',
      'Bounded clinical deterioration and response after case-specific simulated interventions',
      'Repeatable fault injection for prediction and reassessment practice',
    ],
    limitations:
      'Not a validated patient digital twin. Values are simulated, bounded, deliberately simplified, and unsuitable for clinical prediction or treatment.',
  },
] as const

export const evidenceById = new Map(
  cardiohelpEvidence.map((reference) => [reference.id, reference]),
)

export function validateEvidenceIds(ids: readonly string[]): boolean {
  return ids.every((id) => evidenceById.has(id))
}
