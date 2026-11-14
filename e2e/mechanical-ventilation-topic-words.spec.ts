import { expect, test } from '@playwright/test'

/**
 * Mechanical ventilation: a section can be found by name.
 *
 * Most section titles are questions with no topic word ("Do the two breath clocks agree?"). Each
 * section's topic word now leads its question in the lesson's header line, in the Sections menu
 * and on the Learn page. Section 7's is "Expiratory time": the name of what the learner finds
 * there is withheld until they have found it.
 */

const TOPICS = [
  'The breath cycle',
  'Ventilator waveforms',
  'Ventilator settings',
  'Peak and plateau pressure',
  'Volume and pressure control',
  'Lung-protective ventilation',
  'Expiratory time',
  'Triggering and cycling',
  'Oxygenation and PEEP',
  'CO₂ and minute ventilation',
  'Systematic waveform reading',
  'Patient–ventilator dyssynchrony',
  'Alarms and reassessment',
  'High peak pressure',
]

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
})

for (const [width, height] of [
  [1600, 852],
  [390, 844],
] as const) {
  test(`the lesson names its topic and the Sections menu lists all fourteen at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/en/mechanical-ventilation/learn?activity=expiration-and-air-trapping')
    await expect(page.locator('[data-now-card]').first()).toBeVisible({ timeout: 90_000 })

    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveText('Does the breath have time to finish?')
    await expect(page.getByText(/Section 7 of 14 · Expiratory time · \d+ min/i)).toBeVisible()

    await page.locator('[data-sections-drawer] summary').click()
    const rows = page.locator('[data-sections-panel] ol li button')
    await expect(rows).toHaveCount(TOPICS.length)
    await expect(rows.locator('strong')).toHaveText(TOPICS)
    // Nothing in the menu names what this section is about to show.
    await expect(page.locator('[data-sections-panel]')).not.toContainText(
      /trapp|auto-?peep|hyperinflation/i,
    )
    // No topic word is cut off, and the page does not scroll sideways.
    const fit = await page.evaluate(() => ({
      clipped: [...document.querySelectorAll('[data-sections-panel] ol li button strong')].filter(
        (element) => element.scrollWidth > element.clientWidth + 1,
      ).length,
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))
    expect(fit).toEqual({ clipped: 0, sideways: 0 })
  })

  test(`the Learn page lists each section by topic, then question, at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/en/mechanical-ventilation/learn')
    const list = page.locator('[data-pathway-accordion]')
    await expect(list).toBeVisible({ timeout: 90_000 })
    await list.evaluate((element) =>
      element.querySelectorAll('details').forEach((group) => (group.open = true)),
    )
    const names = list.locator('[data-kind="section"] [data-section-name]')
    await expect(names).toHaveCount(TOPICS.length)
    await expect(names.nth(6)).toHaveText(
      '7. Expiratory time · Does the breath have time to finish?',
    )
    await expect(names.nth(3)).toHaveText(
      '4. Peak and plateau pressure · Where does the pressure go?',
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0)
  })
}
