export interface ProfileOption {
  label: string
  value: string
}

export const professionalRoleOptions = [
  { value: 'medical_student', label: 'Medical Student' },
  { value: 'resident', label: 'Resident' },
  { value: 'chief_resident', label: 'Chief Resident' },
  { value: 'pulmonary_fellow', label: 'Pulmonary Fellow' },
  { value: 'critical_care_fellow', label: 'Critical Care Fellow' },
  { value: 'pccm_fellow', label: 'PCCM Fellow' },
  { value: 'interventional_pulmonology_fellow', label: 'Interventional Pulmonology Fellow' },
  { value: 'thoracic_surgery_fellow', label: 'Thoracic Surgery Fellow' },
  { value: 'pulmonologist', label: 'Pulmonologist' },
  { value: 'interventional_pulmonologist', label: 'Interventional Pulmonologist' },
  { value: 'intensivist', label: 'Intensivist' },
  { value: 'thoracic_surgeon', label: 'Thoracic Surgeon' },
  { value: 'general_surgeon', label: 'General Surgeon' },
  { value: 'anesthesiologist', label: 'Anesthesiologist' },
  { value: 'emergency_medicine_physician', label: 'Emergency Medicine Physician' },
  { value: 'advanced_practice_provider', label: 'Advanced Practice Provider (NP/PA)' },
  { value: 'respiratory_therapist', label: 'Respiratory Therapist' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'cytotechnologist', label: 'Cytotechnologist' },
  { value: 'pathologist', label: 'Pathologist' },
  { value: 'medical_educator', label: 'Medical Educator' },
  { value: 'industry', label: 'Industry' },
  { value: 'other', label: 'Other' },
] as const satisfies readonly ProfileOption[]

export const residentSpecialtyOptions = [
  { value: 'internal_medicine', label: 'Internal Medicine' },
  { value: 'pediatrics', label: 'Pediatrics' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'anesthesia', label: 'Anesthesia' },
  { value: 'emergency_medicine', label: 'Emergency Medicine' },
  { value: 'other', label: 'Other' },
] as const satisfies readonly ProfileOption[]

export const institutionTypeOptions = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'medical_school', label: 'Medical School' },
  { value: 'training_program', label: 'Training Program' },
  { value: 'company', label: 'Company' },
] as const satisfies readonly ProfileOption[]

export const medicalStudentTrainingLevelOptions = [
  { value: 'ms1', label: 'MS1' },
  { value: 'ms2', label: 'MS2' },
  { value: 'ms3', label: 'MS3' },
  { value: 'ms4', label: 'MS4' },
] as const satisfies readonly ProfileOption[]

export const residentTrainingLevelOptions = [
  { value: 'pgy_1', label: 'PGY-1' },
  { value: 'pgy_2', label: 'PGY-2' },
  { value: 'pgy_3', label: 'PGY-3' },
  { value: 'pgy_4', label: 'PGY-4' },
  { value: 'pgy_5', label: 'PGY-5' },
  { value: 'pgy_6', label: 'PGY-6' },
] as const satisfies readonly ProfileOption[]

export const fellowTrainingLevelOptions = [
  { value: 'fellow_year_1', label: 'Fellow Year 1' },
  { value: 'fellow_year_2', label: 'Fellow Year 2' },
  { value: 'fellow_year_3', label: 'Fellow Year 3' },
  { value: 'ip_fellow', label: 'IP Fellow' },
] as const satisfies readonly ProfileOption[]

export const yearsInPracticeOptions = [
  { value: 'in_training', label: 'In Training' },
  { value: 'lt_5', label: '<5 years' },
  { value: '5_10', label: '5-10 years' },
  { value: '10_20', label: '10-20 years' },
  { value: '20_plus', label: '20+ years' },
] as const satisfies readonly ProfileOption[]

export const interestOptions = [
  { value: 'flexible_bronchoscopy', label: 'Flexible Bronchoscopy' },
  { value: 'ebus', label: 'EBUS' },
  { value: 'robotic_bronchoscopy', label: 'Robotic Bronchoscopy' },
  { value: 'peripheral_bronchoscopy', label: 'Peripheral Bronchoscopy' },
  { value: 'pleural_disease', label: 'Pleural Disease' },
  { value: 'thoracic_ultrasound', label: 'Thoracic Ultrasound' },
  { value: 'airway_disease', label: 'Airway Disease' },
  { value: 'interventional_pulmonology', label: 'Interventional Pulmonology' },
  { value: 'lung_cancer', label: 'Lung Cancer' },
  { value: 'critical_care_bronchoscopy', label: 'Critical Care Bronchoscopy' },
  { value: 'rose_cytology', label: 'ROSE/Cytology' },
  { value: 'simulation', label: 'Simulation' },
  { value: 'medical_education', label: 'Medical Education' },
] as const satisfies readonly ProfileOption[]

export const learningGoalOptions = [
  { value: 'learn_fundamentals', label: 'Learn fundamentals' },
  { value: 'board_preparation', label: 'Board preparation' },
  { value: 'fellowship_training', label: 'Fellowship training' },
  { value: 'procedural_skills', label: 'Procedural skills' },
  { value: 'faculty_development', label: 'Faculty development' },
  { value: 'teaching_trainees', label: 'Teaching trainees' },
] as const satisfies readonly ProfileOption[]

export const fellowRoleValues = new Set([
  'pulmonary_fellow',
  'critical_care_fellow',
  'pccm_fellow',
  'interventional_pulmonology_fellow',
  'thoracic_surgery_fellow',
])

export function getTrainingLevelOptions(role: string): readonly ProfileOption[] {
  if (role === 'medical_student') {
    return medicalStudentTrainingLevelOptions
  }

  if (role === 'resident') {
    return residentTrainingLevelOptions
  }

  if (fellowRoleValues.has(role)) {
    return fellowTrainingLevelOptions
  }

  return []
}

export function requiresTrainingLevel(role: string) {
  return getTrainingLevelOptions(role).length > 0
}

export function optionValues(options: readonly ProfileOption[]) {
  return options.map((option) => option.value)
}
