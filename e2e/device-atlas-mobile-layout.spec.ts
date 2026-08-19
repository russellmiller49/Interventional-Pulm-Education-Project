import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test, type Page } from '@playwright/test'

/**
 * Regression for review finding PR107-D2B-UI-001.
 *
 * The D2B atlas puts a market badge — and, when a safety action was matched, a safety badge —
 * in the last column of a `min-w-[900px]` table that is deliberately scrolled horizontally
 * inside its own labelled region. Each badge carries a screen-reader-only prefix so it reads
 * as "Market status: …" rather than as a bare label.
 *
 * `sr-only` is `position: absolute`. While the badge established no local positioning context
 * those hidden 1px boxes resolved their containing block to the initial containing block, so
 * the table's `overflow-x-auto` could not clip them: measured at 390x844 they sat at x≈836 and
 * dragged `documentElement.scrollWidth` from 390 to 837, sideways-scrolling the whole page.
 *
 * jsdom performs no layout and cannot see any of that, so the invariants below are asserted in
 * a browser. They are deliberately split in two, because the cheap ways to stop page overflow
 * (clipping the shell, dropping the table's min width, deleting the prefixes) would all satisfy
 * a root-width assertion on its own:
 *
 *   - the DOCUMENT never scrolls sideways at any of the four sizes;
 *   - the results REGION still does, and is still keyboard reachable and labelled;
 *   - both badge variants still announce their prefix and their status label.
 */
test.setTimeout(180_000)

const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1600x900', width: 1600, height: 900 },
] as const

/** The reviewed viewport: the only width where the table is narrower than its 900px content. */
const MOBILE = VIEWPORTS[0]

/**
 * A query whose first page carries both badge variants at once — the three ERBE cryoprobes
 * under an active FDA safety action, one identity-review row, and market-only rows — so a
 * single measurement covers the market-only and market+safety layouts together.
 */
const BOTH_VARIANTS_QUERY = '?q=cryoprobe'

const LOCALES = ['en', 'es', 'zh-CN'] as const

interface AtlasStrings {
  region: string
  marketPrefix: string
  safetyPrefix: string
  marketBadge: Record<string, string>
  safety: Record<string, string>
}

/**
 * Read each locale's own catalog rather than hard-coding English. The D2B status namespace is
 * currently seeded with identical English copy in all three files; reading it here keeps these
 * assertions honest on the day translations land instead of pinning today's placeholder.
 */
function atlasStrings(locale: string): AtlasStrings {
  const messages = JSON.parse(
    readFileSync(join(__dirname, '..', 'messages', `${locale}.json`), 'utf8'),
  ) as {
    deviceIntelligence: {
      devices: { resultsRegionLabel: string }
      status: {
        marketBadgeA11yPrefix: string
        safetyBadgeA11yPrefix: string
        marketBadge: Record<string, string>
        safety: Record<string, string>
      }
    }
  }
  const { devices, status } = messages.deviceIntelligence
  return {
    region: devices.resultsRegionLabel,
    marketPrefix: status.marketBadgeA11yPrefix,
    safetyPrefix: status.safetyBadgeA11yPrefix,
    marketBadge: status.marketBadge,
    safety: status.safety,
  }
}

async function openAtlas(page: Page, locale: string, query = ''): Promise<void> {
  await page.goto(`/${locale}/devices${query}`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.locator('tbody tr').first().waitFor({ timeout: 120_000 })
}

/** Root, body, and results-region scroll geometry in one pass. */
async function geometry(page: Page, regionLabel: string) {
  return page.evaluate((label) => {
    const root = document.documentElement
    const region = document.querySelector(`[role="region"][aria-label="${label}"]`)
    return {
      rootClientWidth: root.clientWidth,
      rootScrollWidth: root.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      regionFound: region !== null,
      regionClientWidth: region?.clientWidth ?? -1,
      regionScrollWidth: region?.scrollWidth ?? -1,
      regionTabIndex: region instanceof HTMLElement ? region.tabIndex : -1,
    }
  }, regionLabel)
}

/** Badge text as announced (visible label plus the hidden prefix) and as seen (visible only). */
async function badgeText(page: Page, attribute: 'data-market-status' | 'data-safety-display') {
  return page.evaluate((attr) => {
    const badges = Array.from(document.querySelectorAll(`[${attr}]`))
    return badges.map((badge) => {
      const hidden = Array.from(badge.querySelectorAll('.sr-only'))
      const visible = badge.cloneNode(true) as HTMLElement
      visible.querySelectorAll('.sr-only').forEach((node) => node.remove())
      return {
        value: badge.getAttribute(attr) ?? '',
        announced: (badge.textContent ?? '').replace(/\s+/g, ' ').trim(),
        visible: (visible.textContent ?? '').replace(/\s+/g, ' ').trim(),
        hiddenCount: hidden.length,
      }
    })
  }, attribute)
}

for (const viewport of VIEWPORTS) {
  test(`the device atlas never scrolls the page sideways at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const strings = atlasStrings('en')
    await openAtlas(page, 'en')

    const index = await geometry(page, strings.region)
    // The document itself: no horizontal overflow, at any width.
    expect(index.rootScrollWidth).toBe(index.rootClientWidth)
    expect(index.rootClientWidth).toBe(viewport.width)
    expect(index.bodyScrollWidth).toBeLessThanOrEqual(index.rootClientWidth)

    // And again on the page that also carries safety badges.
    await openAtlas(page, 'en', BOTH_VARIANTS_QUERY)
    const both = await geometry(page, strings.region)
    expect(both.rootScrollWidth).toBe(both.rootClientWidth)
    expect(both.bodyScrollWidth).toBeLessThanOrEqual(both.rootClientWidth)
  })
}

test(`the results region keeps its own horizontal scroll at ${MOBILE.name}`, async ({ page }) => {
  await page.setViewportSize({ width: MOBILE.width, height: MOBILE.height })
  const strings = atlasStrings('en')
  await openAtlas(page, 'en')

  const measured = await geometry(page, strings.region)
  expect(measured.regionFound).toBe(true)
  // The wide table is still wide: the page was contained by containing the badges, not by
  // clipping the shell, shrinking the table, or removing the intended internal scroll.
  expect(measured.regionScrollWidth).toBeGreaterThan(measured.regionClientWidth)
  expect(measured.regionClientWidth).toBeLessThanOrEqual(MOBILE.width)

  // Still reachable and operable without a mouse (WCAG 2.1.1, owner-review F-32).
  const region = page.getByRole('region', { name: strings.region })
  await expect(region).toBeVisible()
  expect(measured.regionTabIndex).toBe(0)
  await region.focus()
  expect(
    await page.evaluate(
      (label) => document.activeElement?.getAttribute('aria-label') === label,
      strings.region,
    ),
  ).toBe(true)
  await page.keyboard.press('ArrowRight')
  await expect
    .poll(async () => region.evaluate((node) => node.scrollLeft), { timeout: 5_000 })
    .toBeGreaterThan(0)
})

test(`both badge variants keep their screen-reader prefix at ${MOBILE.name}`, async ({ page }) => {
  await page.setViewportSize({ width: MOBILE.width, height: MOBILE.height })
  const strings = atlasStrings('en')
  await openAtlas(page, 'en', BOTH_VARIANTS_QUERY)

  const market = await badgeText(page, 'data-market-status')
  const safety = await badgeText(page, 'data-safety-display')
  expect(market.length).toBeGreaterThan(0)
  expect(safety.length).toBeGreaterThan(0)

  // Both layouts are on the page: rows with a market badge alone, and rows carrying both.
  const rows = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('tbody tr'))
    return {
      marketOnly: all.filter(
        (row) =>
          row.querySelector('[data-market-status]') && !row.querySelector('[data-safety-display]'),
      ).length,
      both: all.filter(
        (row) =>
          row.querySelector('[data-market-status]') && row.querySelector('[data-safety-display]'),
      ).length,
    }
  })
  expect(rows.marketOnly).toBeGreaterThan(0)
  expect(rows.both).toBeGreaterThan(0)

  // The active safety notice — the ERBE cryoprobes — is among them and still badged.
  expect(safety.some((badge) => badge.value === 'active_safety_notice')).toBe(true)

  for (const badge of market) {
    const label = strings.marketBadge[badge.value]
    expect(label).toBeTruthy()
    expect(badge.hiddenCount).toBe(1)
    // Announced: prefix then status. Seen: status only, so the prefix is context, not a
    // duplicate of the visible label.
    expect(badge.announced).toBe(`${strings.marketPrefix} ${label}`)
    expect(badge.visible).toBe(label)
  }
  for (const badge of safety) {
    const label = strings.safety[badge.value]
    expect(label).toBeTruthy()
    expect(badge.hiddenCount).toBe(1)
    expect(badge.announced).toBe(`${strings.safetyPrefix} ${label}`)
    expect(badge.visible).toBe(label)
  }
})

for (const locale of LOCALES) {
  test(`containment holds for ${locale} at ${MOBILE.name}`, async ({ page }) => {
    await page.setViewportSize({ width: MOBILE.width, height: MOBILE.height })
    const strings = atlasStrings(locale)
    await openAtlas(page, locale, BOTH_VARIANTS_QUERY)

    const measured = await geometry(page, strings.region)
    expect(measured.rootScrollWidth).toBe(measured.rootClientWidth)
    expect(measured.bodyScrollWidth).toBeLessThanOrEqual(measured.rootClientWidth)
    expect(measured.regionScrollWidth).toBeGreaterThan(measured.regionClientWidth)

    const market = await badgeText(page, 'data-market-status')
    expect(market.length).toBeGreaterThan(0)
    for (const badge of market) {
      expect(badge.announced).toBe(`${strings.marketPrefix} ${strings.marketBadge[badge.value]}`)
    }

    /*
     * The three D2B catalogs currently carry the same English status copy, so equal widths
     * across locales would prove nothing on its own. Replacing every hidden prefix with a
     * string far longer than any plausible translation answers the question the locales were
     * meant to ask: containment is structural, not a property of short English labels.
     */
    const stretched = await page.evaluate(() => {
      document
        .querySelectorAll('[data-market-status] .sr-only, [data-safety-display] .sr-only')
        .forEach((node) => {
          node.textContent = `${'estado del mercado 市场状态 '.repeat(40)} `
        })
      const root = document.documentElement
      return { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth }
    })
    expect(stretched.scrollWidth).toBe(stretched.clientWidth)
  })
}
