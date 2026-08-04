import { SaxesParser } from 'saxes'

import { normalizeWhitespace, stableUnique } from './text'

export const pubmedMetadataFields = [
  'meshTerms',
  'authorKeywords',
  'publicationTypes',
  'languages',
] as const

export type PubmedMetadataField = (typeof pubmedMetadataFields)[number]

export interface PubmedMeshQualifier {
  majorTopic: boolean
  name: string
}

export interface PubmedMeshHeading {
  descriptor: string
  descriptorMajorTopic: boolean
  qualifiers: PubmedMeshQualifier[]
}

export interface PubmedMetadataRecord {
  authorKeywords: string[]
  invalidLanguages: string[]
  languages: string[]
  meshHeadings: PubmedMeshHeading[]
  meshTerms: string[]
  pmid: string
  publicationTypes: string[]
}

export interface PubmedMetadataParserLimits {
  maxDepth: number
  maxElementTextLength: number
  maxRecordTextLength: number
  maxRecords: number
  maxResponseBytes: number
  maxValuesPerField: number
}

export const defaultPubmedMetadataParserLimits: PubmedMetadataParserLimits = {
  maxDepth: 128,
  maxElementTextLength: 200_000,
  maxRecordTextLength: 2_000_000,
  maxRecords: 200,
  maxResponseBytes: 32 * 1024 * 1024,
  maxValuesPerField: 10_000,
}

export class PubmedMetadataParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PubmedMetadataParseError'
  }
}

interface MutableMeshHeading {
  descriptor: string | null
  descriptorMajorTopic: boolean
  qualifiers: PubmedMeshQualifier[]
}

interface MutablePubmedRecord {
  authorKeywords: string[]
  invalidLanguages: string[]
  languages: string[]
  meshHeadings: PubmedMeshHeading[]
  pmid: string | null
  publicationTypes: string[]
  textLength: number
}

type CaptureKind = 'descriptor' | 'keyword' | 'language' | 'pmid' | 'publicationType' | 'qualifier'

interface TextCapture {
  depth: number
  elementName: string
  kind: CaptureKind
  majorTopic: boolean
  text: string
}

function localXmlName(name: string): string {
  return name.includes(':') ? (name.split(':').at(-1) ?? name) : name
}

function xmlAttributeValue(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'value' in value && typeof value.value === 'string') {
    return value.value
  }
  return null
}

function xmlAttribute(attributes: Record<string, unknown>, name: string): string | null {
  const direct = xmlAttributeValue(attributes[name])
  if (direct !== null) return direct
  for (const [candidate, value] of Object.entries(attributes)) {
    if (localXmlName(candidate) === name) return xmlAttributeValue(value)
  }
  return null
}

function isMajorTopic(attributes: Record<string, unknown>): boolean {
  return xmlAttribute(attributes, 'MajorTopicYN')?.toLocaleUpperCase('en-US') === 'Y'
}

function normalizeMetadataValue(value: string): string {
  return normalizeWhitespace(value.normalize('NFKC'))
}

export function isAllowedPubmedArticleSetDoctype(doctype: string): boolean {
  if (/\[|\]|<!ENTITY/iu.test(doctype)) return false
  return /^\s*PubmedArticleSet\s+PUBLIC\s+"-\/\/NLM\/\/DTD PubMedArticle, (?:[1-9]|[12]\d|3[01])(?:st|nd|rd|th) [A-Z][a-z]+ 20\d{2}\/\/EN"\s+"https:\/\/dtd\.nlm\.nih\.gov\/ncbi\/pubmed\/out\/pubmed_\d{6}\.dtd"\s*$/u.test(
    doctype,
  )
}

export interface LanguageValidationResult {
  normalized: string | null
  reason: 'blank' | 'invalid_syntax' | null
  valid: boolean
}

/**
 * Accepts NLM's ordinary two- or three-letter language codes and syntactically valid
 * BCP-47-like extensions. Numeric artifacts such as `4348` fail without a PMID-specific rule.
 */
export function validateLiteratureLanguage(value: unknown): LanguageValidationResult {
  if (typeof value !== 'string') {
    return { normalized: null, reason: 'invalid_syntax', valid: false }
  }
  const normalized = normalizeMetadataValue(value).toLocaleLowerCase('en-US')
  if (!normalized) return { normalized: null, reason: 'blank', valid: false }
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/u.test(normalized)) {
    return { normalized, reason: 'invalid_syntax', valid: false }
  }
  return { normalized, reason: null, valid: true }
}

function newMutableRecord(): MutablePubmedRecord {
  return {
    authorKeywords: [],
    invalidLanguages: [],
    languages: [],
    meshHeadings: [],
    pmid: null,
    publicationTypes: [],
    textLength: 0,
  }
}

function meshHeadingDisplayValue(heading: PubmedMeshHeading): string {
  const descriptor = `${heading.descriptorMajorTopic ? '*' : ''}${heading.descriptor}`
  if (heading.qualifiers.length === 0) return descriptor
  return `${descriptor}/${heading.qualifiers
    .map((qualifier) => `${qualifier.majorTopic ? '*' : ''}${qualifier.name}`)
    .join('/')}`
}

function pushBounded(
  values: string[],
  value: string,
  field: string,
  limits: PubmedMetadataParserLimits,
): void {
  if (values.length >= limits.maxValuesPerField) {
    throw new PubmedMetadataParseError(
      `PubMed XML ${field} exceeded ${limits.maxValuesPerField} values.`,
    )
  }
  values.push(value)
}

export function parsePubmedMetadataXml(
  xml: string,
  limits: PubmedMetadataParserLimits = defaultPubmedMetadataParserLimits,
): PubmedMetadataRecord[] {
  if (Buffer.byteLength(xml, 'utf8') > limits.maxResponseBytes) {
    throw new PubmedMetadataParseError(
      `PubMed XML exceeded the ${limits.maxResponseBytes}-byte response limit.`,
    )
  }

  const records: PubmedMetadataRecord[] = []
  const seenPmids = new Set<string>()
  const elementStack: string[] = []
  let currentRecord: MutablePubmedRecord | null = null
  let currentMeshHeading: MutableMeshHeading | null = null
  let capture: TextCapture | null = null
  let depth = 0
  let sawArticleSetRoot = false

  const parser = new SaxesParser({ xmlns: false })

  function startCapture(
    kind: CaptureKind,
    elementName: string,
    attributes: Record<string, unknown>,
  ) {
    if (capture) {
      throw new PubmedMetadataParseError(
        `Unexpected nested PubMed metadata element ${elementName}.`,
      )
    }
    capture = {
      depth,
      elementName,
      kind,
      majorTopic: isMajorTopic(attributes),
      text: '',
    }
  }

  function appendRecordText(text: string) {
    if (!currentRecord) return
    currentRecord.textLength += text.length
    if (currentRecord.textLength > limits.maxRecordTextLength) {
      throw new PubmedMetadataParseError('A PubMed XML record exceeded the accepted text length.')
    }
    if (!capture) return
    capture.text += text
    if (capture.text.length > limits.maxElementTextLength) {
      throw new PubmedMetadataParseError(
        `PubMed XML ${capture.elementName} exceeded the accepted text length.`,
      )
    }
  }

  function finishCapture() {
    if (!capture || !currentRecord) return
    const finished = capture
    capture = null
    const value = normalizeMetadataValue(finished.text)
    if (!value) return

    switch (finished.kind) {
      case 'pmid':
        if (!/^\d{1,12}$/u.test(value)) {
          throw new PubmedMetadataParseError(`PubMed XML contains invalid PMID "${value}".`)
        }
        if (currentRecord.pmid && currentRecord.pmid !== value) {
          throw new PubmedMetadataParseError('A PubMed XML record contains multiple PMIDs.')
        }
        currentRecord.pmid = value
        break
      case 'descriptor':
        if (!currentMeshHeading) {
          throw new PubmedMetadataParseError('MeSH descriptor appeared outside MeshHeading.')
        }
        currentMeshHeading.descriptor = value
        currentMeshHeading.descriptorMajorTopic = finished.majorTopic
        break
      case 'qualifier':
        if (!currentMeshHeading) {
          throw new PubmedMetadataParseError('MeSH qualifier appeared outside MeshHeading.')
        }
        if (currentMeshHeading.qualifiers.length >= limits.maxValuesPerField) {
          throw new PubmedMetadataParseError('A MeSH heading contains too many qualifiers.')
        }
        currentMeshHeading.qualifiers.push({ majorTopic: finished.majorTopic, name: value })
        break
      case 'keyword':
        pushBounded(currentRecord.authorKeywords, value, 'keywords', limits)
        break
      case 'publicationType':
        pushBounded(currentRecord.publicationTypes, value, 'publication types', limits)
        break
      case 'language': {
        const validation = validateLiteratureLanguage(value)
        if (validation.valid && validation.normalized) {
          pushBounded(currentRecord.languages, validation.normalized, 'languages', limits)
        } else {
          pushBounded(currentRecord.invalidLanguages, value, 'invalid languages', limits)
        }
        break
      }
    }
  }

  function finishRecord() {
    if (!currentRecord?.pmid) {
      throw new PubmedMetadataParseError('A PubMed XML record is missing its PMID.')
    }
    if (seenPmids.has(currentRecord.pmid)) {
      throw new PubmedMetadataParseError(
        `PubMed XML contains duplicate PMID ${currentRecord.pmid}.`,
      )
    }
    if (records.length >= limits.maxRecords) {
      throw new PubmedMetadataParseError(
        `PubMed XML exceeded the ${limits.maxRecords}-record response limit.`,
      )
    }

    const meshHeadings = currentRecord.meshHeadings.map((heading) => ({
      ...heading,
      qualifiers: heading.qualifiers.filter(
        (qualifier, index, values) =>
          values.findIndex(
            (candidate) =>
              candidate.name === qualifier.name && candidate.majorTopic === qualifier.majorTopic,
          ) === index,
      ),
    }))
    records.push({
      pmid: currentRecord.pmid,
      meshHeadings,
      meshTerms: stableUnique(meshHeadings.map(meshHeadingDisplayValue)),
      authorKeywords: stableUnique(currentRecord.authorKeywords),
      publicationTypes: stableUnique(currentRecord.publicationTypes),
      languages: stableUnique(currentRecord.languages),
      invalidLanguages: stableUnique(currentRecord.invalidLanguages),
    })
    seenPmids.add(currentRecord.pmid)
    currentRecord = null
  }

  parser.on('doctype', (doctype) => {
    if (!isAllowedPubmedArticleSetDoctype(doctype)) {
      throw new PubmedMetadataParseError('PubMed XML contains an unapproved DOCTYPE declaration.')
    }
  })
  parser.on('error', (error) => {
    if (error instanceof PubmedMetadataParseError) throw error
    throw new PubmedMetadataParseError(`Invalid PubMed XML: ${error.message}`)
  })
  parser.on('opentag', (node) => {
    const name = localXmlName(node.name)
    depth += 1
    if (depth > limits.maxDepth) {
      throw new PubmedMetadataParseError(
        `PubMed XML exceeded the ${limits.maxDepth}-element nesting limit.`,
      )
    }
    elementStack.push(name)
    const parentName = elementStack.at(-2)

    if (depth === 1) {
      if (name !== 'PubmedArticleSet') {
        throw new PubmedMetadataParseError(
          `Unexpected PubMed XML root element ${name}; expected PubmedArticleSet.`,
        )
      }
      sawArticleSetRoot = true
    }

    if (name === 'PubmedArticle' || name === 'PubmedBookArticle') {
      if (parentName !== 'PubmedArticleSet') {
        throw new PubmedMetadataParseError('PubMed records must be direct ArticleSet children.')
      }
      if (currentRecord) {
        throw new PubmedMetadataParseError('Nested PubMed records are not accepted.')
      }
      currentRecord = newMutableRecord()
      return
    }
    if (!currentRecord) return

    const attributes = node.attributes as Record<string, unknown>
    if (name === 'PMID' && (parentName === 'MedlineCitation' || parentName === 'BookDocument')) {
      startCapture('pmid', name, attributes)
    } else if (name === 'MeshHeading') {
      if (currentMeshHeading) {
        throw new PubmedMetadataParseError('Nested MeSH headings are not accepted.')
      }
      currentMeshHeading = { descriptor: null, descriptorMajorTopic: false, qualifiers: [] }
    } else if (name === 'DescriptorName' && currentMeshHeading) {
      startCapture('descriptor', name, attributes)
    } else if (name === 'QualifierName' && currentMeshHeading) {
      startCapture('qualifier', name, attributes)
    } else if (name === 'Keyword' && elementStack.includes('KeywordList')) {
      startCapture('keyword', name, attributes)
    } else if (
      name === 'PublicationType' &&
      (elementStack.includes('PublicationTypeList') || parentName === 'BookDocument')
    ) {
      startCapture('publicationType', name, attributes)
    } else if (
      name === 'Language' &&
      (elementStack.includes('Article') || parentName === 'BookDocument')
    ) {
      startCapture('language', name, attributes)
    }
  })
  parser.on('text', appendRecordText)
  parser.on('cdata', appendRecordText)
  parser.on('closetag', (node) => {
    const name = localXmlName(node.name)
    if (capture?.elementName === name && capture.depth === depth) finishCapture()

    if (name === 'MeshHeading') {
      if (!currentMeshHeading?.descriptor) {
        throw new PubmedMetadataParseError('A MeSH heading is missing its descriptor.')
      }
      if (!currentRecord) {
        throw new PubmedMetadataParseError('MeSH heading appeared outside a PubMed record.')
      }
      if (currentRecord.meshHeadings.length >= limits.maxValuesPerField) {
        throw new PubmedMetadataParseError('A PubMed record contains too many MeSH headings.')
      }
      currentRecord.meshHeadings.push({
        descriptor: currentMeshHeading.descriptor,
        descriptorMajorTopic: currentMeshHeading.descriptorMajorTopic,
        qualifiers: currentMeshHeading.qualifiers,
      })
      currentMeshHeading = null
    }
    if (name === 'PubmedArticle' || name === 'PubmedBookArticle') finishRecord()

    const expected = elementStack.pop()
    depth -= 1
    if (expected !== name) {
      throw new PubmedMetadataParseError(`Unexpected PubMed XML closing element ${name}.`)
    }
  })

  try {
    parser.write(xml).close()
  } catch (error) {
    if (error instanceof PubmedMetadataParseError) throw error
    throw new PubmedMetadataParseError(
      `Invalid PubMed XML: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (
    !sawArticleSetRoot ||
    currentRecord ||
    currentMeshHeading ||
    capture ||
    elementStack.length > 0 ||
    depth !== 0
  ) {
    throw new PubmedMetadataParseError('PubMed XML ended with an incomplete record or element.')
  }
  return records
}

export interface ExistingPubmedMetadataRow {
  author_keywords: unknown
  languages: unknown
  mesh_terms: unknown
  pmid: string
  publication_types: unknown
  updated_at: string
}

export interface PubmedMetadataDatabasePatch {
  author_keywords?: string[]
  languages?: string[]
  mesh_terms?: string[]
  publication_types?: string[]
}

export type PubmedMetadataFieldDecisionStatus =
  | 'conflict'
  | 'fill_empty'
  | 'replace_invalid'
  | 'source_empty'
  | 'unchanged'

export interface PubmedMetadataFieldDecision {
  existing: string[]
  invalidExisting: string[]
  proposed: string[]
  status: PubmedMetadataFieldDecisionStatus
}

export interface PubmedMetadataUpdatePlan {
  conflicts: PubmedMetadataField[]
  decisions: Record<PubmedMetadataField, PubmedMetadataFieldDecision>
  patch: PubmedMetadataDatabasePatch
  pmid: string
  updatedAt: string
}

interface ClassifiedArray {
  invalid: string[]
  valid: string[]
  valueKind: 'empty' | 'invalid' | 'mixed' | 'valid'
}

function classifyArray(value: unknown, field: PubmedMetadataField): ClassifiedArray {
  if (!Array.isArray(value)) {
    return {
      invalid: value === null || value === undefined ? [] : [String(value)],
      valid: [],
      valueKind: value === null || value === undefined ? 'empty' : 'invalid',
    }
  }

  const valid: string[] = []
  const invalid: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') {
      invalid.push(String(item))
      continue
    }
    const normalized = normalizeMetadataValue(item)
    if (!normalized) continue
    if (field === 'languages') {
      const validation = validateLiteratureLanguage(normalized)
      if (validation.valid && validation.normalized) valid.push(validation.normalized)
      else invalid.push(normalized)
    } else {
      valid.push(normalized)
    }
  }

  const stableValid = stableUnique(valid)
  const stableInvalid = stableUnique(invalid)
  const valueKind =
    stableValid.length === 0 && stableInvalid.length === 0
      ? 'empty'
      : stableValid.length === 0
        ? 'invalid'
        : stableInvalid.length > 0
          ? 'mixed'
          : 'valid'
  return { valid: stableValid, invalid: stableInvalid, valueKind }
}

function canonicalArray(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function arraysEqual(left: string[], right: string[]): boolean {
  return JSON.stringify(canonicalArray(left)) === JSON.stringify(canonicalArray(right))
}

const fieldToColumn: Record<PubmedMetadataField, keyof PubmedMetadataDatabasePatch> = {
  meshTerms: 'mesh_terms',
  authorKeywords: 'author_keywords',
  publicationTypes: 'publication_types',
  languages: 'languages',
}

export function planPubmedMetadataUpdate(
  current: ExistingPubmedMetadataRow,
  fetched: PubmedMetadataRecord,
): PubmedMetadataUpdatePlan {
  if (current.pmid !== fetched.pmid) {
    throw new Error(`Cannot plan PubMed metadata across PMIDs ${current.pmid} and ${fetched.pmid}.`)
  }

  const currentValues: Record<PubmedMetadataField, unknown> = {
    meshTerms: current.mesh_terms,
    authorKeywords: current.author_keywords,
    publicationTypes: current.publication_types,
    languages: current.languages,
  }
  const fetchedValues: Record<PubmedMetadataField, string[]> = {
    meshTerms: stableUnique(fetched.meshTerms),
    authorKeywords: stableUnique(fetched.authorKeywords),
    publicationTypes: stableUnique(fetched.publicationTypes),
    languages: stableUnique(
      fetched.languages.flatMap((value) => {
        const validation = validateLiteratureLanguage(value)
        return validation.valid && validation.normalized ? [validation.normalized] : []
      }),
    ),
  }
  const patch: PubmedMetadataDatabasePatch = {}
  const conflicts: PubmedMetadataField[] = []
  const decisions = {} as Record<PubmedMetadataField, PubmedMetadataFieldDecision>

  for (const field of pubmedMetadataFields) {
    const existing = classifyArray(currentValues[field], field)
    const proposed = fetchedValues[field]
    let status: PubmedMetadataFieldDecisionStatus

    if (proposed.length === 0) {
      status = 'source_empty'
    } else if (existing.valueKind === 'empty') {
      status = 'fill_empty'
      patch[fieldToColumn[field]] = proposed
    } else if (existing.valueKind === 'invalid') {
      status = 'replace_invalid'
      patch[fieldToColumn[field]] = proposed
    } else if (existing.valueKind === 'valid' && arraysEqual(existing.valid, proposed)) {
      status = 'unchanged'
    } else {
      status = 'conflict'
      conflicts.push(field)
    }

    decisions[field] = {
      existing: existing.valid,
      invalidExisting: existing.invalid,
      proposed,
      status,
    }
  }

  return {
    pmid: current.pmid,
    updatedAt: current.updated_at,
    patch,
    conflicts,
    decisions,
  }
}
