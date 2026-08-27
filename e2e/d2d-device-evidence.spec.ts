import { expect, test, type Page } from '@playwright/test'

test.setTimeout(180_000)

const PRODUCTS = {
  exact: 'PRD-A0655BF464',
  family: 'PRD-AED3720BF6',
  unresolved: 'PRD-3E1556EBE5',
  erbe: 'PRD-05670F1B5F',
  nonpilot: 'PRD-2E043ED827',
} as const

async function openProduct(page: Page, productId: string): Promise<void> {
  await page.goto(`/en/devices/${productId}`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.locator('h1').waitFor({ timeout: 120_000 })
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    rootScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }))
  expect(geometry.rootScrollWidth).toBe(geometry.clientWidth)
  expect(geometry.bodyScrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
}

test('renders an exact reviewed profile with exact regulatory identity and safe citations', async ({
  page,
}) => {
  await openProduct(page, PRODUCTS.exact)
  await expect(page.getByRole('heading', { name: 'Reviewed product profile' })).toBeVisible()
  await expect(page.locator('[data-d2d-profile-scope="exact_product"]')).toBeVisible()
  await expect(page.getByText(/KARL STORZ 10350F is a reusable optical forceps/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Regulatory evidence' })).toBeVisible()
  await expect(
    page.locator('[data-d2d-regulatory-match="exact_model_manufacturer_match"]'),
  ).toBeVisible()

  const officialSource = page
    .locator('[data-d2d-profile-scope="exact_product"]')
    .getByRole('link', { name: /Open official source/ })
    .first()
  await expect(officialSource).toHaveAttribute('target', '_blank')
  await expect(officialSource).toHaveAttribute('rel', /noopener/)
  await expect(officialSource).toHaveAttribute('rel', /noreferrer/)
  await expect(page.locator('body')).not.toContainText(/D2D-Q-|request skip|record keys/i)
  await expect(page.locator('a[href*="api.fda.gov"]')).not.toHaveAttribute('href', /search=/i)
})

test('discloses Narwhal family-level pathway context without an exact authorization conclusion', async ({
  page,
}) => {
  await openProduct(page, PRODUCTS.family)
  await expect(page.locator('[data-d2d-profile-scope="configuration_variant"]')).toBeVisible()
  await expect(page.getByText(/Configuration-level evidence/)).toBeVisible()
  await expect(
    page.getByText(
      'Family-level regulatory evidence. Exact catalog-SKU linkage remains unresolved.',
    ),
  ).toBeVisible()
  await expect(page.getByText('K261068', { exact: true })).toBeVisible()
  await expect(page.locator('[data-regulatory-conclusion="cleared_510k"]')).toHaveCount(0)
})

test('renders unresolved exact regulatory identity without a negative authorization claim', async ({
  page,
}) => {
  await openProduct(page, PRODUCTS.unresolved)
  const panel = page.locator('[data-d2d-regulatory-match="ambiguous"]')
  await expect(panel).toBeVisible()
  await expect(
    panel.locator('[data-regulatory-conclusion="exact_identity_unresolved"]'),
  ).toHaveText('Exact regulatory identity unresolved')
  await expect(panel).not.toContainText(/unlisted|uncleared|unapproved|unauthorized|unsafe/i)
})

test('keeps the ERBE D2B safety action prominent beside independent D2D evidence', async ({
  page,
}) => {
  await openProduct(page, PRODUCTS.erbe)
  await expect(page.getByRole('heading', { name: 'Regulatory evidence' })).toBeVisible()
  await expect(page.locator('[data-status-gate="blocked_active_safety_action"]')).toBeVisible()
  await expect(page.getByText('Z-1568-2026')).toBeVisible()
  await expect(page.getByText('Active FDA safety action', { exact: true })).toBeVisible()
})

test('renders the compact honest enrichment fallback for a verified-source nonpilot product', async ({
  page,
}) => {
  await openProduct(page, PRODUCTS.nonpilot)
  const fallback = page.locator('[data-d2d-enrichment-fallback="true"]')
  await expect(fallback).toBeVisible()
  await expect(fallback).toContainText('Reviewed extended product profile not yet available.')
  await expect(fallback).toContainText('Exact regulatory profile not yet researched.')
  await expect(page.locator('[data-d2d-profile-scope]')).toHaveCount(0)
  await expect(page.locator('[data-d2d-regulatory-match]')).toHaveCount(0)
})

for (const [state, productId] of Object.entries(PRODUCTS)) {
  test(`${state} D2D detail state has no page-level overflow at 390 px`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openProduct(page, productId)
    await expectNoPageOverflow(page)
  })
}
