export type PneumothoraxType = 'psp' | 'ssp' | 'iatrogenic' | 'traumatic'
export type SymptomBurden = 'minimal' | 'moderate' | 'severe'

export interface PneumothoraxCase {
  id: string
  title: string
  type: PneumothoraxType
  symptomBurden: SymptomBurden
  hemodynamicCompromise: boolean
  severeHypoxemia: boolean
  underlyingLungDisease: boolean
  persistentAirLeakDays: number
  recurrence: 'none' | 'ipsilateral' | 'contralateral'
  highRiskOccupation: boolean
  ventilated: boolean
  learningCue: string
}

export interface PneumothoraxRecommendation {
  disposition:
    | 'emergency'
    | 'conservative'
    | 'aspiration-or-ambulatory'
    | 'chest-drain'
    | 'escalate'
  recommendation: string
  rationale: string[]
  recurrencePrevention: string
}
