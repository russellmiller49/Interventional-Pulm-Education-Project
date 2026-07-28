import { expect, test } from '@playwright/test'

test.setTimeout(120_000)

test('keeps all three guided PAC panels independently scrollable and resizable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1705, height: 1009 })
  await page.goto('/en/icu-hemodynamics/learn?activity=catheter-advancement')

  await expect(page.getByRole('heading', { name: 'Advance the PAC by waveform' })).toBeVisible({
    timeout: 60_000,
  })
  await page.getByRole('button', { name: 'Orient to this skill station' }).click()
  await expect(page.getByText('Orientation 1 of 5')).toBeVisible()
  await page.getByRole('button', { name: 'Next: Right atrium' }).click()
  await expect(page.getByText('Orientation 2 of 5')).toBeVisible()
  await page.getByRole('button', { name: 'Next: Right ventricle' }).click()
  await expect(page.getByText('Orientation 3 of 5')).toBeVisible()
  await page.getByRole('button', { name: 'Next: Pulmonary artery' }).click()
  await expect(page.getByText('Orientation 4 of 5')).toBeVisible()
  await page.getByRole('button', { name: 'Next: Normal wedge / PAWP' }).click()
  await expect(page.getByText('Orientation 5 of 5')).toBeVisible()
  await page
    .getByRole('radio', {
      name: /PA pulsatility and the dicrotic notch disappear/i,
    })
    .check()
  await page.getByRole('button', { name: 'Finish orientation and begin hands-on pass' }).click()

  const monitor = page.getByRole('region', { name: 'Monitor panel' })
  const physiology = page.getByRole('region', {
    name: 'Anatomy and pressure-reference panel',
  })
  const controls = page.getByRole('region', {
    name: 'PAC controls and waveform-teaching panel',
  })
  for (const panel of [monitor, physiology, controls]) {
    await expect(panel).toBeVisible()
    await expect(panel).toHaveCSS('overflow-y', 'auto')
  }

  const initialBoxes = await Promise.all([
    monitor.boundingBox(),
    physiology.boundingBox(),
    controls.boundingBox(),
  ])
  expect(initialBoxes.every(Boolean)).toBe(true)
  expect(Math.abs(initialBoxes[0]!.y - initialBoxes[1]!.y)).toBeLessThan(2)
  expect(Math.abs(initialBoxes[1]!.y - initialBoxes[2]!.y)).toBeLessThan(2)
  expect(initialBoxes[2]!.width).toBeGreaterThan(280)

  const monitorDivider = page.getByRole('separator', {
    name: 'Resize monitor and anatomy panels',
  })
  const dividerBox = await monitorDivider.boundingBox()
  expect(dividerBox).not.toBeNull()
  await page.mouse.move(dividerBox!.x + dividerBox!.width / 2, dividerBox!.y + 80)
  await page.mouse.down()
  await page.mouse.move(dividerBox!.x + dividerBox!.width / 2 + 72, dividerBox!.y + 80)
  await page.mouse.up()

  const resizedMonitor = await monitor.boundingBox()
  expect(resizedMonitor!.width).toBeGreaterThan(initialBoxes[0]!.width + 50)

  await page.getByRole('button', { name: 'Advance', exact: true }).click()
  await expect(
    page.getByRole('note', { name: 'RA and CVP end-expiratory measurement' }),
  ).toContainText('RA = CVP here', { timeout: 15_000 })
  const { cvpValue, pacRaValue } = await page.evaluate(() => ({
    cvpValue:
      document
        .querySelector('[aria-label="Central venous pressure"] strong')
        ?.textContent?.trim() ?? '',
    pacRaValue:
      document.querySelector('[aria-label="Current PAC pressure"] strong')?.textContent?.trim() ??
      '',
  }))
  expect(cvpValue).toBe(pacRaValue)
  await expect(
    page.getByRole('img', { name: /CVP waveform.*end-exp · c-base.*on the trace/i }),
  ).toBeVisible()
  await expect(page.getByRole('img', { name: /ART waveform.*end-exp cursor/i })).toBeVisible()

  const scrollPositions = await page.evaluate(() => {
    const monitorPanel = document.querySelector<HTMLElement>('[aria-label="Monitor panel"]')!
    const physiologyPanel = document.querySelector<HTMLElement>(
      '[aria-label="Anatomy and pressure-reference panel"]',
    )!
    const controlsPanel = document.querySelector<HTMLElement>(
      '[aria-label="PAC controls and waveform-teaching panel"]',
    )!
    physiologyPanel.scrollTop = 90
    controlsPanel.scrollTop = 130
    return {
      monitor: monitorPanel.scrollTop,
      physiology: physiologyPanel.scrollTop,
      controls: controlsPanel.scrollTop,
    }
  })
  expect(scrollPositions.monitor).toBe(0)
  expect(scrollPositions.physiology).toBeGreaterThan(0)
  expect(scrollPositions.controls).toBeGreaterThan(0)

  await expect(
    page.getByRole('heading', { name: 'Advance by waveform and catheter route' }),
  ).toHaveCSS('color', 'rgb(9, 41, 52)')
})

test('jumps among one advancement-first PAC pathway and keeps the teaching workspace intact', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1705, height: 1009 })
  await page.goto('/en/icu-hemodynamics/learn?activity=catheter-advancement')

  const pathway = page.getByRole('navigation', { name: 'PAC learning pathway sections' })
  await expect(pathway).toBeVisible({ timeout: 60_000 })
  const sectionButtons = pathway.getByRole('button')
  await expect(sectionButtons).toHaveCount(7)
  await expect(sectionButtons.nth(0)).toHaveAttribute('aria-current', 'step')
  await expect(sectionButtons.nth(6)).toHaveAccessibleName(
    '7. PAC signal-validation capstone, integration capstone',
  )

  await pathway.getByRole('button', { name: '5. Cardiac output: thermodilution and Fick' }).click()
  await expect(page).toHaveURL(/activity=thermodilution-series/)
  await expect(
    page.getByRole('heading', { name: 'Cardiac output: measure flow, then judge the method' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Thermodilution measurement lab' })).toBeVisible()
  await expect(page.getByRole('separator')).toHaveCount(2)

  await page
    .getByRole('navigation', { name: 'PAC learning pathway sections' })
    .getByRole('button', { name: '6. Derived hemodynamics and validity' })
    .click()
  await expect(page).toHaveURL(/activity=derived-hemodynamics/)
  await expect(
    page.getByRole('heading', {
      name: 'Derived hemodynamics are equations, not new measurements',
    }),
  ).toBeVisible()
  await expect(page.getByText('PVR = (mPAP − PAWP) ÷ CO')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Monitor panel' })).toHaveCSS('overflow-y', 'auto')
  await expect(
    page.getByRole('region', { name: 'Anatomy and pressure-reference panel' }),
  ).toHaveCSS('overflow-y', 'auto')
  await expect(
    page.getByRole('region', { name: 'PAC controls and waveform-teaching panel' }),
  ).toHaveCSS('overflow-y', 'auto')
})
