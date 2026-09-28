import { z } from 'zod'

import rawSources from './data/sources.json'
import { deviceDefinitions, type DeviceDocument } from './deviceDefinitions'
import { statusWordSchema } from './reviewRecords'

/**
 * The module's sources: the literature, the anatomy dataset and, from the device definitions,
 * the manufacturer documents.
 *
 * A source being listed says only that its citation was checked. Whether a statement in the
 * course is supported by it is recorded claim by claim, with a locator, in the claim register.
 * `read` says how much of the source has actually been read, `readParts` which parts when a full
 * text was read only in part, and nothing may be attributed to a part of a source that was not.
 */
export const SOURCE_CLASSES = [
  'guideline',
  'clinical statement',
  'consensus statement',
  'randomised trial',
  'observational study',
  'review',
  'textbook chapter',
] as const

export type SourceClass = (typeof SOURCE_CLASSES)[number]

export const READ_DEPTHS = ['citation only', 'abstract', 'full text'] as const

export type ReadDepth = (typeof READ_DEPTHS)[number]

const isoDate = /^\d{4}-\d{2}-\d{2}$/

const checkedSchema = z
  .object({
    on: z.string().regex(isoDate),
    against: z.string().min(1),
    read: z.enum(READ_DEPTHS),
    /** The parts read, when a full text was read only in part. */
    readParts: z.string().min(1).optional(),
  })
  .strict()

const literatureSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    class: z.enum(SOURCE_CLASSES),
    title: z.string().min(1),
    authors: z.string().min(1),
    journal: z.string().min(1),
    year: z.number().int().min(1950).max(2100),
    volume: z.string().min(1),
    issue: z.string().min(1).nullable(),
    pages: z.string().min(1).nullable(),
    doi: z.string().regex(/^10\.\d{4,9}\/\S+$/),
    pmid: z.string().regex(/^\d+$/),
    pmc: z
      .string()
      .regex(/^PMC\d+$/)
      .nullable()
      .optional(),
    publishedOnline: z.string().regex(isoDate).nullable().optional(),
    checked: checkedSchema,
    /** What the source does not cover, in a sentence a learner can read. */
    limits: z.string().min(1),
    heldLocally: z.boolean(),
  })
  .strict()

const datasetSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    title: z.string().min(1),
    creators: z.string().min(1),
    publisher: z.string().min(1),
    published: z.string().regex(isoDate),
    version: z.string().min(1),
    doi: z.string().regex(/^10\.\d{4,9}\/\S+$/),
    describedIn: z
      .object({
        title: z.string().min(1),
        authors: z.string().min(1),
        journal: z.string().min(1),
        year: z.number().int(),
        volume: z.string().min(1),
        issue: z.string().min(1),
        pages: z.string().min(1),
        doi: z.string().regex(/^10\.\d{4,9}\/\S+$/),
        pmid: z.string().regex(/^\d+$/),
        pmc: z.string().regex(/^PMC\d+$/),
      })
      .strict(),
    licence: z.string().min(1),
    licenceShort: z.string().min(1),
    checked: checkedSchema,
    use: z.string().min(1),
    identity: z.object({ status: statusWordSchema, note: z.string().min(1) }).strict(),
    heldLocally: z.boolean(),
  })
  .strict()

export const sourceRegisterSchema = z
  .object({
    register: z.literal('medical-thoracoscopy-sources'),
    version: z.number().int().positive(),
    preparedOn: z.string().regex(isoDate),
    preparedBy: z.string().min(1),
    statement: z.string().min(1),
    sources: z.array(literatureSchema).min(1),
    datasets: z.array(datasetSchema),
  })
  .strict()
  .superRefine((register, context) => {
    const ids = [...register.sources, ...register.datasets].map((entry) => entry.id)
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'source ids are unique' })
    }
    const dois = register.sources.map((entry) => entry.doi.toLowerCase())
    if (new Set(dois).size !== dois.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'each article is listed once' })
    }
  })

export type SourceRegister = z.infer<typeof sourceRegisterSchema>
export type LiteratureSource = SourceRegister['sources'][number]
export type DatasetSource = SourceRegister['datasets'][number]

export const sourceRegister: SourceRegister = sourceRegisterSchema.parse(rawSources)

export const literatureSources: readonly LiteratureSource[] = sourceRegister.sources
export const datasetSources: readonly DatasetSource[] = sourceRegister.datasets
export const manufacturerDocuments: readonly DeviceDocument[] = deviceDefinitions.documents

/** Every id a claim may cite: articles, datasets and manufacturer documents. */
export const KNOWN_SOURCE_IDS: ReadonlySet<string> = new Set([
  ...literatureSources.map((entry) => entry.id),
  ...datasetSources.map((entry) => entry.id),
  ...manufacturerDocuments.map((entry) => entry.id),
])

export function literatureSourceById(id: string): LiteratureSource {
  const source = literatureSources.find((entry) => entry.id === id)
  if (!source) throw new Error(`Unknown source: ${id}`)
  return source
}

/** Volume, issue and pages as a journal prints them: `78(Suppl 3):s43-s68`. */
export function citationLocator(source: LiteratureSource): string {
  const issue = source.issue ? `(${source.issue})` : ''
  const pages = source.pages ? `:${source.pages}` : ''
  return `${source.volume}${issue}${pages}`
}

export function citation(source: LiteratureSource): string {
  return `${source.authors} ${source.title}. ${source.journal}. ${source.year};${citationLocator(source)}.`
}

export function doiUrl(doi: string): string {
  return `https://doi.org/${doi}`
}
