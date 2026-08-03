import { TextDecoder as NodeTextDecoder } from 'node:util'

import JSZip from 'jszip'

import normalizedDecisionArtifactJson from '../../../../data/ip-preference-cards/reviewed/external-review-remediation-decisions.json'

import {
  normalizeExternalReviewRemediationWorkbook,
  serializeExternalReviewRemediationDecisionArtifact,
} from '@/features/preference-cards/excel/external-review-remediation-import.server'
import { createExternalReviewRemediationWorkbook } from '@/features/preference-cards/excel/external-review-remediation-workbook.server'

Object.defineProperty(globalThis, 'TextDecoder', {
  configurable: true,
  value: NodeTextDecoder,
})

const EXPORTED_AT = '2026-07-30T00:43:03.877Z'
const FILE_NAME = 'IP_External_Review_Focused_Remediation_2026-07-30_completed.xlsx'
const PRODUCT_WORKSHEET_PATH = 'xl/worksheets/sheet2.xml'
const SLOT_WORKSHEET_PATH = 'xl/worksheets/sheet3.xml'
const LOOKUPS_WORKSHEET_PATH = 'xl/worksheets/sheet4.xml'

function xmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function textCell(reference: string, value: string, style = 6): string {
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t>${xmlText(value)}</t></is></c>`
}

function numericCell(reference: string, value: string, style = 5): string {
  return `<c r="${reference}" s="${style}"><v>${xmlText(value)}</v></c>`
}

function formulaStringCell(reference: string, formula: string, cachedValue: string): string {
  return `<c r="${reference}" s="6" t="str"><f>${xmlText(formula)}</f><v>${xmlText(
    cachedValue,
  )}</v></c>`
}

async function patchWorkbook(
  bytes: Uint8Array,
  patches: Array<{
    worksheetPath: string
    cells: Record<string, string>
  }>,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes)
  for (const patch of patches) {
    const entry = zip.file(patch.worksheetPath)
    if (!entry) throw new Error(`Test helper could not find ${patch.worksheetPath}.`)
    let xml = await entry.async('string')
    for (const [reference, replacement] of Object.entries(patch.cells)) {
      const pattern = new RegExp(`<c r="${reference}"[^>]*>[\\s\\S]*?<\\/c>`)
      if (!pattern.test(xml)) {
        throw new Error(`Test helper could not find cell ${reference}.`)
      }
      xml = xml.replace(pattern, replacement)
    }
    zip.file(patch.worksheetPath, xml)
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}

async function completedWorkbook(): Promise<{
  bytes: Uint8Array
  productReviewKeys: string[]
}> {
  const workbook = await createExternalReviewRemediationWorkbook(
    'https://example.test',
    'en',
    EXPORTED_AT,
  )
  const productCells: Record<string, string> = {}
  for (let rowNumber = 2; rowNumber <= 64; rowNumber += 1) {
    productCells[`V${rowNumber}`] = textCell(`V${rowNumber}`, 'Approve as proposed')
    productCells[`W${rowNumber}`] = textCell(`W${rowNumber}`, 'Reviewed and approved.')
  }
  for (const rowNumber of [4, 41]) {
    productCells[`V${rowNumber}`] = textCell(`V${rowNumber}`, 'Approve with modification')
    productCells[`W${rowNumber}`] = textCell(
      `W${rowNumber}`,
      'Approve with the stated role modification.',
    )
  }
  for (const rowNumber of [9, 13, 16, 63]) {
    productCells[`V${rowNumber}`] = textCell(`V${rowNumber}`, 'Reject')
    productCells[`W${rowNumber}`] = textCell(
      `W${rowNumber}`,
      'Reject this proposal and retain it for governed follow-up.',
    )
  }
  for (const rowNumber of [2, 3, 5, 6, 7, 8]) {
    productCells[`W${rowNumber}`] = textCell(`W${rowNumber}`, '')
  }

  const slotCells: Record<string, string> = {}
  for (let rowNumber = 2; rowNumber <= 35; rowNumber += 1) {
    const decision = rowNumber <= 17 ? 'Approve as proposed' : 'Approve with modification'
    slotCells[`U${rowNumber}`] = textCell(`U${rowNumber}`, decision)
    slotCells[`V${rowNumber}`] = textCell(
      `V${rowNumber}`,
      rowNumber <= 17
        ? 'Reviewed and approved.'
        : 'Approve and author the reviewed exact-slot modification.',
    )
  }

  return {
    bytes: await patchWorkbook(workbook.bytes, [
      { worksheetPath: PRODUCT_WORKSHEET_PATH, cells: productCells },
      { worksheetPath: SLOT_WORKSHEET_PATH, cells: slotCells },
    ]),
    productReviewKeys: workbook.productRows.map((row) => row.reviewKey),
  }
}

describe('focused external-review remediation completed-workbook import', () => {
  it('normalizes all 97 decisions and treats six blank plain-approval rationales as warnings', async () => {
    const completed = await completedWorkbook()
    const artifact = await normalizeExternalReviewRemediationWorkbook(completed.bytes, {
      fileName: FILE_NAME,
    })

    expect(artifact.readyToApply).toBe(true)
    expect(artifact.summary).toMatchObject({
      productReviewRows: 63,
      exactSlotReviewRows: 34,
      normalizedDecisions: 97,
      validDecisions: 97,
      invalidDecisions: 0,
      errors: 0,
      warnings: 6,
      decisionsByValue: {
        approve_as_proposed: 73,
        approve_with_modification: 20,
        needs_clinician_review: 0,
        needs_more_evidence: 0,
        defer: 0,
        reject: 4,
      },
      issuesByCode: {
        missing_approval_rationale: 6,
      },
    })
    expect(artifact.issues).toHaveLength(6)
    expect(artifact.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'warning',
          code: 'missing_approval_rationale',
          sheetName: 'Product Role Review',
          rowNumber: 2,
          reviewKey: completed.productReviewKeys[0],
        }),
      ]),
    )
    const blankApprovalRationales = artifact.decisions.filter(
      (decision) =>
        decision.reviewerDecision === 'approve_as_proposed' && decision.rationale === '',
    )
    expect(blankApprovalRationales).toHaveLength(6)

    const serialized = serializeExternalReviewRemediationDecisionArtifact(artifact)
    expect(JSON.parse(serialized)).toEqual(artifact)
    expect(serialized).not.toContain('/Users/')
  })

  it('blocks required-rationale, decision, protected-field, key, formula, and identifier defects', async () => {
    const completed = await completedWorkbook()
    const tampered = await patchWorkbook(completed.bytes, [
      {
        worksheetPath: PRODUCT_WORKSHEET_PATH,
        cells: {
          V4: textCell('V4', 'Approve with modification'),
          W4: textCell('W4', ''),
          V10: textCell('V10', 'Automatically accept'),
          E11: textCell('E11', 'Changed protected product name', 4),
          A12: textCell('A12', 'PRODUCT:PRD-UNKNOWN', 5),
          A13: textCell('A13', completed.productReviewKeys[12], 5),
          W14: formulaStringCell('W14', '"calculated rationale"', 'calculated rationale'),
          A15: numericCell('A15', '12345'),
        },
      },
    ])
    const artifact = await normalizeExternalReviewRemediationWorkbook(tampered, {
      fileName: FILE_NAME,
    })
    const codes = new Set(artifact.issues.map((candidate) => candidate.code))

    expect(artifact.readyToApply).toBe(false)
    expect([...codes]).toEqual(
      expect.arrayContaining([
        'duplicate_review_key',
        'formula_not_allowed',
        'identifier_not_text',
        'invalid_decision',
        'missing_required_rationale',
        'missing_review_key',
        'protected_field_changed',
        'unknown_review_key',
      ]),
    )
    expect(artifact.summary.errors).toBeGreaterThanOrEqual(8)
    expect(artifact.summary.invalidDecisions).toBeGreaterThanOrEqual(5)
  })

  it('blocks and redacts local paths and patient-like reviewer data', async () => {
    const completed = await completedWorkbook()
    const unsafe = await patchWorkbook(completed.bytes, [
      {
        worksheetPath: PRODUCT_WORKSHEET_PATH,
        cells: {
          W10: textCell('W10', 'See /Users/reviewer/Desktop/private-notes.txt'),
          W11: textCell('W11', 'MRN: 12345678'),
        },
      },
    ])
    const artifact = await normalizeExternalReviewRemediationWorkbook(unsafe, {
      fileName: FILE_NAME,
    })

    expect(artifact.readyToApply).toBe(false)
    expect(artifact.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'local_path_not_allowed', rowNumber: 10 }),
        expect.objectContaining({ code: 'patient_like_data', rowNumber: 11 }),
      ]),
    )
    expect(artifact.decisions.find((decision) => decision.sourceRow === 10)?.rationale).toBe('')
    expect(artifact.decisions.find((decision) => decision.sourceRow === 11)?.rationale).toBe('')
    expect(serializeExternalReviewRemediationDecisionArtifact(artifact)).not.toContain('/Users/')
    expect(serializeExternalReviewRemediationDecisionArtifact(artifact)).not.toContain('12345678')
  })

  it('rejects review-ID and normalized-corrections provenance drift', async () => {
    const completed = await completedWorkbook()
    const changedReviewId = await patchWorkbook(completed.bytes, [
      {
        worksheetPath: LOOKUPS_WORKSHEET_PATH,
        cells: {
          C3: textCell('C3', 'external-review-remediation-other', 5),
        },
      },
    ])
    const changedHash = await patchWorkbook(completed.bytes, [
      {
        worksheetPath: LOOKUPS_WORKSHEET_PATH,
        cells: {
          C5: textCell('C5', '0'.repeat(64), 5),
        },
      },
    ])

    await expect(
      normalizeExternalReviewRemediationWorkbook(changedReviewId, { fileName: FILE_NAME }),
    ).rejects.toThrow(/review ID/i)
    await expect(
      normalizeExternalReviewRemediationWorkbook(changedHash, { fileName: FILE_NAME }),
    ).rejects.toThrow(/SHA-256 does not match/i)
  })

  it('never accepts a local input path as the source-workbook filename', async () => {
    const completed = await completedWorkbook()
    await expect(
      normalizeExternalReviewRemediationWorkbook(completed.bytes, {
        fileName: `/Users/reviewer/Downloads/${FILE_NAME}`,
      }),
    ).rejects.toThrow(/local-path-free/)
  })

  it('pins the completed workbook as a safe, ready-to-apply source-controlled artifact', () => {
    const artifact = normalizedDecisionArtifactJson
    const serialized = JSON.stringify(artifact)

    expect(artifact).toMatchObject({
      formatVersion: 1,
      reviewId: 'external-review-remediation-v0.1',
      // Rebound in taxonomy v2: the corrections file's compatibility target moved from
      // GENERIC_ENERGY_PLATFORM to ENERGY_PLATFORM and its rolesToAdd categories moved onto
      // the closed browse vocabulary. The binding exists so exactly this kind of edit has to
      // be paid for deliberately rather than drifting.
      normalizedCorrectionsSha256:
        '589bd1488027c570dbc674605c8a8cd1b1b7744c348afcf1a22d2b7b707a18d9',
      sourceWorkbook: {
        fileName: FILE_NAME,
        sha256: '78b112baa0cd84f213eef0c1f014c438e811ac7bafe3e5004c7b4e51dd119b4e',
      },
      readyToApply: true,
      summary: {
        productReviewRows: 63,
        exactSlotReviewRows: 34,
        normalizedDecisions: 97,
        validDecisions: 97,
        invalidDecisions: 0,
        errors: 0,
        warnings: 6,
      },
    })
    expect(new Set(artifact.decisions.map((decision) => decision.reviewKey)).size).toBe(97)
    expect(artifact.issues).toHaveLength(6)
    expect(
      artifact.issues.every(
        (candidate) =>
          candidate.severity === 'warning' && candidate.code === 'missing_approval_rationale',
      ),
    ).toBe(true)
    expect(serialized).not.toMatch(/\/Users\/|\/home\/|file:\/\//i)
    expect(serialized).not.toMatch(
      /\b(?:MRN|medical record number|patient (?:name|id)|DOB)\s*[:#=-]\s*[A-Za-z0-9]/i,
    )
  })
})
