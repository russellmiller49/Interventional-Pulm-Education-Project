import { SOURCE_COMPLETENESS_REVIEW, sourceCompletenessCount } from './source-completeness-intake'
import { extractMultiPageTableSections } from './source-completeness-table-scan'

describe('source-completeness multi-page table scan', () => {
  test('retains continuation-page rows even when the heading is not repeated', () => {
    const firstPage = [
      'Shiley reusable-inner-cannula ordering information',
      '4CN65R   6.5   9.4   62',
      '5CN70R   7.0   10.1  68',
      '6CN75R   7.5   10.8  74',
    ].join('\n')
    const continuationPage = [
      '7CN75R   8.0   11.4  77',
      '8CN85R   8.5   12.2  79',
      '9CN90R   9.0   12.7  79',
      '10CN10R  10.0  13.8  79',
    ].join('\n')
    const unrelatedPage = 'Narrative without a table'

    expect(
      extractMultiPageTableSections(`${firstPage}\f${continuationPage}\f${unrelatedPage}`),
    ).toEqual([
      {
        startPage: 1,
        endPage: 2,
        rowIdentifiers: ['4CN65R', '5CN70R', '6CN75R', '7CN75R', '8CN85R', '9CN90R', '10CN10R'],
      },
    ])
  })

  test('pins the reviewed corpus-wide scan and complete correction-section dispositions', () => {
    const scan = SOURCE_COMPLETENESS_REVIEW.corpus_audit.corpus_wide_multi_page_table_scan as {
      pdfsScanned: number
      pagesScanned: number
      documentsIdentified: number
      documents: string[]
    }
    const coverage = SOURCE_COMPLETENESS_REVIEW.corpus_audit.table_page_coverage as {
      candidateCount: number
      allCandidatesDispositioned: boolean
    }[]
    expect(scan).toMatchObject({
      pdfsScanned: 115,
      pagesScanned: 2609,
      documentsIdentified: sourceCompletenessCount('corpus_wide_multi_page_table_documents'),
    })
    expect(scan.documents).toHaveLength(scan.documentsIdentified)
    expect(coverage.every((row) => row.allCandidatesDispositioned)).toBe(true)
    expect(coverage.reduce((total, row) => total + row.candidateCount, 0)).toBe(22)
  })
})
