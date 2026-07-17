import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

describe('Baxter CRRT source-matrix implementation paths', () => {
  const sourceMatrixPath = join(process.cwd(), 'docs/baxter-crrt/source-matrix.md')

  it('resolves every candidate-scoped implementation path recorded in the matrix', () => {
    const sourceMatrix = readFileSync(sourceMatrixPath, 'utf8')
    const recordedPaths = [...sourceMatrix.matchAll(/`(src\/features\/baxter-crrt\/[^`]+)`/gu)].map(
      (match) => match[1],
    )
    const uniquePaths = [...new Set(recordedPaths)]

    expect(uniquePaths.length).toBeGreaterThan(20)
    for (const relativePath of uniquePaths) {
      const absolutePath = join(process.cwd(), relativePath)
      expect(existsSync(absolutePath)).toBe(true)
      expect(statSync(absolutePath).isFile()).toBe(true)
    }
  })

  it('does not retain the superseded component names that never existed in this module', () => {
    const sourceMatrix = readFileSync(sourceMatrixPath, 'utf8')

    for (const staleLocation of [
      'device/PrisMaxConsole.tsx',
      'device/OperationsScreen.tsx',
      'device/HistoryScreen.tsx',
      'device/StopTreatmentDialog.tsx',
      'device/PrisMaxSetup.tsx',
      'device/AlarmWindow.tsx',
      'circuit/FlowPath.tsx',
      'circuit/BagAndScale.tsx',
      'citrateModel.ts',
    ]) {
      expect(sourceMatrix).not.toContain(staleLocation)
    }
  })

  it('keeps every claim row structurally complete with an explicit pending disposition', () => {
    const sourceMatrix = readFileSync(sourceMatrixPath, 'utf8')
    const claimTable = sourceMatrix.slice(
      sourceMatrix.indexOf('| Record ID'),
      sourceMatrix.indexOf('### 2.1 Numeric metadata'),
    )
    const rows = claimTable
      .split('\n')
      .filter((line) =>
        /^\| (?:DEV|MATH|FLUID|DOSE|SAFETY|RENAL|WHITE|GONEUTRAL|SYNTH|CLIN|PROTO|BRIEF)-/u.test(
          line,
        ),
      )

    expect(rows.length).toBeGreaterThan(50)
    for (const row of rows) {
      const cells = row
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim())
      expect(cells).toHaveLength(6)
      expect(cells[2]).not.toBe('')
      expect(cells[3]).not.toBe('')
      expect(cells[4]).toBe('null')
      expect(cells[5]).toBe('pending')
    }
  })
})
