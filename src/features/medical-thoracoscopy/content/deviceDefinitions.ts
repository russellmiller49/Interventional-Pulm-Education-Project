import { z } from 'zod'

import rawDefinitions from './data/device-definitions.json'
import { claimCategorySchema, reviewDecisionSchema, statusWordSchema } from './reviewRecords'

/**
 * The device definitions: one file, read by the model generator, the space engine and the device
 * register. Every entry says what kind of claim it is and where it was read.
 *
 * A device fact comes from a manufacturer document or from a record the manufacturer submitted.
 * A derived measurement was measured by this project, from the manufacturer's reference frames:
 * it names the entries of `reference-measurements.json` it came from and carries their tolerance.
 * An authored assumption was chosen so the model can run. The three are never mixed, and only the
 * first is ever described to a learner as a fact about the device.
 *
 * A form is a shape rather than a single number: an outline measured from a frame, or the
 * parameters of a part drawn from inspection. It carries the same kind of claim and status.
 */
const sourceRefSchema = z
  .object({
    document: z.string().min(1),
    locator: z.string().min(1),
  })
  .strict()

const documentSchema = z
  .object({
    id: z.string().regex(/^S-[A-Z]+$/),
    kind: z.enum([
      'manufacturer sell sheet',
      'manufacturer brochure',
      'manufacturer catalogue',
      'manufacturer instructions for use',
      'manufacturer product animation',
      'regulatory database',
    ]),
    title: z.string().min(1),
    documentNumber: z.string().min(1),
    publisher: z.string().min(1),
    market: z.enum(['US', 'International', 'Not stated']),
    documentDate: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/),
    dateBasis: z.string().min(1),
    pages: z.number().int().positive().nullable(),
    sha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    url: z.string().url().nullable(),
    retrievedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    note: z.string().min(1).optional(),
  })
  .strict()

/** The document that measured values are read from: the manufacturer's reference frames. */
export const MEASURED_FROM = 'S-FRAMES'

/** Ids of entries in `reference-measurements.json`. */
const measurementIdsSchema = z.array(z.string().regex(/^[a-z]+\.[a-z][A-Za-z]*$/)).min(1)

/**
 * The rules a measured or authored entry keeps, shared by facts and forms. A measured entry names
 * its frame, the measurements it came from and their tolerance; nothing else may carry either.
 */
function checkProvenance(
  entry: {
    key: string
    category: z.infer<typeof claimCategorySchema>
    status: z.infer<typeof statusWordSchema>
    sources: z.infer<typeof sourceRefSchema>[]
    measurement?: string[]
    tolerance?: number
    note?: string
    factCheck: z.infer<typeof reviewDecisionSchema>
  },
  hasValue: boolean,
  issue: (message: string) => void,
) {
  if (entry.category === 'device fact' && entry.sources.length === 0) {
    issue('a device fact names the document it was read in')
  }
  if (entry.category === 'clinical evidence') {
    issue('clinical evidence belongs in the claim register')
  }
  const measured = entry.category === 'derived measurement' && hasValue
  if (measured) {
    if (!entry.measurement) issue('a measured value names the measurements it came from')
    if (entry.tolerance === undefined) issue('a measured value carries its tolerance')
    if (!entry.sources.some((source) => source.document === MEASURED_FROM)) {
      issue(`a measured value names the frame it was read on (${MEASURED_FROM})`)
    }
  } else {
    if (entry.measurement) issue('only a measured value names measurements')
    if (entry.tolerance !== undefined) issue('only a measured value carries a tolerance')
  }
  if (entry.category === 'authored simulation assumption' && hasValue) {
    if (entry.sources.some((source) => source.document !== MEASURED_FROM)) {
      issue('an authored value cites no document as its source')
    }
    if (!entry.note) issue('an authored value says how it was chosen')
  }
  if (entry.status === 'accepted with attributable approval') {
    const { decision } = entry.factCheck
    if (decision !== 'accepted' && decision !== 'accepted with changes') {
      issue('accepted needs a recorded decision')
    }
  }
}

const factSchema = z
  .object({
    key: z.string().regex(/^[a-z][A-Za-z]*$/),
    label: z.string().min(1),
    value: z.union([z.number(), z.string().min(1)]).nullable(),
    unit: z.enum(['mm', 'deg']).nullable(),
    category: claimCategorySchema,
    status: statusWordSchema,
    sources: z.array(sourceRefSchema),
    measurement: measurementIdsSchema.optional(),
    tolerance: z.number().nonnegative().optional(),
    neededBy: z.array(z.string().min(1)).min(1).optional(),
    note: z.string().min(1).optional(),
    factCheck: reviewDecisionSchema,
  })
  .strict()
  .superRefine((entry, context) => {
    const issue = (message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${entry.key}: ${message}` })

    checkProvenance(entry, entry.value !== null, issue)
    if (entry.measurement && typeof entry.value !== 'number') {
      issue('a measured value is a number')
    }
    if (entry.value === null) {
      if (entry.status !== 'unresolved input') issue('a missing value is an unresolved input')
      if (!entry.note) issue('a missing value says what is missing')
      if (!entry.neededBy) issue('a missing value names the sections that need it')
    }
    if (typeof entry.value === 'number' && entry.unit === null) {
      issue('a number carries its unit')
    }
    if (entry.status === 'unresolved input' && !entry.note) {
      issue('an unresolved input says why')
    }
  })

/** A parameter name says its unit: `…Mm` millimetres, `…Deg` degrees, otherwise a count or a word. */
const parameterNameSchema = z.string().regex(/^[a-z][A-Za-z]*$/)

const formSchema = z
  .object({
    key: z.string().regex(/^[a-z][A-Za-z]*$/),
    label: z.string().min(1),
    kind: z.enum(['outline', 'parameters']),
    /** For an outline: what the two numbers of each point are. */
    axes: z.tuple([z.string().min(1), z.string().min(1)]).optional(),
    points: z
      .array(z.tuple([z.number(), z.number()]))
      .min(2)
      .optional(),
    parameters: z.record(parameterNameSchema, z.union([z.number(), z.string().min(1)])).optional(),
    unit: z.literal('mm'),
    category: claimCategorySchema,
    status: statusWordSchema,
    sources: z.array(sourceRefSchema),
    measurement: measurementIdsSchema.optional(),
    tolerance: z.number().nonnegative().optional(),
    note: z.string().min(1).optional(),
    factCheck: reviewDecisionSchema,
  })
  .strict()
  .superRefine((entry, context) => {
    const issue = (message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${entry.key}: ${message}` })

    if (entry.kind === 'outline') {
      if (!entry.points || !entry.axes) issue('an outline has points and says what they are')
      if (entry.parameters) issue('an outline has no parameters')
    } else {
      if (!entry.parameters || Object.keys(entry.parameters).length === 0) {
        issue('a set of parameters is not empty')
      }
      if (entry.points || entry.axes) issue('a set of parameters has no points')
    }
    if (entry.category === 'device fact') issue('a form is measured or authored, not published')
    checkProvenance(entry, true, issue)
  })

const deviceSchema = z
  .object({
    id: z.string().regex(/^[a-z]+(-[a-z]+)*$/),
    name: z.string().min(1),
    role: z.enum(['telescope', 'sleeve', 'trocar', 'tool', 'cable', 'tower', 'accessory']),
    inPrototype: z.boolean(),
    modelled: z.boolean(),
    /** Prototype parts are held to the full standard; the rest are drafts until the explorer. */
    standard: z.enum(['full', 'draft', 'not modelled']),
    productNumbers: z.array(
      z
        .object({
          number: z.string().min(1),
          what: z.string().min(1),
          market: z.enum(['US', 'International', 'US and International']),
        })
        .strict(),
    ),
    facts: z.array(factSchema).min(1),
    forms: z.array(formSchema),
  })
  .strict()
  .superRefine((device, context) => {
    const issue = (message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${device.id}: ${message}` })
    const expected = !device.modelled ? 'not modelled' : device.inPrototype ? 'full' : 'draft'
    if (device.standard !== expected) issue(`its standard is ${expected}`)
    if (!device.modelled && device.forms.length > 0) issue('a part not modelled has no forms')
  })

const fitSchema = z
  .object({
    id: z.string().regex(/^[a-z]+(-[a-z]+)*$/),
    parts: z.array(z.string().min(1)).min(2),
    market: z.enum(['US', 'International']),
    /** Dimensional fit alone can never make a combination "documented compatible". */
    status: z.enum(['documented compatible', 'documented incompatible', 'not established']),
    basis: z.string().min(1),
    sources: z.array(sourceRefSchema),
    dimensionalComparison: z.string().min(1).nullable(),
    factCheck: reviewDecisionSchema,
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.status !== 'not established' && entry.sources.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${entry.id}: a documented fit names its document`,
      })
    }
  })

export const deviceDefinitionsSchema = z
  .object({
    definitions: z.literal('medical-thoracoscopy-device-definitions'),
    version: z.number().int().positive(),
    preparedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    preparedBy: z.string().min(1),
    statement: z.string().min(1),
    units: z.object({ length: z.literal('mm'), angle: z.literal('deg') }).strict(),
    intendedMarket: z
      .object({
        value: z.enum(['US', 'International']),
        status: statusWordSchema,
        note: z.string().min(1),
      })
      .strict(),
    frame: z
      .object({
        origin: z.string().min(1),
        axes: z
          .object({
            minusZ: z.string().min(1),
            plusY: z.string().min(1),
            plusX: z.string().min(1),
          })
          .strict(),
        status: statusWordSchema,
      })
      .strict(),
    labelUntilCad: z.string().min(1),
    documents: z.array(documentSchema).min(1),
    devices: z.array(deviceSchema).min(1),
    fit: z.array(fitSchema),
  })
  .strict()
  .superRefine((definitions, context) => {
    const issue = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message })

    const documentIds = definitions.documents.map((document) => document.id)
    if (new Set(documentIds).size !== documentIds.length) issue('document ids are unique')

    const deviceIds = definitions.devices.map((device) => device.id)
    if (new Set(deviceIds).size !== deviceIds.length) issue('device ids are unique')

    const known = new Set(documentIds)
    for (const device of definitions.devices) {
      const keys = [...device.facts, ...device.forms].map((entry) => entry.key)
      if (new Set(keys).size !== keys.length) issue(`${device.id}: fact and form keys are unique`)
      if (device.inPrototype && !device.modelled)
        issue(`${device.id}: a prototype part is modelled`)
      for (const entry of [...device.facts, ...device.forms]) {
        for (const source of entry.sources) {
          if (!known.has(source.document)) {
            issue(`${device.id}.${entry.key}: unknown document ${source.document}`)
          }
        }
      }
    }

    const devices = new Set(deviceIds)
    for (const entry of definitions.fit) {
      for (const part of entry.parts) {
        if (!devices.has(part)) issue(`${entry.id}: unknown device ${part}`)
      }
      for (const source of entry.sources) {
        if (!known.has(source.document)) issue(`${entry.id}: unknown document ${source.document}`)
      }
    }
  })

export type DeviceDefinitions = z.infer<typeof deviceDefinitionsSchema>
export type DeviceDefinition = DeviceDefinitions['devices'][number]
export type DeviceFact = DeviceDefinition['facts'][number]
export type DeviceDocument = DeviceDefinitions['documents'][number]
export type DeviceFit = DeviceDefinitions['fit'][number]
export type DeviceForm = DeviceDefinition['forms'][number]

export const deviceDefinitions: DeviceDefinitions = deviceDefinitionsSchema.parse(rawDefinitions)

export function deviceById(id: string): DeviceDefinition {
  const device = deviceDefinitions.devices.find((entry) => entry.id === id)
  if (!device) throw new Error(`Unknown device: ${id}`)
  return device
}

export function factOf(deviceId: string, key: string): DeviceFact {
  const entry = deviceById(deviceId).facts.find((candidate) => candidate.key === key)
  if (!entry) throw new Error(`Unknown fact: ${deviceId}.${key}`)
  return entry
}

export function formOf(deviceId: string, key: string): DeviceForm {
  const entry = deviceById(deviceId).forms.find((candidate) => candidate.key === key)
  if (!entry) throw new Error(`Unknown form: ${deviceId}.${key}`)
  return entry
}

/**
 * A published length or angle, as a number. Throws for a value that is missing, is not a number
 * or was not published by the manufacturer, so a model can never be built on a guess made at the
 * point of use, and a measurement is never passed off as a published value.
 */
export function publishedNumber(deviceId: string, key: string): number {
  const entry = factOf(deviceId, key)
  if (typeof entry.value !== 'number') {
    throw new Error(`${deviceId}.${key} has no numeric value (${entry.status})`)
  }
  if (entry.category !== 'device fact') {
    throw new Error(`${deviceId}.${key} is not a device fact (${entry.category})`)
  }
  return entry.value
}

export type ModelledNumber = {
  value: number
  unit: 'mm' | 'deg'
  category: DeviceFact['category']
  /** For a measured value, how far it may be out; otherwise null. */
  tolerance: number | null
}

/**
 * The number a model is built with, whatever kind of claim it is, together with that kind. Throws
 * for a value that is missing, so an unknown dimension is never filled in at the point of use.
 */
export function modelledNumber(deviceId: string, key: string): ModelledNumber {
  const entry = factOf(deviceId, key)
  if (typeof entry.value !== 'number' || entry.unit === null) {
    throw new Error(`${deviceId}.${key} has no numeric value (${entry.status})`)
  }
  return {
    value: entry.value,
    unit: entry.unit,
    category: entry.category,
    tolerance: entry.tolerance ?? null,
  }
}

/** The parts the week-4 pages load. */
export const prototypeDevices: readonly DeviceDefinition[] = deviceDefinitions.devices.filter(
  (device) => device.inPrototype,
)
