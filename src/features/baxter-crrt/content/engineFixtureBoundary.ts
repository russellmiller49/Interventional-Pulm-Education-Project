import { z } from 'zod'

const finiteNumberSchema = z.number().finite()
const nonnegativeNumberSchema = finiteNumberSchema.nonnegative()
const positiveNumberSchema = finiteNumberSchema.positive()
const fractionSchema = finiteNumberSchema.min(0).max(1)
const identifierSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9]+(?:[-_.:][A-Za-z0-9]+)*$/)
const sourceIdSchema = z
  .string()
  .min(1)
  .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
const sourceIdListSchema = z.array(sourceIdSchema).min(1)
const reviewStatusSchema = z.enum(['pending', 'reviewed', 'approved'])

const soluteModelInputSchema = z
  .object({
    distributionVolumeLiters: positiveNumberSchema,
    productionAmountPerHour: nonnegativeNumberSchema,
    inputAmountPerHour: nonnegativeNumberSchema,
    residualClearanceMlPerMin: nonnegativeNumberSchema,
    filterPermeabilityFraction: fractionSchema,
    reviewStatus: reviewStatusSchema,
    sourceIds: sourceIdListSchema,
  })
  .strict()

export const enginePatientNormalizationSchema = z
  .object({
    vasopressorSupportIndex: nonnegativeNumberSchema,
    hemodynamicStressIndex: fractionSchema,
    totalCalciumMmolL: nonnegativeNumberSchema.nullable(),
    reviewStatus: reviewStatusSchema,
    solutes: z
      .object({
        sodium: soluteModelInputSchema,
        potassium: soluteModelInputSchema,
        bicarbonate: soluteModelInputSchema,
        'urea-marker': soluteModelInputSchema,
        'creatinine-marker': soluteModelInputSchema,
        phosphate: soluteModelInputSchema,
        magnesium: soluteModelInputSchema,
      })
      .strict(),
  })
  .strict()

export const engineAccessNormalizationSchema = z
  .object({
    positionResistanceMultiplier: positiveNumberSchema,
    reviewStatus: reviewStatusSchema,
  })
  .strict()

export const enginePrescriptionNormalizationSchema = z
  .object({
    reviewStatus: reviewStatusSchema,
  })
  .strict()

export const engineBagSchema = z
  .object({
    id: identifierSchema,
    label: z.string().min(1),
    flowTerm: z.enum([
      'dialysate',
      'pbp',
      'pre-replacement',
      'post-replacement',
      'syringe',
      'makeup',
      'effluent',
    ]),
    direction: z.enum(['source', 'effluent']),
    capacityMl: positiveNumberSchema,
    calculatedVolumeMl: nonnegativeNumberSchema,
    measuredVolumeMl: nonnegativeNumberSchema,
    cumulativePumpVolumeMl: nonnegativeNumberSchema,
    connected: z.boolean(),
    scaleOpen: z.boolean(),
    externalInterferenceMl: finiteNumberSchema,
    reviewStatus: reviewStatusSchema,
    sourceIds: sourceIdListSchema,
  })
  .strict()
  .superRefine((bag, context) => {
    if (bag.calculatedVolumeMl > bag.capacityMl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['calculatedVolumeMl'],
        message: 'Calculated bag volume cannot exceed capacity.',
      })
    }
    if (bag.measuredVolumeMl > bag.capacityMl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['measuredVolumeMl'],
        message: 'Measured bag volume cannot exceed capacity.',
      })
    }
  })

export const engineExternalFluidRatesSchema = z
  .object({
    maintenanceInputMlHour: nonnegativeNumberSchema,
    medicationCarrierInputMlHour: nonnegativeNumberSchema,
    nutritionInputMlHour: nonnegativeNumberSchema,
    bloodProductInputMlHour: nonnegativeNumberSchema,
    bolusInputMlHour: nonnegativeNumberSchema,
    otherInputMlHour: nonnegativeNumberSchema,
    urineOutputMlHour: nonnegativeNumberSchema,
    drainOutputMlHour: nonnegativeNumberSchema,
    otherOutputMlHour: nonnegativeNumberSchema,
  })
  .strict()

const pressureModelConfigurationSchema = z
  .object({
    accessReferencePressureMmHg: finiteNumberSchema,
    disconnectedAccessPressureMmHg: finiteNumberSchema,
    returnReferencePressureMmHg: finiteNumberSchema,
    disconnectedReturnPressureMmHg: finiteNumberSchema,
    observedEffluentPressureMmHg: finiteNumberSchema,
    filterResistanceMmHgPerMlMin: nonnegativeNumberSchema,
    partialThrombusResistanceGainAtFullBurden: nonnegativeNumberSchema,
    foulingResistanceGainMmHgPerMlMinAtFullBurden: nonnegativeNumberSchema,
    clotResistanceGainMmHgPerMlMinAtFullBurden: nonnegativeNumberSchema,
    accessKinkResistanceMultiplier: positiveNumberSchema,
    returnKinkResistanceMultiplier: positiveNumberSchema,
    reviewStatus: reviewStatusSchema,
    sourceIds: sourceIdListSchema,
  })
  .strict()

const filterModelConfigurationSchema = z
  .object({
    foulingFractionPerHourAtRiskOne: nonnegativeNumberSchema,
    clotFractionPerHourAtRiskOne: nonnegativeNumberSchema,
    filtrationFractionWeight: nonnegativeNumberSchema,
    interruptionWeight: nonnegativeNumberSchema,
    lowFlowWeight: nonnegativeNumberSchema,
    accessDysfunctionWeight: nonnegativeNumberSchema,
    hematocritWeight: nonnegativeNumberSchema,
    procoagulantWeight: nonnegativeNumberSchema,
    anticoagulationProtectionFraction: z
      .object({
        none: fractionSchema,
        'systemic-concept': fractionSchema,
      })
      .strict(),
    referenceHematocritFraction: fractionSchema,
    reviewStatus: reviewStatusSchema,
    sourceIds: sourceIdListSchema,
  })
  .strict()

const hemodynamicModelConfigurationSchema = z
  .object({
    stressGainPerExcessRemovalLiter: nonnegativeNumberSchema,
    stressRecoveryPerHour: nonnegativeNumberSchema,
    reviewStatus: reviewStatusSchema,
    sourceIds: sourceIdListSchema,
  })
  .strict()

export const engineRuntimeModelConfigurationSchema = z
  .object({
    pressure: pressureModelConfigurationSchema,
    filter: filterModelConfigurationSchema,
    hemodynamic: hemodynamicModelConfigurationSchema,
    filterInletConcentrationFraction: fractionSchema,
    filtrationFraction: fractionSchema,
    reviewStatus: reviewStatusSchema,
    sourceIds: sourceIdListSchema,
  })
  .strict()

const engineFaultIdSchema = z.enum([
  'access-obstruction',
  'access-disconnection',
  'return-obstruction',
  'return-disconnection',
  'filter-fouling',
  'effluent-obstruction',
  'air-detected',
  'blood-leak-detected',
  'supply-bag-empty',
  'effluent-bag-full',
  'scale-open',
  'fluid-gain-loss',
  'power-interruption',
])

export const engineScheduledEventActionSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('SET_FAULT'),
      fault: engineFaultIdSchema,
      active: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal('SET_EXTERNAL_FLUID_RATE'),
      field: z.enum([
        'maintenanceInputMlHour',
        'medicationCarrierInputMlHour',
        'nutritionInputMlHour',
        'bloodProductInputMlHour',
        'bolusInputMlHour',
        'otherInputMlHour',
        'urineOutputMlHour',
        'drainOutputMlHour',
        'otherOutputMlHour',
      ]),
      rateMlHour: nonnegativeNumberSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('SET_ACCESS_RESISTANCE'),
      resistanceMmHgPerMlMin: nonnegativeNumberSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('SET_RETURN_RESISTANCE'),
      resistanceMmHgPerMlMin: nonnegativeNumberSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('SET_FILTER_RISK'),
      procoagulantBurdenFraction: fractionSchema,
      lowEffectiveBloodFlowFraction: fractionSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('SET_DELIVERY_STATE'),
      deliveryState: z.enum(['idle', 'running', 'paused', 'ended']),
    })
    .strict(),
  z
    .object({
      type: z.literal('SET_OBSERVED_EFFLUENT_PRESSURE'),
      pressureMmHg: finiteNumberSchema,
    })
    .strict(),
])

export const engineTimedEventMappingSchema = z
  .object({
    timedEventId: identifierSchema,
    action: engineScheduledEventActionSchema,
  })
  .strict()

/**
 * Explicit, fully authored values required to convert a validated runtime case
 * into the pure engine fixture. No clinical coefficient, volume, or rate is
 * defaulted by the normalization layer.
 */
export const engineFixtureNormalizationSchema = z
  .object({
    patient: enginePatientNormalizationSchema,
    access: engineAccessNormalizationSchema,
    prescription: enginePrescriptionNormalizationSchema,
    bags: z.array(engineBagSchema),
    externalFluidRates: engineExternalFluidRatesSchema,
    unintendedDeviceNetGainRateMlHour: finiteNumberSchema,
    modelConfiguration: engineRuntimeModelConfigurationSchema,
    timedEventMappings: z.array(engineTimedEventMappingSchema),
    sourceIds: sourceIdListSchema,
  })
  .strict()
  .superRefine((configuration, context) => {
    const bagIds = configuration.bags.map((bag) => bag.id)
    if (new Set(bagIds).size !== bagIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bags'],
        message: 'Engine bag IDs must be unique.',
      })
    }

    const mappedEventIds = configuration.timedEventMappings.map((mapping) => mapping.timedEventId)
    if (new Set(mappedEventIds).size !== mappedEventIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['timedEventMappings'],
        message: 'Each authored timed event may have only one engine mapping.',
      })
    }
  })

export type EngineFixtureNormalization = Readonly<z.infer<typeof engineFixtureNormalizationSchema>>
