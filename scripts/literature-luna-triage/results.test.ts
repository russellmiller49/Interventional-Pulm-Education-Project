/** @jest-environment node */
import { syntheticRefusalBody, syntheticResponseBody, syntheticStageAOutput } from './fixtures'
import { extractResponseOutput, ingestStageAResponses } from './results'

const ID_A = 'a'.repeat(64)
const ID_B = 'b'.repeat(64)
const ID_C = 'c'.repeat(64)

describe('response extraction', () => {
  it('extracts the single output text of a completed response', () => {
    const extracted = extractResponseOutput(syntheticResponseBody('{"x":1}'))
    expect(extracted).toEqual({ kind: 'text', text: '{"x":1}' })
  })

  it('detects refusals', () => {
    expect(extractResponseOutput(syntheticRefusalBody())).toEqual({ kind: 'refusal' })
  })

  it('treats errors, incompleteness, junk, and multi-text messages as invalid', () => {
    expect(extractResponseOutput('not json').kind).toBe('invalid')
    expect(extractResponseOutput(JSON.stringify({ error: { message: 'x' } })).kind).toBe('invalid')
    expect(extractResponseOutput(JSON.stringify({ status: 'incomplete', output: [] })).kind).toBe(
      'invalid',
    )
    const multi = JSON.stringify({
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [
            { type: 'output_text', text: 'one' },
            { type: 'output_text', text: 'two' },
          ],
        },
      ],
    })
    expect(extractResponseOutput(multi).kind).toBe('invalid')
  })
})

describe('strict ingestion accounting', () => {
  it('assigns exactly one terminal state to every selected record', () => {
    const ingestion = ingestStageAResponses({
      selectedRecordIds: [ID_A, ID_B, ID_C],
      attemptedRecordIds: [ID_A, ID_B],
      responses: [
        {
          customId: ID_A,
          bodyText: syntheticResponseBody(
            syntheticStageAOutput(ID_A, 'obvious_irrelevant', 'high', [
              'clearly_nonpulmonary_domain',
            ]),
          ),
        },
      ],
    })
    const states = new Map(ingestion.assignments.map((row) => [row.recordId, row.state]))
    expect(states.get(ID_A)).toBe('valid_prediction')
    expect(states.get(ID_B)).toBe('missing')
    expect(states.get(ID_C)).toBe('no_attempt')
    expect(ingestion.assignments).toHaveLength(3)
  })

  it('classifies insufficient_evidence as a valid abstention, not a prediction', () => {
    const ingestion = ingestStageAResponses({
      selectedRecordIds: [ID_A],
      attemptedRecordIds: [ID_A],
      responses: [
        {
          customId: ID_A,
          bodyText: syntheticResponseBody(
            syntheticStageAOutput(ID_A, 'insufficient_evidence', 'low', ['metadata_insufficient']),
          ),
        },
      ],
    })
    expect(ingestion.assignments[0].state).toBe('valid_abstention')
  })

  it('quarantines schema-invalid outputs without repair', () => {
    const ingestion = ingestStageAResponses({
      selectedRecordIds: [ID_A],
      attemptedRecordIds: [ID_A],
      responses: [
        {
          customId: ID_A,
          bodyText: syntheticResponseBody(
            syntheticStageAOutput(ID_A, 'obvious_irrelevant', 'high', [
              'possible_airway_relevance',
            ]),
          ),
        },
      ],
    })
    expect(ingestion.assignments[0].state).toBe('invalid_quarantined')
    expect(ingestion.quarantine).toHaveLength(1)
    expect(ingestion.quarantine[0].rawBase64.length).toBeGreaterThan(0)
  })

  it('quarantines identity mismatches between output and request', () => {
    const ingestion = ingestStageAResponses({
      selectedRecordIds: [ID_A],
      attemptedRecordIds: [ID_A],
      responses: [
        {
          customId: ID_A,
          bodyText: syntheticResponseBody(
            syntheticStageAOutput(ID_B, 'obvious_irrelevant', 'high', [
              'clearly_nonpulmonary_domain',
            ]),
          ),
        },
      ],
    })
    expect(ingestion.assignments[0].state).toBe('invalid_quarantined')
    expect(ingestion.assignments[0].detail).toBe('record_identity_mismatch')
  })

  it('marks refusals distinctly', () => {
    const ingestion = ingestStageAResponses({
      selectedRecordIds: [ID_A],
      attemptedRecordIds: [ID_A],
      responses: [{ customId: ID_A, bodyText: syntheticRefusalBody() }],
    })
    expect(ingestion.assignments[0].state).toBe('refusal')
  })

  it('treats duplicates as their own terminal state and quarantines every copy', () => {
    const body = syntheticResponseBody(
      syntheticStageAOutput(ID_A, 'obvious_irrelevant', 'high', ['clearly_nonpulmonary_domain']),
    )
    const ingestion = ingestStageAResponses({
      selectedRecordIds: [ID_A],
      attemptedRecordIds: [ID_A],
      responses: [
        { customId: ID_A, bodyText: body },
        { customId: ID_A, bodyText: body },
      ],
    })
    expect(ingestion.assignments[0].state).toBe('duplicate')
    expect(ingestion.quarantine).toHaveLength(2)
  })

  it('quarantines unknown identities without adopting them', () => {
    const ingestion = ingestStageAResponses({
      selectedRecordIds: [ID_A],
      attemptedRecordIds: [ID_A],
      responses: [
        { customId: ID_B, bodyText: syntheticResponseBody('{}') },
        { customId: null, bodyText: 'garbage' },
      ],
    })
    expect(ingestion.unknownIdentityCount).toBe(2)
    expect(ingestion.assignments[0].state).toBe('missing')
  })

  it('refuses duplicate selections and attempts outside the cohort', () => {
    expect(() =>
      ingestStageAResponses({
        selectedRecordIds: [ID_A, ID_A],
        attemptedRecordIds: [],
        responses: [],
      }),
    ).toThrow(/duplicate record ids/u)
    expect(() =>
      ingestStageAResponses({
        selectedRecordIds: [ID_A],
        attemptedRecordIds: [ID_B],
        responses: [],
      }),
    ).toThrow(/outside the selected cohort/u)
  })
})
