import { z } from 'zod'

import {
  getTrainingLevelOptions,
  institutionTypeOptions,
  interestOptions,
  learningGoalOptions,
  optionValues,
  professionalRoleOptions,
  residentSpecialtyOptions,
  yearsInPracticeOptions,
} from './profile-options'

const professionalRoles = optionValues(professionalRoleOptions) as [string, ...string[]]
const residentSpecialties = optionValues(residentSpecialtyOptions) as [string, ...string[]]
const institutionTypes = optionValues(institutionTypeOptions) as [string, ...string[]]
const yearsInPracticeValues = optionValues(yearsInPracticeOptions) as [string, ...string[]]
const interestValues = new Set(optionValues(interestOptions))
const learningGoalValues = new Set(optionValues(learningGoalOptions))

function optionalTrimmedString() {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
}

export const siteProfileSchema = z
  .object({
    first_name: z.string().trim().min(1, 'First name is required.'),
    last_name: z.string().trim().min(1, 'Last name is required.'),
    professional_role: z.enum(professionalRoles),
    resident_specialty: optionalTrimmedString(),
    role_other: optionalTrimmedString(),
    institution_type: z.enum(institutionTypes),
    institution: z.string().trim().min(1, 'Institution is required.'),
    country: z.string().trim().min(1, 'Country is required.'),
    training_level: optionalTrimmedString(),
    years_in_practice: z.enum(yearsInPracticeValues),
    interests: z.array(z.string()).min(1, 'Choose at least one interest.'),
    learning_goals: z.array(z.string()).min(1, 'Choose at least one learning goal.'),
  })
  .superRefine((profile, context) => {
    if (profile.professional_role === 'resident') {
      if (!profile.resident_specialty) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Resident specialty is required.',
          path: ['resident_specialty'],
        })
      } else if (!residentSpecialties.includes(profile.resident_specialty)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Choose a valid resident specialty.',
          path: ['resident_specialty'],
        })
      }
    }

    if (profile.professional_role !== 'resident' && profile.resident_specialty) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Resident specialty only applies to residents.',
        path: ['resident_specialty'],
      })
    }

    if (profile.professional_role === 'other' && !profile.role_other) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Describe your professional role.',
        path: ['role_other'],
      })
    }

    const trainingOptions = getTrainingLevelOptions(profile.professional_role)
    if (trainingOptions.length > 0) {
      const validTrainingLevels = optionValues(trainingOptions)
      if (!profile.training_level || !validTrainingLevels.includes(profile.training_level)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Choose a valid training level.',
          path: ['training_level'],
        })
      }
    } else if (profile.training_level) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Training level only applies to students, residents, and fellows.',
        path: ['training_level'],
      })
    }

    for (const interest of profile.interests) {
      if (!interestValues.has(interest)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Choose valid interests.',
          path: ['interests'],
        })
        break
      }
    }

    for (const goal of profile.learning_goals) {
      if (!learningGoalValues.has(goal)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Choose valid learning goals.',
          path: ['learning_goals'],
        })
        break
      }
    }
  })

export type SiteProfileInput = z.infer<typeof siteProfileSchema>

export function getSiteProfileValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Please review the signup form.'
}
