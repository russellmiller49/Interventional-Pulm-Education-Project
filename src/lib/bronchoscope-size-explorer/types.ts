export type ScopeCategory =
  | 'therapeutic'
  | 'diagnostic'
  | 'thin'
  | 'ultrathin'
  | 'single-use'
  | 'robotic-catheter'
  | 'robotic-bronchoscope'

export interface BronchoscopeDevice {
  id: string
  displayName: string
  shortName: string
  category: ScopeCategory
  outerDiameterMm: number
  workingChannelMm: number
  sheathDiameterMm?: number
  notes: string[]
  sourceLabel: string
  sourceUrl?: string
  sourceType: 'manufacturer' | 'review article' | 'educational model' | 'learner-entered'
}

export type InstrumentCategory =
  | 'radial-ebus'
  | 'needle'
  | 'forceps'
  | 'brush'
  | 'guide-sheath'
  | 'cryoprobe'
  | 'custom'

export interface BronchoscopyInstrument {
  id: string
  displayName: string
  category: InstrumentCategory
  outerDiameterMm?: number
  minimumWorkingChannelMm?: number
  notes: string[]
  sourceLabel: string
  sourceUrl?: string
  sourceType: 'manufacturer' | 'review article' | 'educational model' | 'learner-entered'
}

export interface AirwayGeneration {
  generation: number
  label: string
  approximateDiameterMm: number
}

export type FitStatus = 'fits' | 'borderline' | 'does-not-fit' | 'unknown'

export type ReachStatus = 'reachable' | 'borderline' | 'unreachable'

export interface AirwayReachResult extends AirwayGeneration {
  status: ReachStatus
}

export interface FitClassification {
  status: FitStatus
  channelAreaMm2: number
  instrumentAreaMm2: number | null
  remainingAreaMm2: number | null
  residualAreaRatio: number | null
  clearanceMm: number
  message: string
  caution?: string
}
