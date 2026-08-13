import { execFile } from 'node:child_process'
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

/**
 * `demo-seed-summary.json` is generated evidence: `npm run ip-cards:seed` is its only writer, and
 * nothing at runtime reads it back. That means no build or resolver breaks when a governed-data
 * correction changes scenario resolution while the committed summary keeps the old hashes — the
 * file just goes quietly stale, which is exactly what happened across the F-04..F-10 corrections.
 * This suite closes that gap by running the real generator and requiring the committed bytes to
 * match.
 *
 * The generator runs as a child process rather than an import because its serializer statically
 * imports prettier, whose CommonJS entry needs the dynamic-import support jest's VM does not
 * enable. The spawn is the exact `ip-cards:seed` command, so the comparison also covers the
 * serialization layer. `validateDemoSeed` reads `coverage-report.json` from — and writes the
 * summary into — the directory named by `IP_CARDS_OUTPUT_DIR`, so each generation runs against a
 * temp directory seeded with the committed coverage report and never touches the real generated
 * directory.
 */

const execFileAsync = promisify(execFile)

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..')
const GENERATED_DIRECTORY = path.join(REPO_ROOT, 'data', 'ip-preference-cards', 'generated')
const SUMMARY_FILE = 'demo-seed-summary.json'

async function generateSummaryInto(directory: string): Promise<string> {
  await execFileAsync(
    path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx'),
    [path.join(REPO_ROOT, 'scripts', 'ip-preference-cards', 'validate-seed.ts')],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, IP_CARDS_OUTPUT_DIR: directory },
      maxBuffer: 16 * 1024 * 1024,
    },
  )
  return readFile(path.join(directory, SUMMARY_FILE), 'utf8')
}

describe('demo seed summary', () => {
  let workingDirectory: string
  let firstRun: string
  let secondRun: string

  beforeAll(async () => {
    workingDirectory = await mkdtemp(path.join(tmpdir(), 'demo-seed-summary-'))
    await copyFile(
      path.join(GENERATED_DIRECTORY, 'coverage-report.json'),
      path.join(workingDirectory, 'coverage-report.json'),
    )
    firstRun = await generateSummaryInto(workingDirectory)
    secondRun = await generateSummaryInto(workingDirectory)
  }, 180_000)

  afterAll(async () => {
    await rm(workingDirectory, { recursive: true, force: true })
  })

  it('generates deterministically', () => {
    expect(secondRun).toBe(firstRun)
  })

  it('reproduces the committed demo-seed-summary.json byte for byte', async () => {
    const committed = await readFile(path.join(GENERATED_DIRECTORY, SUMMARY_FILE), 'utf8')
    expect(committed).toBe(firstRun)
  })
})
