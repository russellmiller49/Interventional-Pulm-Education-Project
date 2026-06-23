import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LanguageSelector } from './LanguageSelector'

const mockReplace = jest.fn()
const mockRefresh = jest.fn()
let mockLocale = 'en'
let mockPathname = '/'

jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: () => (key: string) =>
    ({
      choose: 'Choose language',
      label: 'Language',
    })[key] ?? key,
}))

jest.mock('@/i18n/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    replace: mockReplace,
    refresh: mockRefresh,
  }),
}))

describe('LanguageSelector', () => {
  beforeEach(() => {
    mockReplace.mockReset()
    mockRefresh.mockReset()
    mockLocale = 'en'
    mockPathname = '/'
    window.history.replaceState(null, '', '/en')
  })

  it('switches locales through the i18n router and refreshes same-page content', async () => {
    const user = userEvent.setup()
    mockPathname = '/'
    window.history.replaceState(null, '', '/en?preview=1#catalog')

    render(<LanguageSelector />)

    await user.selectOptions(screen.getByLabelText('Choose language'), 'es')

    expect(mockReplace).toHaveBeenCalledWith('/?preview=1#catalog', {
      locale: 'es',
      scroll: false,
    })
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not refresh when the selected locale is already active', async () => {
    const user = userEvent.setup()

    render(<LanguageSelector />)

    await user.selectOptions(screen.getByLabelText('Choose language'), 'en')

    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockRefresh).not.toHaveBeenCalled()
  })
})
