import { expect, test, type Page } from '@playwright/test'

test.setTimeout(180_000)

type StorageMode = 'session-getter' | 'session-methods' | 'all-refused' | 'allowed'

async function configureStorage(page: Page, mode: StorageMode) {
  await page.addInitScript((storageMode) => {
    const refuse = () => {
      throw new DOMException('Site storage is refused.', 'SecurityError')
    }
    if (storageMode === 'session-getter' || storageMode === 'all-refused') {
      Object.defineProperty(window, 'sessionStorage', { configurable: true, get: refuse })
    } else if (storageMode === 'session-methods') {
      const storage = window.sessionStorage
      for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
        Object.defineProperty(storage, method, { configurable: true, value: refuse })
      }
    }
    if (storageMode === 'all-refused') {
      Object.defineProperty(window, 'localStorage', { configurable: true, get: refuse })
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        get: () => ({ open: refuse, deleteDatabase: refuse, databases: refuse }),
      })
      Object.defineProperty(Document.prototype, 'cookie', {
        configurable: true,
        get: () => '',
        set: () => {},
      })
    } else {
      window.localStorage.setItem('theme', 'dark')
    }
    // Observe that hydration has scheduled the actual 400ms account-sync task.
    const originalSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay === 400) document.documentElement.dataset.accountSyncScheduled = 'true'
      return originalSetTimeout(handler, delay, ...args)
    }) as typeof window.setTimeout
  }, mode)
}

async function settleAccountSync(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-account-sync-scheduled', 'true')
  // Stay beyond the debounce and async continuation; an immediate render check misses the bug.
  await page.waitForTimeout(2000)
}

for (const mode of ['session-getter', 'session-methods', 'allowed', 'all-refused'] as const) {
  test(`${mode}: delayed hydration, navigation, warm reload and new tab`, async ({
    page,
    context,
  }) => {
    test.skip(
      mode === 'all-refused' && process.env.ACCOUNT_STORAGE_THEME_INTEGRATION !== '1',
      'Full storage refusal requires the separately reviewed #308 theme guard.',
    )
    const errors: string[] = []
    const progressRequests: string[] = []
    const observe = (target: Page) => {
      target.on('pageerror', (error) =>
        errors.push(`${error.name}: ${error.message}\n${error.stack}`),
      )
      target.on('request', (request) => {
        if (request.url().includes('/api/critical-care/progress'))
          progressRequests.push(request.url())
      })
    }
    observe(page)
    await configureStorage(page, mode)
    await page.goto('/en/login')
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
    if (mode !== 'allowed') {
      expect(
        await page.evaluate(() => {
          try {
            window.sessionStorage.getItem('refusal-probe')
            return 'allowed'
          } catch (error) {
            return error instanceof DOMException ? error.name : 'unexpected error'
          }
        }),
      ).toBe('SecurityError')
    }
    await settleAccountSync(page)
    expect(errors).toEqual([])

    await page.goto('/en/critical-care/concepts')
    await settleAccountSync(page)
    const link = page.locator('a[href*="/critical-care/concepts/"]').first()
    await expect(link).toBeVisible()
    await link.click()
    await expect(page.locator('h1').first()).toBeVisible()
    await page.waitForTimeout(2000)
    await page.reload()
    await settleAccountSync(page)
    expect(errors).toEqual([])
    if (mode !== 'all-refused') await expect(page.locator('html')).toHaveClass(/dark/)

    const coldTab = await context.newPage()
    observe(coldTab)
    await configureStorage(coldTab, mode)
    await coldTab.goto('/en/critical-care/concepts')
    await settleAccountSync(coldTab)
    await expect(coldTab.locator('h1').first()).toBeVisible()
    expect(errors).toEqual([])
    // These are anonymous public visits, including when cookies cannot be kept.
    expect(progressRequests).toEqual([])
  })
}
