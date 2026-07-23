import { z } from 'zod'

export const clinicalContextSnapshotSchema = z
  .object({
    id: z.string().min(1).max(160),
    contextType: z.enum(['patient', 'technical-skill', 'device-orientation']),
    patient: z
      .object({
        ageLabel: z.string().min(1).max(80).optional(),
        setting: z.string().min(1).max(160),
        presentation: z.string().min(1).max(1_000),
        indication: z.string().min(1).max(500).optional(),
        relevantHistory: z.array(z.string().min(1).max(500)).max(20).optional(),
      })
      .optional(),
    support: z
      .object({
        ventilation: z.string().min(1).max(240).optional(),
        hemodynamicSupport: z.string().min(1).max(240).optional(),
        extracorporealSupport: z.string().min(1).max(240).optional(),
        renalSupport: z.string().min(1).max(240).optional(),
      })
      .optional(),
    currentData: z
      .array(
        z.object({
          id: z.string().min(1).max(160),
          label: z.string().min(1).max(120),
          value: z.string().min(1).max(240),
          trend: z.enum(['up', 'down', 'stable', 'new']).optional(),
          abnormal: z.boolean().optional(),
        }),
      )
      .min(1)
      .max(40),
    activeProblem: z.string().min(1).max(1_000),
    immediateGoal: z.string().min(1).max(1_000),
    safetyConstraints: z.array(z.string().min(1).max(500)).min(1).max(20),
    lastUpdatedAtSimulationSeconds: z.number().min(0).optional(),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.contextType === 'patient' && !snapshot.patient) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['patient'],
        message: 'Patient context requires a patient presentation.',
      })
    }
    if (snapshot.contextType !== 'patient' && snapshot.patient) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['patient'],
        message: 'Technical and device contexts must not masquerade as patient cases.',
      })
    }
  })

export type ClinicalContextSnapshot = z.infer<typeof clinicalContextSnapshotSchema>
