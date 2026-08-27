import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function readJsonWithBytes<T>(absolutePath: string): { value: T; bytes: Buffer } {
  const bytes = readFileSync(absolutePath)
  return { value: JSON.parse(bytes.toString('utf8')) as T, bytes }
}

export function writeOrCheckFile(options: {
  absolutePath: string
  relativePath: string
  contents: string
  check: boolean
}): void {
  const { absolutePath, relativePath, contents, check } = options
  if (check) {
    let current: string
    try {
      current = readFileSync(absolutePath, 'utf8')
    } catch {
      throw new Error(`${relativePath} is missing. Run the corresponding D2D generator.`)
    }
    if (current !== contents) {
      throw new Error(`${relativePath} is stale. Run the corresponding D2D generator.`)
    }
    return
  }
  mkdirSync(path.dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, contents)
}

export function csvField(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function csv(rows: unknown[][]): string {
  return `${rows.map((row) => row.map(csvField).join(',')).join('\n')}\n`
}

export function extractOfficialUrl(notes: string | null | undefined): string | null {
  const match = notes?.match(/Official URL:\s*(https:\/\/[^\s]+)/i)
  return match?.[1]?.replace(/[).,;]+$/, '') ?? null
}
