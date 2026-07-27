import type { ActiveLocale } from '@/i18n/locale'

interface LocalizedTopic {
  labelEn: string
  labelEs: string | null
  labelZhCn: string | null
}

export function literatureTopicLabel(topic: LocalizedTopic, locale: ActiveLocale) {
  if (locale === 'es') {
    return topic.labelEs ?? topic.labelEn
  }
  if (locale === 'zh-CN') {
    return topic.labelZhCn ?? topic.labelEn
  }
  return topic.labelEn
}

export function compactLiteratureAuthors(
  authors: Array<{ fullName: string }>,
  collectiveAuthors: string[] = [],
) {
  const names = authors.map((author) => author.fullName)
  const availableNames = names.length > 0 ? names : collectiveAuthors
  if (availableNames.length === 0) {
    return null
  }
  if (availableNames.length <= 3) {
    return availableNames.join(', ')
  }
  return `${availableNames.slice(0, 3).join(', ')}, et al.`
}

export function literatureCitationParts(article: {
  journalTitle: string | null
  journalAbbreviation: string | null
  publicationYear: number | null
  volume?: string | null
  issue?: string | null
  pages?: string | null
  articleNumber?: string | null
}) {
  const journal = article.journalAbbreviation ?? article.journalTitle
  const volumeAndIssue = article.volume
    ? `${article.volume}${article.issue ? `(${article.issue})` : ''}`
    : null
  const locator = article.pages ?? article.articleNumber ?? null

  return [journal, article.publicationYear, volumeAndIssue, locator]
    .filter((part): part is string | number => part !== null)
    .join('; ')
}
