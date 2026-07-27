import type { LiteratureQueryRegistry } from '@/features/literature/schemas/config'
import type {
  LiteratureAuthor,
  NbibIssue,
  NormalizationResult,
  NormalizedLiteratureArticle,
  ParsedPublicationDate,
  RawNbibRecord,
} from '@/features/literature/types'

import { matchJournalRegistry } from './journal-registry'
import { normalizeTitle, normalizeWhitespace, sha256, stableJson, stableUnique } from './text'

const monthNumbers: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

const seasons = new Set(['spring', 'summer', 'autumn', 'fall', 'winter'])

function firstTag(record: RawNbibRecord, tag: string) {
  const value = record.tags[tag]?.[0]
  return value ? normalizeWhitespace(value) : null
}

function tagValues(record: RawNbibRecord, tag: string) {
  return stableUnique(record.tags[tag] ?? [])
}

function normalizeAbstractPart(value: string) {
  const lines = value.split(/\r?\n/u).map(normalizeWhitespace).filter(Boolean)

  return lines.reduce((result, line) => {
    if (!result) {
      return line
    }

    if (/^[\p{Lu}\d][\p{Lu}\d /-]{1,40}:/u.test(line)) {
      return `${result}\n${line}`
    }

    return `${result} ${line}`
  }, '')
}

function cleanDoiCandidate(value: string) {
  const match = value.match(/^(.*?)\s*\[doi\]\s*[\s.]*$/iu)
  if (!match) {
    return null
  }

  const candidate = match[1]
    .trim()
    .replace(/^doi\s*:\s*/iu, '')
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, '')
    .replace(/[.,;:]+$/u, '')
    .trim()
    .toLocaleLowerCase('en-US')

  return /^10\.\d{4,9}\/\S+$/u.test(candidate) ? candidate : null
}

export function extractDoiCandidates(record: RawNbibRecord) {
  return stableUnique(
    [...(record.tags.LID ?? []), ...(record.tags.AID ?? [])]
      .map(cleanDoiCandidate)
      .filter((value): value is string => Boolean(value)),
  )
}

function extractPmcid(record: RawNbibRecord) {
  for (const value of [
    ...(record.tags.PMC ?? []),
    ...(record.tags.SI ?? []),
    ...(record.tags.AID ?? []),
  ]) {
    const match = value.match(/\bPMC\d+\b/iu)
    if (match) {
      return match[0].toUpperCase()
    }
  }
  return null
}

function extractArticleNumber(record: RawNbibRecord) {
  for (const value of [...(record.tags.LID ?? []), ...(record.tags.AID ?? [])]) {
    const match = value.match(/^(.*?)\s*\[(?:pii|elocation id)\]\s*$/iu)
    if (match) {
      return normalizeWhitespace(match[1])
    }
  }
  return null
}

function validDateParts(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false
  }
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

export function parsePublicationDate(rawValue: string | null): ParsedPublicationDate {
  if (!rawValue) {
    return { raw: null, year: null, month: null, day: null, precision: 'unknown' }
  }

  const raw = normalizeWhitespace(rawValue)
  if (/\b(?:18|19|20|21)\d{2}\s*[-–—]\s*(?:18|19|20|21)\d{2}\b/u.test(raw)) {
    return {
      raw,
      year: null,
      month: null,
      day: null,
      precision: 'unknown',
    }
  }
  const yearMatch = raw.match(/\b(18|19|20|21)\d{2}\b/u)
  if (!yearMatch) {
    return { raw, year: null, month: null, day: null, precision: 'unknown' }
  }

  const year = Number.parseInt(yearMatch[0], 10)
  const remainder = raw.slice((yearMatch.index ?? 0) + yearMatch[0].length).trim()
  if (!remainder) {
    return { raw, year, month: null, day: null, precision: 'year' }
  }

  const lowerRemainder = remainder.toLocaleLowerCase('en-US')
  if ([...seasons].some((season) => lowerRemainder.includes(season))) {
    return { raw, year, month: null, day: null, precision: 'season' }
  }

  const monthToken = lowerRemainder.match(/[a-z]+/u)?.[0]
  const numericMonth = lowerRemainder.match(/^(\d{1,2})(?:\s|$)/u)?.[1]
  const month = monthToken
    ? (monthNumbers[monthToken] ?? null)
    : numericMonth
      ? Number.parseInt(numericMonth, 10)
      : null

  if (!month || month < 1 || month > 12) {
    return { raw, year, month: null, day: null, precision: 'unknown' }
  }

  if (/[-–—]\s*[a-z]/u.test(lowerRemainder)) {
    return { raw, year, month: null, day: null, precision: 'unknown' }
  }

  const afterMonth = monthToken
    ? lowerRemainder.slice(lowerRemainder.indexOf(monthToken) + monthToken.length)
    : lowerRemainder.slice(numericMonth?.length ?? 0)
  const trimmedAfterMonth = afterMonth.trim()
  const dayToken = trimmedAfterMonth.match(/^(\d{1,2})(?:\b|$)/u)?.[1]

  if (!dayToken) {
    return { raw, year, month, day: null, precision: 'month' }
  }

  if (/^\d{1,2}\s*[-–—]\s*\d{1,2}\b/u.test(trimmedAfterMonth)) {
    return { raw, year, month, day: null, precision: 'month' }
  }

  const day = Number.parseInt(dayToken, 10)
  if (!validDateParts(year, month, day)) {
    return { raw, year, month, day: null, precision: 'month' }
  }

  return { raw, year, month, day, precision: 'day' }
}

function parsePubmedTimestamp(value: string | null) {
  if (!value) {
    return null
  }

  const compact = value.match(/^(\d{4})(\d{2})(\d{2})$/u)
  const separated = value.match(/^(\d{4})[/-](\d{2})[/-](\d{2})(?:\s+(\d{2}):(\d{2}))?/u)
  const match = compact ?? separated
  if (!match) {
    return null
  }

  const [, yearValue, monthValue, dayValue, hourValue = '00', minuteValue = '00'] = match
  const year = Number.parseInt(yearValue, 10)
  const month = Number.parseInt(monthValue, 10)
  const day = Number.parseInt(dayValue, 10)
  if (!validDateParts(year, month, day)) {
    return null
  }

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      Number.parseInt(hourValue, 10),
      Number.parseInt(minuteValue, 10),
    ),
  ).toISOString()
}

function buildAuthors(record: RawNbibRecord): LiteratureAuthor[] {
  const fullNames = tagValues(record, 'FAU')
  const abbreviatedNames = tagValues(record, 'AU')
  const names = fullNames.length > 0 ? fullNames : abbreviatedNames

  return names.map((name, index) => ({
    fullName: name,
    abbreviatedName: fullNames.length > 0 ? (abbreviatedNames[index] ?? null) : name,
  }))
}

function hasPublicationType(publicationTypes: string[], pattern: RegExp) {
  return publicationTypes.some((publicationType) => pattern.test(publicationType))
}

function buildMetadataHashPayload(
  article: Omit<NormalizedLiteratureArticle, 'metadataHash' | 'normalizedTitleHash'>,
) {
  return {
    ...article,
    rawNbibTags: article.rawNbibTags,
  }
}

export function normalizeNbibRecord(
  record: RawNbibRecord,
  registry?: LiteratureQueryRegistry,
  parserIssues: NbibIssue[] = [],
): NormalizationResult {
  const issues = [...parserIssues]
  const pmid = firstTag(record, 'PMID')

  if (!pmid || !/^\d{1,12}$/u.test(pmid)) {
    const code = pmid ? 'INVALID_PMID' : 'MISSING_PMID'
    if (!issues.some((issue) => issue.code === code)) {
      issues.push({
        code,
        message: pmid
          ? `PMID "${pmid}" is not a supported numeric identifier.`
          : 'The NBIB record has no PMID and was quarantined.',
        recordNumber: record.recordNumber,
        tag: 'PMID',
      })
    }
    return { article: null, issues, journalMatch: null }
  }

  const title = normalizeWhitespace((record.tags.TI ?? []).join(' '))
  if (!title) {
    issues.push({
      code: 'MISSING_TITLE',
      message: `PMID ${pmid} has no title and cannot be inserted into literature_articles.`,
      recordNumber: record.recordNumber,
      tag: 'TI',
    })
    return { article: null, issues, journalMatch: null }
  }

  const doiCandidates = extractDoiCandidates(record)
  if (doiCandidates.length > 1) {
    issues.push({
      code: 'CONFLICTING_DOI',
      message: `PMID ${pmid} contains multiple DOI candidates: ${doiCandidates.join(', ')}`,
      recordNumber: record.recordNumber,
      tag: 'LID',
    })
  }

  const journalMatch = registry ? matchJournalRegistry(record, registry) : null
  const hasJournalMetadata = Boolean(
    record.tags.JID?.length || record.tags.TA?.length || record.tags.JT?.length,
  )
  if (registry && hasJournalMetadata && !journalMatch) {
    issues.push({
      code: 'UNMATCHED_JOURNAL',
      message: `PMID ${pmid} did not match a registry journal.`,
      recordNumber: record.recordNumber,
      tag: 'JT',
    })
  }

  const publicationDate = parsePublicationDate(firstTag(record, 'DP'))
  const publicationTypes = tagValues(record, 'PT')
  const normalizedTitle = normalizeTitle(title)
  const abstractParts = (record.tags.AB ?? []).map(normalizeAbstractPart).filter(Boolean)
  const abstract = abstractParts.length > 0 ? abstractParts.join('\n\n') : null
  const rawNbibTags = Object.fromEntries(
    Object.entries(record.tags)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([tag, values]) => [tag, values.map((value) => value.trim())]),
  )

  const articleWithoutHashes: Omit<
    NormalizedLiteratureArticle,
    'metadataHash' | 'normalizedTitleHash'
  > = {
    pmid,
    doi: doiCandidates[0] ?? null,
    doiCandidates,
    pmcid: extractPmcid(record),
    title,
    abstract,
    abstractDisplayPolicy: 'snippet_only',
    journalId: journalMatch?.id ?? null,
    journalTitle: firstTag(record, 'JT'),
    journalAbbreviation: firstTag(record, 'TA'),
    nlmJournalId: firstTag(record, 'JID'),
    issnValues: tagValues(record, 'IS'),
    publicationDateRaw: publicationDate.raw,
    publicationYear: publicationDate.year,
    publicationMonth: publicationDate.month,
    publicationDay: publicationDate.day,
    publicationDatePrecision: publicationDate.precision,
    publicationTypes,
    meshTerms: tagValues(record, 'MH'),
    authorKeywords: tagValues(record, 'OT'),
    languages: tagValues(record, 'LA'),
    authors: buildAuthors(record),
    collectiveAuthors: tagValues(record, 'CN'),
    affiliations: tagValues(record, 'AD'),
    volume: firstTag(record, 'VI'),
    issue: firstTag(record, 'IP'),
    pages: firstTag(record, 'PG'),
    articleNumber: extractArticleNumber(record),
    placeOfPublication: firstTag(record, 'PL'),
    citationSource: firstTag(record, 'SO'),
    conflictOfInterest: firstTag(record, 'COIS'),
    pubmedStatus: firstTag(record, 'STAT'),
    pubmedLastRevisedAt: parsePubmedTimestamp(firstTag(record, 'LR')),
    pubmedCreatedAt:
      parsePubmedTimestamp(firstTag(record, 'CRDT')) ??
      parsePubmedTimestamp(firstTag(record, 'EDAT')),
    rawNbibTags,
    normalizedTitle,
    isRetracted:
      hasPublicationType(publicationTypes, /retracted publication/iu) ||
      Boolean(record.tags.RIN?.length),
    isCorrection:
      hasPublicationType(
        publicationTypes,
        /published erratum|corrected and republished article|correction/iu,
      ) || Boolean(record.tags.CRI?.length),
    isConferenceAbstract: hasPublicationType(publicationTypes, /conference abstract|congress/iu),
  }

  const metadataHash = sha256(stableJson(buildMetadataHashPayload(articleWithoutHashes)))

  return {
    article: {
      ...articleWithoutHashes,
      metadataHash,
      normalizedTitleHash: sha256(normalizedTitle),
    },
    issues,
    journalMatch,
  }
}
