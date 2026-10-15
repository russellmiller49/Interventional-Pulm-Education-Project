import { act, fireEvent } from '@testing-library/react'

import { consoleControlId, CONSOLE_PENDING_CONFIRM_ID } from '../content/consoleControlIds'
import type { VentilatorControlKey } from '../engine/types'

/**
 * Drives the flowing Learn stage the way a learner does: the task list, the Now card's primary
 * action, the clock bar and the console's own Controls and Tools screens.
 */

/** Open "Tasks in this section" and choose the task at this lesson index. */
export function chooseStep(lessonIndex: number, stepIds?: readonly string[]) {
  const list = document.querySelector('[data-task-map]') as HTMLDetailsElement | null
  if (!list) throw new Error('No task list on the page')
  list.open = true
  const rows = [...list.querySelectorAll<HTMLLIElement>('[data-step-list] li')]
  const row = stepIds
    ? rows.find((candidate) => candidate.getAttribute('data-step-id') === stepIds[lessonIndex])
    : undefined
  const target =
    row ??
    rows.find((candidate) =>
      candidate.getAttribute('data-step-id')?.includes(`:${lessonIndex + 1}-`),
    )
  if (!target) throw new Error(`No task at lesson index ${lessonIndex}`)
  const button = target.querySelector('button')!
  if (!button.disabled) fireEvent.click(button)
}

/** The Now card's primary action, or null when the card has none. */
export function nowPrimary(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-primary]')
}

export function nowPrimaryLabel(): string | null {
  return nowPrimary()?.textContent ?? null
}

/** Press the Now card's primary action. */
export function pressPrimary() {
  const primary = nowPrimary()
  if (!primary) throw new Error('The Now card has no primary action')
  fireEvent.click(primary)
}

export function openConsoleScreen(screen: 'main' | 'controls' | 'tools' | 'modes' | 'alarms') {
  fireEvent.click(document.getElementById(`mv-screen-${screen}`)!)
}

/**
 * Set a numeric control on the console: open Controls, select the tile, turn it with the arrow
 * keys to the native value, and confirm on a knob-and-confirm console.
 */
export function setConsoleControl(
  key: VentilatorControlKey,
  nativeValue: number,
  { confirm = true }: { readonly confirm?: boolean } = {},
) {
  openConsoleScreen('controls')
  const tileId = consoleControlId(key)
  const tile = () => document.getElementById(tileId) as HTMLButtonElement
  if (!tile()) throw new Error(`No ${key} tile on the Controls screen`)
  fireEvent.click(tile())
  const read = () => Number(tile().querySelector('strong')!.textContent)
  for (let guard = 0; guard < 400 && Math.abs(read() - nativeValue) > 1e-6; guard += 1) {
    fireEvent.keyDown(tile(), { key: read() < nativeValue ? 'ArrowUp' : 'ArrowDown' })
  }
  if (Math.abs(read() - nativeValue) > 1e-6)
    throw new Error(`Could not turn ${key} to ${nativeValue}; it stopped at ${read()}`)
  const confirmButton = document.getElementById(CONSOLE_PENDING_CONFIRM_ID)
  if (confirm && confirmButton) fireEvent.click(confirmButton)
}

export function pressClock(control: 'run' | 'one-breath') {
  fireEvent.click(document.getElementById(`mv-clock-${control}`)!)
}

/** Advance model time on the live clock by this many wall-clock milliseconds (fake timers). */
export function runFor(milliseconds: number) {
  act(() => jest.advanceTimersByTime(milliseconds))
}

/** Open the Sections drawer and choose a section by its position in the pathway. */
export function chooseSection(sectionNumber: number) {
  const drawer = document.querySelector('[data-sections-drawer]') as HTMLDetailsElement | null
  if (!drawer) throw new Error('No Sections drawer on the page')
  drawer.open = true
  const button = [...drawer.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.getAttribute('aria-label')?.startsWith(`${sectionNumber}. `),
  )
  if (!button) throw new Error(`No section ${sectionNumber} in the drawer`)
  fireEvent.click(button)
}
