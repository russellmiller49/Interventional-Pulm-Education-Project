export type PneumothoraxType = 'psp' | 'ssp' | 'iatrogenic' | 'traumatic'
export type SymptomBurden = 'minimal' | 'moderate' | 'severe'
export type PneumothoraxSizeCategory = 'small' | 'large'

export interface AccpVitals {
  respiratoryRate: number
  heartRate: number
  roomAirSpo2: number
  bloodPressureStable: boolean
  speaksFullSentences: boolean
}

export interface PneumothoraxCase {
  id: string
  title: string
  type: PneumothoraxType
  sizeCategory: PneumothoraxSizeCategory
  accpVitals: AccpVitals
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
