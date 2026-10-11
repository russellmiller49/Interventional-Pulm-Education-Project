import { cleanup, render } from '@testing-library/react'

import { ConfiguredPolicies } from '../components/LocalNotes'

/**
 * The institution's own policy on a card (rewrite rule 3): shown when the slot is configured, in
 * the institution's words, and absent otherwise. The slots ship unconfigured, so the configured
 * case is exercised here with one slot filled in.
 */
jest.mock('../content/localPolicies', () => ({
  ...jest.requireActual<typeof import('../content/localPolicies')>('../content/localPolicies'),
  configuredLocalPolicies: (ids: readonly string[]) =>
    ids.includes('bleeding_rescue')
      ? [{ id: 'bleeding_rescue', title: 'Bleeding response', value: 'Cold saline first.' }]
      : [],
}))

afterEach(cleanup)

describe('the institution’s policy on a card', () => {
  it('shows a configured slot in the institution’s words', () => {
    render(<ConfiguredPolicies ids={['bleeding_rescue', 'sedation_policy']} />)
    const shown = [...document.querySelectorAll('[data-local-policy]')]
    expect(shown.map((node) => node.getAttribute('data-local-policy'))).toEqual(['bleeding_rescue'])
    expect(shown[0].textContent).toBe('Your institution, bleeding response: Cold saline first.')
  })

  it('renders nothing when no slot the card names is configured', () => {
    const { container } = render(<ConfiguredPolicies ids={['sedation_policy']} />)
    expect(container).toBeEmptyDOMElement()
    cleanup()
    expect(render(<ConfiguredPolicies ids={undefined} />).container).toBeEmptyDOMElement()
  })
})
