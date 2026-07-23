import { mechanicalVentilationSource } from './schema'
import { ventilatorDeviceSources } from './deviceProfiles'
import type { VentilatorDeviceId } from '../engine/types'

export interface VentilationEvidenceReference {
  id: string
  deviceId?: VentilatorDeviceId
  sourceClass: 'manufacturer' | 'curriculum' | 'clinical-reference' | 'educational-model'
  title: string
  citation: string
  sourceUrl?: string
  pages?: string
  supports: readonly string[]
  limitations: string
}

export const ventilationEvidence: readonly VentilationEvidenceReference[] = [
  ...ventilatorDeviceSources.map((source) => ({
    id: source.id,
    deviceId: source.deviceId,
    sourceClass: 'manufacturer' as const,
    title: source.title,
    citation: `${source.citation} Source snapshot SHA-256: ${source.sourceSha256}.`,
    pages: source.pages,
    supports: [source.intendedUse],
    limitations: source.limitations,
  })),
  {
    id: 'pb980-operator-manual-pt00101843a00-online',
    deviceId: 'puritan-bennett-980',
    sourceClass: 'manufacturer',
    title: 'Puritan Bennett 980 Series Ventilator Operator’s Manual',
    citation:
      'Covidien. Puritan Bennett 980 Series Ventilator Operator’s Manual. Part PT00101843A00.',
    sourceUrl:
      'https://asiapac.medtronic.com/content/dam/covidien/library/us/en/product/acute-care-ventilation/PuritanBennett980Ventilator_OperatorsManual_en_US_PT00101843A00.pdf',
    pages: 'Mode setup, breath-type descriptions, and technical specifications reviewed online',
    supports: [
      'SIMV with VC, PC, and VC+ mandatory breath types',
      'BiLevel, PAV+, Volume Support, and device-native control vocabulary',
    ],
    limitations:
      'Consulted as an online corroborating source. A revision-locked local snapshot has not yet been archived and hashed, so complete operator-workflow verification remains a publication blocker.',
  },
  {
    id: 'supplied-casebook-2026',
    sourceClass: 'curriculum',
    title: 'Virtual Mechanical Ventilation Simulator Casebook',
    citation:
      'Virtual Mechanical Ventilation Simulator Casebook: fifteen physiology, dyssynchrony, troubleshooting, and patient-centered cases. Supplied by the course author, July 2026.',
    pages: '1-36',
    supports: [
      'Case structure, learning objectives, expected actions, unsafe actions, and debriefs',
      'Equation-of-motion, gas-exchange, waveform, validation, and scoring blueprint',
      'Tutorial, assessment, rapid-response, and randomized teaching patterns',
    ],
    limitations:
      'Curriculum source rather than independent validation. Device-specific settings are normalized through bounded educational profiles and remain draft pending review.',
  },
  {
    id: 'tobin-3e-setting-ventilator',
    sourceClass: 'clinical-reference',
    title: 'Principles and Practice of Mechanical Ventilation: Setting the Ventilator',
    citation:
      'Tobin MJ, ed. Principles and Practice of Mechanical Ventilation. 3rd ed. McGraw-Hill; 2013. Chapter 5.',
    pages: 'Supplied chapter PDF, 30 pages',
    supports: [
      'Breath-variable reasoning for ventilator settings',
      'Linking delivered ventilation to mechanics and gas-exchange reassessment',
    ],
    limitations:
      'Textbook chapter supplied by the course author. It supports clinical concepts, not the fidelity of any training-console workflow.',
  },
  {
    id: 'tobin-3e-peep',
    sourceClass: 'clinical-reference',
    title: 'Principles and Practice of Mechanical Ventilation: Positive End-Expiratory Pressure',
    citation:
      'Tobin MJ, ed. Principles and Practice of Mechanical Ventilation. 3rd ed. McGraw-Hill; 2013. Chapter 10.',
    pages: 'Supplied chapter PDF, 75 pages',
    supports: [
      'PEEP effects on recruitment and oxygenation',
      'Concurrent pressure and hemodynamic reassessment after a PEEP change',
    ],
    limitations:
      'Textbook chapter supplied by the course author. The lesson uses bounded responses and does not prescribe patient-specific PEEP.',
  },
  {
    id: 'tobin-3e-copd',
    sourceClass: 'clinical-reference',
    title: 'Principles and Practice of Mechanical Ventilation: Mechanical Ventilation in COPD',
    citation:
      'Tobin MJ, ed. Principles and Practice of Mechanical Ventilation. 3rd ed. McGraw-Hill; 2013. Chapter 31.',
    pages: 'Supplied chapter PDF, 33 pages',
    supports: [
      'Expiratory flow limitation, dynamic hyperinflation, and intrinsic PEEP',
      'Hemodynamic consequences of excessive end-inspiratory lung volume',
      'Cycling assessment in pressure support for obstructive physiology',
    ],
    limitations:
      'Textbook chapter supplied by the course author. Quantitative patient response remains an educational approximation.',
  },
  {
    id: 'tobin-3e-monitoring',
    sourceClass: 'clinical-reference',
    title: 'Principles and Practice of Mechanical Ventilation: Monitoring',
    citation:
      'Tobin MJ, ed. Principles and Practice of Mechanical Ventilation. 3rd ed. McGraw-Hill; 2013. Chapter 48.',
    pages: 'Supplied chapter PDF, 36 pages',
    supports: [
      'Measurement validation and interpretation of airway pressure and flow',
      'Inspiratory and expiratory occlusion measurements',
      'Limitations introduced by timing and signal error',
    ],
    limitations:
      'Textbook chapter supplied by the course author. Monitoring examples do not validate the generated waveform morphology.',
  },
  {
    id: 'tobin-3e-fighting-ventilator',
    sourceClass: 'clinical-reference',
    title: 'Principles and Practice of Mechanical Ventilation: Fighting the Ventilator',
    citation:
      'Tobin MJ, Jubran A, Laghi F. Fighting the Ventilator. In: Tobin MJ, ed. Principles and Practice of Mechanical Ventilation. 3rd ed. McGraw-Hill; 2013. Chapter 53.',
    pages: 'Supplied chapter PDF, 37 pages',
    supports: [
      'Concurrent stabilization and mechanism localization during acute deterioration',
      'Peak-to-plateau pressure comparison for resistive versus elastic load',
      'Pressure and flow waveform clues for unmet demand, intrinsic PEEP, and secretions',
    ],
    limitations:
      'Textbook chapter supplied by the course author. Emergency actions remain recognition-and-priority exercises governed by local protocols.',
  },
  {
    id: 'antonogiannaki-dyssynchrony-2017',
    sourceClass: 'clinical-reference',
    title: 'Patient–Ventilator Dyssynchrony',
    citation:
      'Antonogiannaki E-M, Georgopoulos D, Akoumianaki E. Patient–Ventilator Dyssynchrony. Korean J Crit Care Med. 2017;32(4):307-322. doi:10.4266/kjccm.2017.00535.',
    pages: '307-322; supplied article PDF',
    supports: [
      'Trigger, cycling, and assist-magnitude definitions of dyssynchrony',
      'Joint assessment of patient comfort and pressure/flow waveforms',
      'Mechanism-specific setting changes followed by reassessment',
    ],
    limitations:
      'Narrative review. It supports bedside recognition concepts but does not validate automated scoring or synthetic patient response.',
  },
  ...mechanicalVentilationSource.sources.map((source) => ({
    id: `casebook-source-${source.id}`,
    sourceClass:
      source.id === 6 || source.id === 7 || source.id === 8
        ? ('educational-model' as const)
        : ('clinical-reference' as const),
    title: `Casebook source ${source.id}`,
    citation: source.citation,
    supports: [source.use],
    limitations:
      'Citation and stated use are preserved from the supplied casebook. Verify current source availability and local applicability during clinical review.',
  })),
  {
    id: 'bounded-ventilation-model',
    sourceClass: 'educational-model',
    title: 'Bounded patient-ventilator response model',
    citation: 'Original browser-based educational simulation model created for this module.',
    supports: [
      'Deterministic fixed-step waveforms and trigger/target/cycle interactions',
      'Bounded gas-exchange, hemodynamic, comfort, and intervention responses',
      'Seeded repeatable branch variation and regression testing',
      'Simplified SIMV, adaptive pressure, two-level, proportional-assist, volume-support, ASV, INTELLiVENT-ASV, AutoFlow, and IntelliSync+ response adapters',
    ],
    limitations:
      'Not a validated patient digital twin, clinical prediction system, ventilator, or treatment guide. Adaptive and closed-loop behaviors are original bounded teaching approximations and do not reproduce proprietary manufacturer algorithms.',
  },
] as const

export const ventilationEvidenceById = new Map(
  ventilationEvidence.map((reference) => [reference.id, reference]),
)
