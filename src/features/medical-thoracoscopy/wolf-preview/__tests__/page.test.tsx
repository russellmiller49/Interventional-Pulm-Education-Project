import { render, screen } from '@testing-library/react'

const jar = new Map<string, string>()
jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
  }),
}))
jest.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))
jest.mock('@/features/medical-thoracoscopy/wolf-preview/WolfPreviewExplorer', () => ({
  WolfPreviewExplorer: () => <div data-testid="explorer" />,
}))

import DemoPage, {
  generateMetadata as demoMetadata,
} from '@/app/[locale]/medical-thoracoscopy/wolf-preview/[demo]/page'
import ExplorerPage, {
  metadata as explorerMetadata,
} from '@/app/[locale]/medical-thoracoscopy/wolf-preview/device-explorer/page'
import Page, { metadata } from '@/app/[locale]/medical-thoracoscopy/wolf-preview/page'
import { WOLF_PREVIEW_DEMOS } from '../demos'
import {
  codeVerifier,
  issueSession,
  newReviewCode,
  previewConfig,
  sessionCookie,
} from '../server/access'

/**
 * The hub and each page it opens render their content only for a valid session; otherwise the
 * code screen, which then returns to the same page.
 */
const variables = process.env as Record<string, string | undefined>
const saved = { ...variables }
const CODE = newReviewCode()
const props = (review?: string) => ({
  params: Promise.resolve({ locale: 'en' }),
  searchParams: Promise.resolve(review ? { review } : {}),
})
const demoProps = (demo: string, review?: string) => ({
  params: Promise.resolve({ locale: 'en', demo }),
  searchParams: Promise.resolve(review ? { review } : {}),
})
const signIn = () => {
  const config = previewConfig()!
  jar.set(sessionCookie().name, issueSession(config, config.reviewers[0]).value)
}

beforeEach(() => {
  jar.clear()
  variables.MT_WOLF_PREVIEW_ENABLED = 'true'
  variables.MT_WOLF_PREVIEW_SESSION_SECRET = 'q'.repeat(40)
  variables.MT_WOLF_PREVIEW_REVIEWERS = `wolf-reviewer-1:${codeVerifier(CODE)}`
  variables.NEXT_PUBLIC_SUPABASE_URL = 'https://storage.test'
  variables.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
})

afterAll(() => {
  for (const key of Object.keys(variables)) if (!(key in saved)) delete variables[key]
  Object.assign(variables, saved)
})

describe('wolf preview page', () => {
  it('is not found while the preview is off or unconfigured', async () => {
    for (const change of [
      { MT_WOLF_PREVIEW_ENABLED: 'false' },
      { MT_WOLF_PREVIEW_SESSION_SECRET: '' },
      { MT_WOLF_PREVIEW_REVIEWERS: '' },
    ]) {
      Object.assign(variables, change)
      await expect(Page(props())).rejects.toThrow('NEXT_NOT_FOUND')
      await expect(ExplorerPage(props())).rejects.toThrow('NEXT_NOT_FOUND')
      await expect(DemoPage(demoProps('pleural-model-progress'))).rejects.toThrow('NEXT_NOT_FOUND')
      beforeEachReset()
    }
  })

  it('shows only the code screen without a session', async () => {
    render(await Page(props()))
    expect(
      screen.getByRole('heading', { name: 'Development Preview — Manufacturer Review' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Review code')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Open preview' })).toBeInTheDocument()
    expect(screen.queryByTestId('explorer')).toBeNull()
    expect(document.body.innerHTML).not.toContain(CODE)
    expect(document.body.innerHTML).not.toContain('wolf-reviewer-1')
    expect(document.body.innerHTML).not.toContain(codeVerifier(CODE).slice(7))
  })

  it('says only that a code was not recognised', async () => {
    render(await Page(props('denied')))
    expect(screen.getByRole('alert')).toHaveTextContent('Review code not recognized.')
  })

  it('shows the hub for a valid session: one link to each page it opens', async () => {
    signIn()
    render(await Page(props()))
    expect(screen.queryByLabelText('Review code')).toBeNull()
    const links = screen
      .getAllByRole('link')
      .map((link) => [link.textContent, link.getAttribute('href')])
    expect(links).toEqual([
      ['Device Explorer', '/en/medical-thoracoscopy/wolf-preview/device-explorer'],
      ['Pleural Model Progress', '/en/medical-thoracoscopy/wolf-preview/pleural-model-progress'],
      [
        'Portable Hybrid Thoracoscopy Trainer',
        '/en/medical-thoracoscopy/wolf-preview/portable-trainer-concept',
      ],
    ])
    for (const image of screen.getAllByRole('img')) {
      expect(image.getAttribute('src')).toMatch(
        /^\/api\/medical-thoracoscopy\/wolf-preview\/files\/hub\/cards\/[a-z-]+\.jpg$/,
      )
    }
    expect(screen.getByRole('button', { name: 'End preview' })).toBeInTheDocument()
  })

  it('shows the explorer for a valid session and the code screen for a tampered one', async () => {
    const config = previewConfig()!
    const { value } = issueSession(config, config.reviewers[0])
    jar.set(sessionCookie().name, value)
    const { unmount } = render(await ExplorerPage(props()))
    expect(screen.getByTestId('explorer')).toBeInTheDocument()
    unmount()
    jar.set(sessionCookie().name, `${value.slice(0, -3)}AAA`)
    render(await ExplorerPage(props()))
    expect(screen.queryByTestId('explorer')).toBeNull()
    expect(screen.getByLabelText('Review code')).toBeInTheDocument()
  })

  it('brings a reviewer back to the page the code screen was shown on', async () => {
    const { container, unmount } = render(await ExplorerPage(props()))
    expect(container.querySelector('input[name="item"]')).toHaveValue('device-explorer')
    unmount()
    const demo = render(await DemoPage(demoProps('portable-trainer-concept', 'denied')))
    expect(demo.container.querySelector('input[name="item"]')).toHaveValue(
      'portable-trainer-concept',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Review code not recognized.')
    demo.unmount()
    const hub = render(await Page(props()))
    expect(hub.container.querySelector('input[name="item"]')).toBeNull()
  })

  it('shows a demonstration only to a signed-in reviewer, its files from the file endpoint', async () => {
    const without = render(await DemoPage(demoProps('pleural-model-progress')))
    expect(screen.queryByRole('link', { name: 'Open the interactive viewer' })).toBeNull()
    expect(document.querySelector('video')).toBeNull()
    without.unmount()

    signIn()
    for (const demo of Object.values(WOLF_PREVIEW_DEMOS)) {
      const { container, unmount } = render(await DemoPage(demoProps(demo.id)))
      const base = `/api/medical-thoracoscopy/wolf-preview/files/${demo.id}/`
      expect(screen.getByRole('heading', { level: 1, name: demo.title })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Open the interactive viewer' })).toHaveAttribute(
        'href',
        `${base}index.html`,
      )
      expect(screen.getByRole('link', { name: /All previews/ })).toHaveAttribute(
        'href',
        '/en/medical-thoracoscopy/wolf-preview',
      )
      expect(container.querySelector('video source')).toHaveAttribute(
        'src',
        `${base}${demo.video.file}`,
      )
      const stills = screen.getAllByRole('link', { name: /at full resolution/ })
      expect(stills).toHaveLength(demo.stills.length)
      for (const link of stills) {
        expect(link.getAttribute('href')!.startsWith(`${base}stills/`)).toBe(true)
        expect(link).toHaveAttribute('target', '_blank')
      }
      for (const element of container.querySelectorAll('[src], [href], [poster]')) {
        const address =
          element.getAttribute('src') ??
          element.getAttribute('poster') ??
          element.getAttribute('href')!
        expect(address).toMatch(/^\/(api\/medical-thoracoscopy\/wolf-preview\/|en\/)/)
      }
      unmount()
    }
  })

  it('opens the concept page with its own statement that nothing has been built', async () => {
    signIn()
    render(await DemoPage(demoProps('portable-trainer-concept')))
    const status = screen.getByRole('region', { name: 'Status of this concept' })
    expect(status).toHaveTextContent(
      'No physical thoracoscopy trainer has been built, measured or validated.',
    )
    expect(document.body.textContent).toContain('Not claimed')
  })

  it('is not found for any other demonstration name, with or without a session', async () => {
    for (const name of ['device-explorer', 'hub', 'unknown', '07-scope-tracker', '__proto__']) {
      await expect(DemoPage(demoProps(name))).rejects.toThrow('NEXT_NOT_FOUND')
    }
    signIn()
    await expect(DemoPage(demoProps('constructor'))).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('says the preview is unavailable, without opening it, when storage is not configured', async () => {
    const config = previewConfig()!
    jar.set(sessionCookie().name, issueSession(config, config.reviewers[0]).value)
    delete variables.SUPABASE_SERVICE_ROLE_KEY
    render(await Page(props()))
    expect(screen.getByRole('alert')).toHaveTextContent('temporarily unavailable')
    expect(screen.queryByTestId('explorer')).toBeNull()
  })

  it('is never indexed, archived or cached', async () => {
    const robots = { index: false, follow: false, noarchive: true, nocache: true }
    expect(metadata.robots).toEqual(robots)
    expect(explorerMetadata.robots).toEqual(robots)
    const demo = await demoMetadata({ params: Promise.resolve({ demo: 'pleural-model-progress' }) })
    expect(demo.robots).toEqual(robots)
  })
})

function beforeEachReset() {
  variables.MT_WOLF_PREVIEW_ENABLED = 'true'
  variables.MT_WOLF_PREVIEW_SESSION_SECRET = 'q'.repeat(40)
  variables.MT_WOLF_PREVIEW_REVIEWERS = `wolf-reviewer-1:${codeVerifier(CODE)}`
}
