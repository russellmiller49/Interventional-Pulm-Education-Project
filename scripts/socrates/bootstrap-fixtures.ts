/** Synthetic text only; never copy workbook narratives or demo teaching regions into tests. */
import { BATCH_IDENTITIES, WORKBOOK_SHA, type Catalog } from './bootstrap-plan'
import { sourceKey, type Inspection, type Snapshot, type SourceRecord } from './import-plan'
export const syntheticNarrative =
  'What to notice\nSynthetic observation — punctuation and paragraphs stay intact.\n\nAnother synthetic paragraph.\n\nKey learning point\nSynthetic learning point.\n\nExpected study classification\nAdequacy: Synthetic adequate. Synthetic adequacy reasoning.\nCancer vs non-cancer: Synthetic category. Synthetic category reasoning.\n\nCommon pitfall\nSynthetic pitfall.'
export const syntheticDzi =
  '<Image TileSize="256" Overlap="1" Format="jpg"><Size Width="9000" Height="9900"/></Image>'
export function bootstrapFixture() {
  const records: SourceRecord[] = BATCH_IDENTITIES.map(([number, series], i) => ({
    workbookSha256: WORKBOOK_SHA,
    sourceSheet: 'Curriculum Sequence',
    sourceRow: i + 2,
    sourceValues: {
      'Overall Order': i + 1,
      Module: 'MODULE 1 — CORE SRH ORIENTATION',
      'Order in Module': i + 1,
      'Full Case Name': `Case ${number} · Series ${series} · PRIVATE_DIAGNOSTIC_NAME`,
      'Curriculum Role': 'PRIVATE_ROLE',
      'Teaching Objective / Why Here': 'PRIVATE_OBJECTIVE',
      'Full Learner-Facing Text': syntheticNarrative,
      'Internal Note · Not Learner-Facing': 'PRIVATE_NOTE',
    },
    identity: {
      caseNumberAsWritten: number,
      seriesNumberAsWritten: series,
      key: sourceKey(number, series),
    },
    moduleId: 'core-srh-orientation',
    membershipHold: null,
  }))
  const catalog: Catalog = {
    cases: [
      {
        slides: records.map((r) => {
          const id = `nio-${r.identity.caseNumberAsWritten}-series-${r.identity.seriesNumberAsWritten}-barcode-synthetic`
          return {
            id,
            caseNumber: r.identity.caseNumberAsWritten,
            series: r.identity.seriesNumberAsWritten,
            barcode: 'SYNTHETIC',
            originalDzi: `/generated/tiles/${id}/original.dzi`,
            analysisDzi: `/generated/tiles/${id}/analysis.dzi`,
          }
        }),
      },
    ],
  }
  const inspection: Inspection = {
    format: 'socrates-workbook-inspection-v1',
    sha256: WORKBOOK_SHA,
    modules: [
      'core-srh-orientation',
      'non-diagnostic-adequacy',
      'normal-lung-airway',
      'cancer',
      'inflammation-infection-granuloma',
      'advanced-cases',
    ].map((id, i) => ({ id, plannedCount: [20, 5, 8, 14, 6, 6][i] })),
    // Tail placeholders test that only the ten selected rows reach clinical parsing/packaging.
    // Full workbook structure is tested by the existing Python reader suite and real-source inspection.
    records: [...records, ...Array.from({ length: 49 }, () => ({}) as SourceRecord)],
  }
  const snapshot: Snapshot = {
    cases: [],
    modules: [{ id: 'core-srh-orientation', revision: 0 }],
    memberships: [],
  }
  return { records, inspection, catalog, snapshot }
}
