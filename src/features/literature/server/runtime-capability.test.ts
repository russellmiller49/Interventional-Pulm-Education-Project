/** @jest-environment node */

/**
 * The capability model, and the one property the administration page depends on.
 *
 * The defect these exist for is a single character: `?? 0`. When the statistics RPC failed, the
 * page rendered a corpus of exactly zero articles — the same thing a freshly migrated, genuinely
 * empty project renders. During a bring-up those two states call for opposite responses (apply the
 * migration versus import the canary), so the page must never be able to confuse them.
 *
 * The invariant under test is therefore not "the states have nice names" but: **a state that does
 * not carry counts can never be rendered as a number.** Everything else here supports that.
 */

import {
  LITERATURE_CAPABILITY_STATES,
  capabilityCarriesCounts,
  capabilityForWithheldOperation,
  capabilityFromArticleCount,
  capabilityFromBinding,
  capabilityFromFailure,
  capabilityFromFilteredRead,
  capabilityNotObserved,
  classifyLiteratureQueryFailure,
  type LiteratureCapabilityState,
} from './runtime-capability'
import {
  describeLiteratureBinding,
  resolveLiteratureDedicatedBinding,
} from './dedicated-project-contract'

const APPROVED_REF = 'itcttmkxdxvwmwcmzmey'

describe('only measured states carry counts', () => {
  const COUNT_BEARING: LiteratureCapabilityState[] = [
    'foundation_ready_empty',
    'foundation_ready_populated',
    // A filtered read measures its own result set, so its number is real; what it withholds is any
    // claim about the size of the corpus.
    'foundation_ready_filtered',
  ]

  it.each([...LITERATURE_CAPABILITY_STATES])('%s carries counts only when measured', (state) => {
    expect(capabilityCarriesCounts(state)).toBe(COUNT_BEARING.includes(state))
  })

  it('does not let a filtered zero look like an empty corpus', () => {
    // Both carry counts, so both render digits — but only `foundation_ready_empty` is a statement
    // about the corpus. Conflating them would report "no articles" for a search that simply
    // matched nothing.
    expect(capabilityFromFilteredRead('itcttmkxdxvwmwcmzmey').state).toBe(
      'foundation_ready_filtered',
    )
    expect(capabilityFromArticleCount(0, 'itcttmkxdxvwmwcmzmey').state).toBe(
      'foundation_ready_empty',
    )
    expect(capabilityFromFilteredRead('itcttmkxdxvwmwcmzmey').message).toMatch(/active filters/iu)
  })

  it('never lets an unreadable database look like an empty one', () => {
    // The two states a bring-up must not confuse. Both can arise from the same page load; only one
    // of them means "zero".
    expect(capabilityCarriesCounts('foundation_ready_empty')).toBe(true)
    expect(capabilityCarriesCounts('foundation_missing')).toBe(false)
    expect(capabilityCarriesCounts('temporarily_unavailable')).toBe(false)
    expect(capabilityCarriesCounts('not_configured')).toBe(false)
  })
})

describe('failure classification is code-driven and total', () => {
  it.each([
    // PostgREST answers from its schema cache…
    ['PGRST205', 'missing_relation'],
    ['PGRST202', 'missing_function'],
    // …and a call that reaches the database raises the SQLSTATE instead.
    ['42P01', 'missing_relation'],
    ['42883', 'missing_function'],
    ['42501', 'permission_denied'],
    ['PGRST301', 'permission_denied'],
  ] as const)('classifies %s as %s', (code, kind) => {
    expect(classifyLiteratureQueryFailure({ code })).toBe(kind)
    // Case and surrounding whitespace are normalized; the code is the signal, not its formatting.
    expect(classifyLiteratureQueryFailure({ code: ` ${code.toLowerCase()} ` })).toBe(kind)
  })

  it.each([
    ['a network-shaped code', { code: 'ECONNRESET' }],
    ['no code at all', { message: 'boom' }],
    ['a null code', { code: null }],
    ['an absent failure', null],
    ['an undefined failure', undefined],
  ])('classifies %s as unclassified rather than guessing', (_label, failure) => {
    // Guessing "missing" here would tell an operator to apply a migration in response to a blip.
    expect(classifyLiteratureQueryFailure(failure)).toBe('unclassified_failure')
  })
})

describe('capability resolution', () => {
  it('reports a missing foundation object as foundation_missing', () => {
    const capability = capabilityFromFailure(
      { code: 'PGRST205' },
      { projectRef: APPROVED_REF, surface: 'foundation' },
    )
    expect(capability.state).toBe('foundation_missing')
    expect(capability.projectRef).toBe(APPROVED_REF)
    expect(capabilityCarriesCounts(capability.state)).toBe(false)
  })

  it('reports the same missing object on the gold surface as a deferred workflow', () => {
    // Identical error code, different meaning: the gold-set migrations are deliberately not
    // applied, so their absence is expected rather than a fault to escalate.
    const capability = capabilityFromFailure(
      { code: 'PGRST202' },
      { projectRef: APPROVED_REF, surface: 'gold_workflow' },
    )
    expect(capability.state).toBe('gold_workflow_unavailable')
    expect(capability.message).toMatch(/deliberately deferred/iu)
  })

  it('reports an unclassified failure as temporarily unavailable, never as empty', () => {
    const capability = capabilityFromFailure(
      { code: 'ECONNRESET' },
      { projectRef: APPROVED_REF, surface: 'foundation' },
    )
    expect(capability.state).toBe('temporarily_unavailable')
    expect(capability.message).toMatch(/not a report of zero/iu)
  })

  it('distinguishes a measured zero from a measured population', () => {
    expect(capabilityFromArticleCount(0, APPROVED_REF).state).toBe('foundation_ready_empty')
    expect(capabilityFromArticleCount(25, APPROVED_REF).state).toBe('foundation_ready_populated')
    // The empty message says out loud that the zero is real, because that is the sentence an
    // operator verifying a fresh migration needs to read.
    expect(capabilityFromArticleCount(0, APPROVED_REF).message).toMatch(
      /measurement, not a fallback/iu,
    )
  })

  it.each([
    ['nothing configured', {}],
    ['a partial configuration', { LITERATURE_SUPABASE_URL: 'https://x.supabase.co/' }],
    [
      'the main application project',
      {
        LITERATURE_SUPABASE_URL: 'https://tqnhxlwvkkswuckszlee.supabase.co/',
        LITERATURE_SUPABASE_SECRET_KEY: 'sb_secret_PLACEHOLDER',
        LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: 'tqnhxlwvkkswuckszlee',
      },
    ],
  ])('resolves %s to not_configured with its specific reason retained', (_label, environment) => {
    const capability = capabilityFromBinding(
      describeLiteratureBinding(resolveLiteratureDedicatedBinding(environment)),
    )
    expect(capability.state).toBe('not_configured')
    expect(capabilityCarriesCounts(capability.state)).toBe(false)
    // Collapsed for the reader, specific for the operator.
    expect(capability.reason).toBeTruthy()
    expect(capability.message).toBeTruthy()
  })

  it('separates a withheld write from an uninstalled workflow', () => {
    // Only one of these is fixed by applying a migration, so they must not share a state.
    expect(
      capabilityForWithheldOperation(APPROVED_REF, 'write_capability_withheld', 'x').state,
    ).toBe('write_capability_withheld')
    expect(
      capabilityForWithheldOperation(APPROVED_REF, 'gold_workflow_unavailable', 'x').state,
    ).toBe('gold_workflow_unavailable')
  })

  it('marks a request that never reached the database as unobserved', () => {
    const capability = capabilityNotObserved(APPROVED_REF, 'rejected filters')
    expect(capability.state).toBe('not_observed')
    expect(capabilityCarriesCounts(capability.state)).toBe(false)
  })
})

describe('capability values never carry a credential', () => {
  it('keeps the secret out of every constructor', () => {
    const secret = 'sb_secret_EXAMPLE_PLACEHOLDER_NOT_A_CREDENTIAL'
    const capabilities = [
      capabilityFromArticleCount(0, APPROVED_REF),
      capabilityFromFailure(
        { code: 'PGRST205' },
        { projectRef: APPROVED_REF, surface: 'foundation' },
      ),
      capabilityNotObserved(APPROVED_REF, 'rejected'),
      capabilityForWithheldOperation(APPROVED_REF, 'write_capability_withheld', 'withheld'),
      capabilityFromBinding(
        describeLiteratureBinding(
          resolveLiteratureDedicatedBinding({
            LITERATURE_SUPABASE_URL: 'https://itcttmkxdxvwmwcmzmey.supabase.co/',
            LITERATURE_SUPABASE_SECRET_KEY: secret,
            LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
          }),
        ),
      ),
    ]
    for (const capability of capabilities) {
      expect(JSON.stringify(capability)).not.toContain(secret)
    }
  })
})
