import { mechanicalVentilationSource } from './schema'
import { ventilatorDeviceSources } from './deviceProfiles'
import type { VentilatorDeviceId } from '../engine/types'

export interface VentilationEvidenceReference {
  id: string
  deviceId?: VentilatorDeviceId
  sourceClass: 'manufacturer' | 'curriculum' | 'clinical-reference' | 'educational-model'
  title: string
  citation: string
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
