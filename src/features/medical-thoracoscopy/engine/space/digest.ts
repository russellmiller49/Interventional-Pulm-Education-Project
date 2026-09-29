/**
 * A short, stable digest of a text, for naming what a spatial result was computed from when there
 * is no file hash to hand (the port's frame, which two records make together). cyrb53: fast and
 * well mixed, not cryptographic; it names inputs so a change is noticed, and guards nothing.
 */
export function digest(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const value = 4294967296 * (2097151 & h2) + (h1 >>> 0)
  return value.toString(16).padStart(14, '0').slice(-12)
}

/** Numbers as a canonical text, rounded well below any modelling tolerance. */
export function numbersText(values: readonly number[]): string {
  return values.map((value) => (Math.round(value * 1e6) / 1e6).toString()).join(',')
}
