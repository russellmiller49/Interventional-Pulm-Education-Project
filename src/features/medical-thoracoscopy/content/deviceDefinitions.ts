import { z } from 'zod'

import rawDefinitions from './data/device-definitions.json'
import { claimCategorySchema, reviewDecisionSchema, statusWordSchema } from './reviewRecords'

/**
 * The device definitions: one file, read by the model generator, the space engine and the device
 * register. Every entry says what kind of claim it is and where it was read.
 *
 * A device fact comes from a manufacturer document or from a record the manufacturer submitted.
 * A derived measurement was measured by this project. An authored assumption was chosen so the
 * model can run. The three are never mixed, and only the first is ever described to a learner as
 * a fact about the device.
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
      'regulatory database',
    ]),
    title: z.string().min(1),
    documentNumber: z.string().min(1),
    publisher: z.string().min(1),
    market: z.enum(['US', 'International']),
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

const factSchema = z
  .object({
    key: z.string().regex(/^[a-z][A-Za-z]*$/),
    label: z.string().min(1),
    value: z.union([z.number(), z.string().min(1)]).nullable(),
    unit: z.enum(['mm', 'deg']).nullable(),
    category: claimCategorySchema,
    status: statusWordSchema,
    sources: z.array(sourceRefSchema),
    neededBy: z.array(z.string().min(1)).min(1).optional(),
    note: z.string().min(1).optional(),
    factCheck: reviewDecisionSchema,
  })
  .strict()
  .superRefine((entry, context) => {
    const issue = (message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${entry.key}: ${message}` })

    if (entry.category === 'device fact' && entry.sources.length === 0) {
      issue('a device fact names the document it was read in')
    }
    if (entry.category === 'clinical evidence') {
      issue('clinical evidence belongs in the claim register')
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
    if (entry.status === 'accepted with attributable approval') {
      const { decision } = entry.factCheck
      if (decision !== 'accepted' && decision !== 'accepted with changes') {
        issue('accepted needs a recorded decision')
      }
    }
  })

const deviceSchema = z
  .object({
    id: z.string().regex(/^[a-z]+(-[a-z]+)*$/),
    name: z.string().min(1),
    role: z.enum(['telescope', 'sleeve', 'trocar', 'tool', 'cable', 'tower', 'accessory']),
    inPrototype: z.boolean(),
    modelled: z.boolean(),
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
  })
  .strict()

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
      const keys = device.facts.map((entry) => entry.key)
      if (new Set(keys).size !== keys.length) issue(`${device.id}: fact keys are unique`)
      if (device.inPrototype && !device.modelled)
        issue(`${device.id}: a prototype part is modelled`)
      for (const entry of device.facts) {
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

/**
 * A published length or angle, as a number. Throws for a value that is missing or is not a
 * number, so a model can never be built on a guess made at the point of use.
 */
export function publishedNumber(deviceId: string, key: string): number {
  const entry = factOf(deviceId, key)
  if (typeof entry.value !== 'number') {
    throw new Error(`${deviceId}.${key} has no numeric value (${entry.status})`)
  }
  return entry.value
}

/** The parts the week-4 pages load. */
export const prototypeDevices: readonly DeviceDefinition[] = deviceDefinitions.devices.filter(
  (device) => device.inPrototype,
)
