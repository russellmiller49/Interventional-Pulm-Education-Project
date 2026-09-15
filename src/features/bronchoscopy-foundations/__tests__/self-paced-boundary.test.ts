/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative, sep } from 'path'

/**
 * Structural guards for the self-paced contract (BF-01): one storage writer, and none of the
 * retired grading, first-answer or performance machinery reachable from module code.
 */
const ROOT = join(__dirname, '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return name === '__tests__' || name === 'test-support' ? [] : sourceFiles(path)
    }
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

const SOURCES = sourceFiles(ROOT)

describe('the self-paced boundary', () => {
  it('writes browser storage from the self-paced record only', () => {
    const writers = SOURCES.filter((file) =>
      /\b(localStorage|sessionStorage|store)\.setItem\(|\.setItem\(/.test(
        readFileSync(file, 'utf8'),
      ),
    ).map((file) => relative(ROOT, file).split(sep).join('/'))
    expect(writers).toEqual(['engine/selfPacedProgress.ts'])
  })

  it('reaches none of the retired grading, first-answer or performance machinery', () => {
    // The pane's live, unsaved description of the current input and assists stays in the engine.
    const retired =
      /caseStandard|BronchCapstone|evaluateCaseStandard|withFirstAttempt|withSectionCompleted|withCapstoneDebriefViewed|withInspectionSnapshot|writeBronchRecord|nextIncompleteBronchSection|workedBronchSectionIds/
    const offenders = SOURCES.filter((file) => retired.test(readFileSync(file, 'utf8'))).map(
      (file) => relative(ROOT, file).split(sep).join('/'),
    )
    expect(offenders).toEqual([])
  })

  it('reads the earlier record only through its read-only module', () => {
    const readers = SOURCES.filter((file) =>
      /from '\.{1,2}(\/\.\.)*\/engine\/learnProgress'|from '\.\/learnProgress'/.test(
        readFileSync(file, 'utf8'),
      ),
    ).map((file) => relative(ROOT, file).split(sep).join('/'))
    expect(readers.sort()).toEqual(['engine/inspectionReport.ts', 'engine/selfPacedProgress.ts'])
  })
})
