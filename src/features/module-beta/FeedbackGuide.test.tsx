import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeedbackGuide, feedbackGuideSeenKey } from './FeedbackGuide'

beforeEach(() => window.localStorage.clear())

const guide = () => screen.queryByRole('dialog', { name: 'How to give feedback' })

it('opens by itself on a reviewer’s first visit to the hub, and not after they close it', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<FeedbackGuide placement="hub" />)
  const dialog = guide()!
  expect(dialog).toBeInTheDocument()
  const steps = within(dialog).getAllByRole('listitem')
  expect(steps.map((step) => within(step).getByRole('heading').textContent)).toEqual([
    '1Open a module',
    '2Report problems as you go',
    '3Show us where',
    '4Finish with an overall review',
  ])
  await user.click(within(dialog).getByRole('button', { name: 'Start testing' }))
  expect(guide()).not.toBeInTheDocument()
  expect(window.localStorage.getItem(feedbackGuideSeenKey)).toBe('1')
  unmount()

  render(<FeedbackGuide placement="hub" />)
  expect(guide()).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'How to give feedback' }))
  expect(guide()).toBeInTheDocument()
})

it('counts closing with Escape or the close button as seen', async () => {
  const user = userEvent.setup()
  render(<FeedbackGuide placement="hub" />)
  await user.keyboard('{Escape}')
  expect(guide()).not.toBeInTheDocument()
  expect(window.localStorage.getItem(feedbackGuideSeenKey)).toBe('1')
})

it('never opens by itself in a module’s top bar, only from its button', async () => {
  const user = userEvent.setup()
  render(<FeedbackGuide placement="toolbar" />)
  expect(guide()).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'How to give feedback' }))
  const dialog = guide()!
  await user.click(within(dialog).getByRole('button', { name: 'Back to the module' }))
  expect(guide()).not.toBeInTheDocument()
})

it('still opens, once per page, when the browser refuses storage', async () => {
  const user = userEvent.setup()
  const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  try {
    render(<FeedbackGuide placement="hub" />)
    await user.click(within(guide()!).getByRole('button', { name: 'Start testing' }))
    expect(guide()).not.toBeInTheDocument()
  } finally {
    get.mockRestore()
    set.mockRestore()
  }
})
