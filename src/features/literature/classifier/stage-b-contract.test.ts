/** @jest-environment node */
import { STAGE_A_TERMINAL_STATES } from './stage-a-contract'
import {
  STAGE_B_ENTRY_SOURCES,
  STAGE_B_LABELS,
  STAGE_B_TERMINAL_STATES_ALWAYS_QUEUED,
  summarizeStageBQueue,
  type StageBQueueEntry,
} from './stage-b-contract'

describe('stage-b contract', () => {
  it('pins the four-way label set with insufficient_evidence first-class', () => {
    expect(STAGE_B_LABELS).toEqual([
      'include_core',
      'include_adjacent',
      'exclude',
      'insufficient_evidence',
    ])
  })

  it('queues every terminal state except a valid prediction', () => {
    expect(STAGE_B_TERMINAL_STATES_ALWAYS_QUEUED).toEqual(
      STAGE_A_TERMINAL_STATES.filter((state) => state !== 'valid_prediction'),
    )
  })

  it('aggregates queue entries without identities', () => {
    const entries: StageBQueueEntry[] = [
      {
        recordId: 'c'.repeat(64),
        evidenceProfile: 'metadata_with_abstract',
        entrySource: 'stage_a_advance_decision',
        stageATerminalState: 'valid_prediction',
        coordinatorRiskFlagCount: 0,
      },
      {
        recordId: 'd'.repeat(64),
        evidenceProfile: 'metadata_without_abstract',
        entrySource: 'stage_a_output_unusable',
        stageATerminalState: 'invalid_quarantined',
        coordinatorRiskFlagCount: 2,
      },
    ]
    const aggregates = summarizeStageBQueue(entries)
    expect(aggregates.total).toBe(2)
    expect(aggregates.byEntrySource.stage_a_advance_decision).toBe(1)
    expect(aggregates.byEntrySource.stage_a_output_unusable).toBe(1)
    expect(aggregates.byEvidenceProfile.metadata_with_abstract).toBe(1)
    for (const source of STAGE_B_ENTRY_SOURCES) {
      expect(aggregates.byEntrySource[source]).toBeGreaterThanOrEqual(0)
    }
  })
})
