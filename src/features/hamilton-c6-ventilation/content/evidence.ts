import { mechanicalVentilationSource } from './schema'

export interface VentilationEvidenceReference {
  id: string
  sourceClass: 'manufacturer' | 'curriculum' | 'clinical-reference' | 'educational-model'
  title: string
  citation: string
  pages?: string
  supports: readonly string[]
  limitations: string
}

export const ventilationEvidence: readonly VentilationEvidenceReference[] = [
  {
    id: 'hamilton-c6-manual-1.2.x',
    sourceClass: 'manufacturer',
    title: 'HAMILTON-C6 Operator’s Manual',
    citation:
      'Hamilton Medical. HAMILTON-C6 Operator’s Manual. Software version 1.2.x; document 10197564/00; 31 March 2022.',
    pages: '44, 91-112, 123-183, 195-225, 229-235, 311-317',
    supports: [
      'Original educational facsimile layout and physical controls',
      '(S)CMV, PCV+, and SPONT mode naming and control behavior',
      'Trigger, ETS, P-ramp, apnea backup, TRC, holds, graphics, and alarm workflows',
      'Adult/Ped control ranges encoded by the simulator',
    ],
    limitations:
      'The supplied revision is the locked device profile for this module. Optional features and market-specific configurations are excluded unless explicitly listed.',
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
      'Curriculum source rather than independent validation. Device-specific settings are normalized to the locked C6 profile and remain draft pending review.',
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
    ],
    limitations:
      'Not a validated patient digital twin, clinical prediction system, ventilator, or treatment guide.',
  },
] as const

export const ventilationEvidenceById = new Map(
  ventilationEvidence.map((reference) => [reference.id, reference]),
)
