/** @jest-environment node */
import { syntheticRefusalBody, syntheticResponseBody, syntheticStageAOutput } from './fixtures'
import { extractResponseOutput, ingestStageAResponses } from './results'

const ID_A = 'a'.repeat(64)
const ID_B = 'b'.repeat(64)
const ID_C = 'c'.repeat(64)

/**
 * Mixed-response semantics.
 *
 * The rule under test is a precedence rule: a refusal anywhere in the response wins over every
 * other reading of it, and nothing mixed or contradictory is ever allowed to route negative.
 * The failure this replaces looked benign — a response carrying both a refusal part and a
 * clean negative `output_text` was ingested as a valid prediction and became a
 * deprioritization candidate, i.e. an article was set aside on the strength of output the
 * model had declined to give.
 */
describe('response extraction', () => {
  const NEGATIVE_TEXT = syntheticStageAOutput(ID_A, 'obvious_irrelevant', 'high', [
    'not_pulmonary_or_airway_topic',
  ])

  function completed(output: unknown[]): string {
    return JSON.stringify({ id: 'resp', status: 'completed', output })
  }

  const messageWith = (...parts: unknown[]) => ({
    type: 'message',
    role: 'assistant',
    content: parts,
  })
  const textPart = (text: string) => ({ type: 'output_text', text })
  const refusalPart = { type: 'refusal', refusal: 'declined' }

  it('extracts the single output text of a completed response', () => {
    const extracted = extractResponseOutput(syntheticResponseBody('{"x":1}'))
    expect(extracted).toEqual({ kind: 'text', text: '{"x":1}' })
  })

  it('detects a refusal-only response', () => {
    expect(extractResponseOutput(syntheticRefusalBody()).kind).toBe('refusal')
  })

  it('treats a refusal followed by valid negative text as a refusal', () => {
    const extracted = extractResponseOutput(
      completed([messageWith(refusalPart, textPart(NEGATIVE_TEXT))]),
    )
    expect(extracted.kind).toBe('refusal')
  })

  it('treats valid negative text followed by a refusal as a refusal', () => {
    const extracted = extractResponseOutput(
      completed([messageWith(textPart(NEGATIVE_TEXT), refusalPart)]),
    )
    expect(extracted.kind).toBe('refusal')
  })

  it('treats a refusal in a separate output item as a refusal', () => {
    const extracted = extractResponseOutput(
      completed([messageWith(textPart(NEGATIVE_TEXT)), { type: 'refusal', refusal: 'declined' }]),
    )
    expect(extracted.kind).toBe('refusal')
  })

  it('treats a refusal plus an insufficient_evidence text as a refusal', () => {
    const abstention = syntheticStageAOutput(ID_A, 'insufficient_evidence', 'low', [])
    expect(
      extractResponseOutput(completed([messageWith(refusalPart, textPart(abstention))])).kind,
    ).toBe('refusal')
  })

  it('treats a refusal beside an error or partial response as a refusal, never a prediction', () => {
    const withError = JSON.stringify({
      status: 'completed',
      error: { message: 'x' },
      output: [messageWith(refusalPart, textPart(NEGATIVE_TEXT))],
    })
    expect(extractResponseOutput(withError).kind).toBe('refusal')
    const partial = JSON.stringify({
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output: [messageWith(refusalPart)],
    })
    expect(extractResponseOutput(partial).kind).toBe('refusal')
  })

  it('treats a malformed refusal part as unsupported rather than as text', () => {
    // A part that names an unknown type is not quietly skipped over to reach the text beside it.
    const malformed = completed([
      messageWith({ type: 'refusal_v2', refusal: 'declined' }, textPart(NEGATIVE_TEXT)),
    ])
    const extracted = extractResponseOutput(malformed)
    expect(extracted.kind).toBe('invalid')
  })

  it('fails closed on multiple output texts', () => {
    const multi = completed([messageWith(textPart('one'), textPart('two'))])
    expect(extractResponseOutput(multi)).toEqual({
      kind: 'invalid',
      reason: 'response_message_texts_2',
    })
    const acrossItems = completed([messageWith(textPart('one')), messageWith(textPart('two'))])
    expect(extractResponseOutput(acrossItems).kind).toBe('invalid')
  })

  it('fails closed on unsupported mixed item types', () => {
    const withTool = completed([
      { type: 'function_call', name: 'search', arguments: '{}' },
      messageWith(textPart(NEGATIVE_TEXT)),
    ])
    expect(extractResponseOutput(withTool).kind).toBe('invalid')
    // A reasoning item is understood and carries no routable content, so it is not a failure.
    const withReasoning = completed([
      { type: 'reasoning', summary: [] },
      messageWith(textPart(NEGATIVE_TEXT)),
    ])
    expect(extractResponseOutput(withReasoning)).toEqual({ kind: 'text', text: NEGATIVE_TEXT })
  })

  it('fails closed on partial responses and status/body contradictions', () => {
    expect(extractResponseOutput('not json').kind).toBe('invalid')
    expect(extractResponseOutput(JSON.stringify({ error: { message: 'x' } })).kind).toBe('invalid')
    expect(extractResponseOutput(JSON.stringify({ status: 'incomplete', output: [] })).kind).toBe(
      'invalid',
    )
    const contradiction = JSON.stringify({
      status: 'completed',
      incomplete_details: { reason: 'max_output_tokens' },
      output: [messageWith(textPart(NEGATIVE_TEXT))],
    })
    expect(extractResponseOutput(contradiction)).toEqual({
      kind: 'invalid',
      reason: 'response_status_body_contradiction',
    })
  })

  it('never routes a mixed or refusing response as a negative prediction', () => {
    const mixed = [
      completed([messageWith(refusalPart, textPart(NEGATIVE_TEXT))]),
      completed([messageWith(textPart(NEGATIVE_TEXT), refusalPart)]),
      completed([messageWith(textPart(NEGATIVE_TEXT), textPart(NEGATIVE_TEXT))]),
      completed([
        { type: 'function_call', name: 'x', arguments: '{}' },
        messageWith(textPart(NEGATIVE_TEXT)),
      ]),
    ]
    for (const bodyText of mixed) {
      const ingestion = ingestStageAResponses({
        selectedRecordIds: [ID_A],
        attemptedRecordIds: [ID_A],
        responses: [{ customId: ID_A, bodyText }],
      })
      // Refusal or quarantine — never a prediction, and therefore never deprioritizable.
      expect(['refusal', 'invalid_quarantined']).toContain(ingestion.assignments[0].state)
      expect(ingestion.assignments[0].output).toBeNull()
    }
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
