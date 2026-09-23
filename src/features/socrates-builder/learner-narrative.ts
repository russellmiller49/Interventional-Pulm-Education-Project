/** Lossless narrative support. No diagnosis, missing observation or clinical text is inferred. */
export const narrativeHeadings = [
  'What to notice',
  'Key learning point',
  'Expected study classification',
  'Common pitfall',
] as const

export function narrativeSections(text: string) {
  const pattern =
    /^(What to notice|Key learning point|Expected study classification|Common pitfall)\r?$/gm
  const matches = [...text.matchAll(pattern)]
  return matches.map((match, index) => ({
    heading: match[1],
    // Slices retain the original punctuation, paragraph breaks and qualifications.
    body: text.slice(match.index! + match[0].length, matches[index + 1]?.index ?? text.length),
  }))
}

export function narrativeClassification(text: string, label: string) {
  const sections = narrativeSections(text).filter(
    (s) => s.heading === 'Expected study classification',
  )
  const lines =
    sections.length === 1
      ? sections[0].body.split(/\r?\n/).filter((line) => line.startsWith(label + ': '))
      : []
  if (lines.length !== 1) return { designation: '', reasoning: '' }
  const value = lines[0].slice(label.length + 2)
  const stop = value.indexOf('. ')
  if (stop < 1) return { designation: '', reasoning: '' }
  return { designation: value.slice(0, stop), reasoning: value.slice(stop + 2) }
}

export function narrativeTeaching(text: string) {
  return {
    lowMagnificationObservations: [] as string[],
    highMagnificationObservations: [] as string[],
    keyLearningPoints: [] as string[],
    adequacy: narrativeClassification(text, 'Adequacy'),
    cancer: narrativeClassification(text, 'Cancer vs non-cancer'),
    preliminaryDiagnosis: null,
  }
}

export function narrativeIssues(text: string): string[] {
  const sections = narrativeSections(text)
  const issues: string[] = []
  if (!text.startsWith('What to notice\n') && !text.startsWith('What to notice\r\n'))
    issues.push('Unparsed text before What to notice.')
  for (const heading of narrativeHeadings.slice(0, 3)) {
    const matching = sections.filter((s) => s.heading === heading)
    if (matching.length !== 1 || !matching[0].body.trim())
      issues.push('Missing, repeated or empty section: ' + heading)
  }
  if (sections.filter((s) => s.heading === 'Common pitfall').length > 1)
    issues.push('Repeated Common pitfall section.')
  const teaching = narrativeTeaching(text)
  for (const [label, value] of [
    ['Adequacy', teaching.adequacy],
    ['Cancer', teaching.cancer],
  ] as const)
    if (!value.designation.trim() || !value.reasoning.trim())
      issues.push(label + ' classification or reasoning needs review.')
  const classification = sections.find((s) => s.heading === 'Expected study classification')
  if (
    classification?.body
      .split(/\r?\n/)
      .some(
        (line) =>
          line.trim() &&
          !line.startsWith('Adequacy: ') &&
          !line.startsWith('Cancer vs non-cancer: '),
      )
  )
    issues.push('Unparsed classification text retained in the narrative.')
  return issues
}
