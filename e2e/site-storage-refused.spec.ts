import { expect, test, type Page } from '@playwright/test'

/**
 * Every page of the site when the browser refuses its storage, as a browser that blocks site data
 * does: the `localStorage` and `sessionStorage` getters throw, IndexedDB refuses to open, and
 * cookies are neither read nor kept. The page must render, the learner must be able to read and
 * move between pages, nothing may claim to have saved, and the theme falls back to the default.
 * (Independent review of the medical thoracoscopy stack, R6: the theme provider blanked every page.)
 */
test.setTimeout(240_000)

async function refuseStorage(page: Page) {
  await page.addInitScript(() => {
    const refuse = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    for (const name of ['localStorage', 'sessionStorage'] as const) {
      Object.defineProperty(window, name, { configurable: true, get: refuse })
    }
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get: () => ({ open: refuse, deleteDatabase: refuse, databases: refuse }),
    })
    Object.defineProperty(Document.prototype, 'cookie', {
      configurable: true,
      get: () => '',
      set: () => {},
    })
  })
}

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`${error.message}\n${error.stack ?? ''}`))
  return errors
}

test('storage refused: the sign-in page renders, readable, with the default theme', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await refuseStorage(page)
  await page.goto('/en/login')
  expect(
    await page.evaluate(() => {
      try {
        return typeof window.localStorage
      } catch {
        return 'refused'
      }
    }),
  ).toBe('refused')
  await expect(page.locator('main, [role="main"]').first()).toBeVisible()
  expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(40)
  await expect(page.locator('input[type="email"]').first()).toBeVisible()
  // the theme is applied from the default, not read from storage
  const themed = await page.evaluate(
    () =>
      document.documentElement.classList.contains('light') ||
      document.documentElement.classList.contains('dark'),
  )
  expect(themed).toBe(true)
  expect(errors.filter((e) => /SecurityError|insecure|storage/i.test(e))).toEqual([])
})

test('storage refused: a public module opens and the learner can move between its pages', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await refuseStorage(page)
  await page.goto('/en/critical-care/concepts')
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 120_000 })
  const link = page.locator('a[href*="/critical-care/concepts/"]').first()
  await expect(link).toBeVisible()
  const href = await link.getAttribute('href')
  await link.click()
  await page.waitForURL((url) => url.pathname === href || url.pathname.endsWith(href ?? ''), {
    timeout: 120_000,
  })
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 120_000 })
  expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(80)
  expect(errors.filter((e) => /SecurityError|insecure|storage/i.test(e))).toEqual([])
})

test('storage allowed: the same pages, and the stored theme is read as before', async ({
  page,
}) => {
  await page.addInitScript(() => window.localStorage.setItem('theme', 'dark'))
  await page.goto('/en/login')
  await expect(page.locator('html')).toHaveClass(/dark/)
})
