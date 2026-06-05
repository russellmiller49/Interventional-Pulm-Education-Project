import { siteProfileSchema } from './profile-schema'

const baseProfile = {
  country: 'United States',
  first_name: 'Avery',
  institution: 'Example Medical Center',
  institution_type: 'hospital',
  interests: ['ebus', 'medical_education'],
  last_name: 'Lee',
  learning_goals: ['learn_fundamentals', 'procedural_skills'],
  professional_role: 'medical_student',
  training_level: 'ms1',
  years_in_practice: 'in_training',
}

describe('siteProfileSchema', () => {
  it('accepts a complete medical student profile', () => {
    const parsed = siteProfileSchema.safeParse(baseProfile)

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.first_name).toBe('Avery')
      expect(parsed.data.training_level).toBe('ms1')
    }
  })

  it('requires resident specialty for resident signups', () => {
    const parsed = siteProfileSchema.safeParse({
      ...baseProfile,
      professional_role: 'resident',
      training_level: 'pgy_2',
    })

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toContain('resident_specialty')
    }
  })

  it('accepts resident specialty and resident training level together', () => {
    const parsed = siteProfileSchema.safeParse({
      ...baseProfile,
      professional_role: 'resident',
      resident_specialty: 'internal_medicine',
      training_level: 'pgy_2',
    })

    expect(parsed.success).toBe(true)
  })

  it('requires valid fellow training levels without constraining years in practice', () => {
    const parsed = siteProfileSchema.safeParse({
      ...baseProfile,
      professional_role: 'interventional_pulmonology_fellow',
      training_level: 'ip_fellow',
      years_in_practice: 'lt_5',
    })

    expect(parsed.success).toBe(true)
  })

  it('rejects missing required checkbox groups', () => {
    const parsed = siteProfileSchema.safeParse({
      ...baseProfile,
      interests: [],
    })

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toContain('interests')
    }
  })
})
