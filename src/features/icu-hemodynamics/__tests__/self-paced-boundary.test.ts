import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * HD-01 — structural guarantees of the self-paced conversion, read from the module's own source.
 *
 * A conversion that only relabelled a page could leave a grade writer or a response event wired up
 * underneath; these fail if one comes back. They read the feature and its routes, not tests or the
 * shared packages, so another module's code cannot mask or trip them.
 */
const ROOTS = ['src/features/icu-hemodynamics', 'src/app/[locale]/icu-hemodynamics'].map((root) =>
  path.join(process.cwd(), root),
)

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === 'test-support' ? [] : sourceFiles(target)
    }
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [target] : []
  })
}

const files = ROOTS.flatMap(sourceFiles)
const relative = (file: string) => path.relative(process.cwd(), file)
const read = (file: string) => readFileSync(file, 'utf8')

describe('the self-paced boundary of ICU hemodynamics', () => {
  it('reads the module source', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('lets only the self-paced record touch browser storage', () => {
    const touching = files
      .filter((file) => /\b(localStorage|sessionStorage)\b/.test(read(file)))
      .map(relative)
      .sort()
    expect(touching).toEqual([
      'src/features/icu-hemodynamics/components/useHemodynamicsSelfPacedRecord.ts',
      'src/features/icu-hemodynamics/engine/selfPacedProgress.ts',
    ])
  })

  it('writes no graded or normalized progress and reports no answer, hint, safety or outcome event', () => {
    const forbidden = [
      /writeCriticalCareProgress/,
      /upsertCriticalCareActivityProgress/,
      /readCriticalCareProgress/,
      /recordIcuHemodynamicsResult/,
      /writeIcuHemodynamicsProgress/,
      /recordCriticalCareEvent/,
      /\.record(PredictionSubmitted|HintUsed|SafetyEvent|GoalMet|DebriefViewed|TransferCompleted|ActivityCompleted)\b/,
    ]
    const hits = files.flatMap((file) => {
      const text = read(file)
      return forbidden
        .filter((pattern) => pattern.test(text))
        .map((p) => `${relative(file)}: ${p.source}`)
    })
    expect(hits).toEqual([])
  })

  it('shows no correct-answer count, quota, first-response or assisted tally in component copy', () => {
    const componentFiles = files.filter((file) => file.includes(`${path.sep}components${path.sep}`))
    const patterns = [
      /of 5 correct/i,
      /REQUIRED_CORRECT/,
      /five correct/i,
      /first response/i,
      /assisted retr/i,
      /data-first-attempt-record/,
      /data-first-commitment/,
      /worked through/i,
    ]
    const hits = componentFiles.flatMap((file) => {
      const text = read(file)
      return patterns
        .filter((pattern) => pattern.test(text))
        .map((p) => `${relative(file)}: ${p.source}`)
    })
    expect(hits).toEqual([])
  })
})
