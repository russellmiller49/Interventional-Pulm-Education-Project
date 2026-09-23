/**
 * Display-only copy editing for source strings (BBTF-52). The stored names, labels and codes in the
 * source export are never rewritten; these helpers change only how they read on screen.
 */

/**
 * Sentence case for a source airway name. A few exported names are in title case ("Left Lower
 * Lobe Posterior Basal segmental bronchus") beside sentence-case neighbours ("Left lateral basal
 * segmental bronchus"). The first word keeps its capital; a later word is lowered only when it is
 * a plain capitalised word, so codes such as B7+8–B9 are untouched.
 */
export function displayName(name: string) {
  return name
    .split(' ')
    .map((word, i) => (i > 0 && /^[A-Z][a-z]+[,]?$/.test(word) ? word.toLowerCase() : word))
    .join(' ')
}

/**
 * A source option label such as "LB10 · Left Lower Lobe Posterior Basal segmental bronchus" or
 * "RB8 · between the right and left daughters daughter", read with its code kept exactly.
 */
export function displayOptionLabel(label: string) {
  const [code, ...rest] = label.split(' · ')
  if (!rest.length) return label
  const text = displayName(rest.join(' · ')).replace(/\bdaughters daughter$/, 'daughters')
  return `${code} · ${text}`
}

/** "1 stop", "2 stops". */
export const count = (n: number, singular: string, plural = `${singular}s`) =>
  `${n} ${n === 1 ? singular : plural}`
