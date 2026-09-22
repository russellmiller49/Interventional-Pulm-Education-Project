import { act, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { BaxterCrrtPractice } from '../components/BaxterCrrtPractice'
import { BAXTER_CRRT_PROGRESS_STORAGE_KEY } from '../engine/progress'

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
}))

async function settle() {
  // The visit effect runs on a macrotask timer, so a microtask flush is not enough.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => window.localStorage.clear())

describe('CRRT self-paced storage stays a read-and-extend record', () => {
  it('leaves an unreadable legacy record byte-identical', async () => {
    const legacy = JSON.stringify({
      version: 2,
      selfPaced: { visitedCaseIds: ['CRRT-02'], note: 'from an older build' },
      attempts: { 'prismax-aw8035-2xx:integrated:practice:CRRT-02': { best: 71 } },
    })
    window.localStorage.setItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY, legacy)

    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-04" />)
    await settle()
    expect(screen.getByRole('combobox', { name: 'Cases' })).toHaveValue('CRRT-04')

    expect(window.localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)).toBe(legacy)
  })

  it('preserves every unrelated key of a current record and only extends the visit list', async () => {
    const stored = {
      version: 3,
      schemaVersion: 'crrt-progress-3',
      attempts: { 'prismax-aw8035-2xx:integrated:practice:CRRT-02': { attempts: 2 } },
      unknownFutureKey: { keepMe: true },
      selfPaced: {
        visitedLessonIds: ['crrt-circuit-pressures'],
        visitedCaseIds: ['CRRT-02'],
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastLocation: { section: 'practice', id: 'CRRT-02' },
      },
    }
    window.localStorage.setItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY, JSON.stringify(stored))

    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-04" />)
    await settle()

    const after = JSON.parse(window.localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)!)
    expect(after.version).toBe(3)
    expect(after.schemaVersion).toBe(stored.schemaVersion)
    expect(after.attempts).toEqual(stored.attempts)
    expect(after.unknownFutureKey).toEqual(stored.unknownFutureKey)
    expect(after.selfPaced.visitedLessonIds).toEqual(['crrt-circuit-pressures'])
    expect(after.selfPaced.visitedCaseIds).toEqual(['CRRT-02', 'CRRT-04'])
    expect(after.selfPaced.lastLocation).toEqual({ section: 'practice', id: 'CRRT-04' })
  })

  it('records no score, attempt count or safety profile for a run', async () => {
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-11" />)
    await settle()
    const raw = window.localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY) ?? ''
    expect(raw).not.toMatch(/streak|firstAttempt|safetyProfile/i)
    const parsed = JSON.parse(raw)
    // The pre-existing attempt containers stay present and stay empty: a run
    // records a visit, never a score, an attempt count or a safety profile.
    expect(parsed.attempts).toEqual({})
    expect(parsed.bestSafeScores).toEqual({})
    expect(parsed.criticalErrorAttempts).toEqual({})
    expect(parsed.hintUse).toEqual({})
    expect(Object.keys(parsed.selfPaced).sort()).toEqual([
      'lastLocation',
      'updatedAt',
      'visitedCaseIds',
      'visitedLessonIds',
    ])
  })
})
