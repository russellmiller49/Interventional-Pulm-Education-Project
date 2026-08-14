import { promises as fs } from 'fs'
import path from 'path'

/**
 * INSTITUTIONAL CONTRACT FOUNDATION — FICTIONAL DATA ONLY.
 *
 * Static import boundary: the D2A institutional modules are a contract exercise and must
 * stay unreferenced by every production surface — routes, components, API handlers,
 * server actions, analytics, and other features. Only the institutional feature folder
 * itself and its test suites may import them, and the canonical fixture may be imported
 * only by the sealed adapter and tests, so no route can rebuild an adapter around the
 * fixture or a test-only factory.
 */

const SRC_ROOT = path.join(process.cwd(), 'src')
const INSTITUTIONAL_DIR = path.join(SRC_ROOT, 'features', 'device-intelligence', 'institutional')
const TESTS_DIR = path.join(SRC_ROOT, 'features', 'device-intelligence', '__tests__')

const IMPORT_PATTERN =
  /device-intelligence\/institutional\/(contracts|fictional-fixtures|fictional-readonly-adapter)/

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') return []
        return walk(fullPath)
      }
      return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) ? [fullPath] : []
    }),
  )
  return files.flat()
}

describe('D2A runtime import boundary', () => {
  it('keeps every institutional module unreferenced outside the feature and its tests', async () => {
    const files = await walk(SRC_ROOT)
    expect(files.length).toBeGreaterThan(100)
    const offenders: string[] = []
    await Promise.all(
      files.map(async (file) => {
        if (file.startsWith(INSTITUTIONAL_DIR) || file.startsWith(TESTS_DIR)) return
        const content = await fs.readFile(file, 'utf8')
        if (IMPORT_PATTERN.test(content)) {
          offenders.push(path.relative(SRC_ROOT, file))
        }
      }),
    )
    expect(offenders).toEqual([])
  })

  it('keeps the canonical fixture importable only by the sealed adapter within the feature', async () => {
    const files = await walk(INSTITUTIONAL_DIR)
    const offenders: string[] = []
    await Promise.all(
      files.map(async (file) => {
        const content = await fs.readFile(file, 'utf8')
        if (
          /from '\.\/fictional-fixtures'/.test(content) &&
          path.basename(file) !== 'fictional-readonly-adapter.ts' &&
          path.basename(file) !== 'fictional-fixtures.ts'
        ) {
          offenders.push(path.relative(SRC_ROOT, file))
        }
      }),
    )
    expect(offenders).toEqual([])
  })

  it('keeps the sealed adapter free of any arbitrary-input factory export', async () => {
    const source = await fs.readFile(
      path.join(INSTITUTIONAL_DIR, 'fictional-readonly-adapter.ts'),
      'utf8',
    )
    // Exactly one exported factory, declared with an empty parameter list.
    const factoryExports = source.match(/export function create\w*Adapter\s*\(/g) ?? []
    expect(factoryExports).toEqual([
      'export function createFictionalInstitutionalOverlayReadAdapter(',
    ])
    expect(source).toMatch(/export function createFictionalInstitutionalOverlayReadAdapter\(\)/)
  })

  it('exposes only the serialized JSON request boundary — no object-input parser survives', async () => {
    const contractsSource = await fs.readFile(path.join(INSTITUTIONAL_DIR, 'contracts.ts'), 'utf8')
    const adapterSource = await fs.readFile(
      path.join(INSTITUTIONAL_DIR, 'fictional-readonly-adapter.ts'),
      'utf8',
    )

    // The one public request boundary is the JSON parser; the object parser is gone.
    expect(contractsSource).toMatch(/export function parseOverlayProjectionRequestJson\(/)
    expect(contractsSource).not.toMatch(/export function parseOverlayProjectionRequest\b(?!Json)/)

    // The object-reading request schemas are internal, not exported admission paths.
    expect(contractsSource).not.toMatch(
      /export const (demo|institutional)?[Pp]rojectionRequestSchema/,
    )
    expect(contractsSource).not.toMatch(/export const overlayProjectionRequestSchema/)

    // The removed executable-object gate leaves no residue.
    expect(contractsSource).not.toContain('plainOwnDataCopy')
    expect(contractsSource).not.toContain('captureCloneIntrinsic')
    expect(contractsSource).not.toContain('assertNonProxyStructuredData')
    expect(contractsSource).not.toMatch(/\bstructuredClone\s*\(/)

    // The adapter interface admits serialized JSON text, not a caller-supplied object.
    expect(adapterSource).toMatch(
      /readonly projectJson: \(requestJson: unknown\) => OverlayProjection/,
    )
    expect(adapterSource).not.toMatch(/readonly project:\s*\(/)
    expect(adapterSource).not.toMatch(/\bproject\(requestInput/)
  })
})
