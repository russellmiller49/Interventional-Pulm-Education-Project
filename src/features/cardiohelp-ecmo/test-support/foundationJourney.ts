import { fireEvent, screen } from '@testing-library/react'

/** Navigate the real controls. No seeding, phase mutation, answer-key dispatch, or skipped action. */
export function currentFoundationStep(): string {
  return document.querySelector('[data-ecmo-shell="learn"]')?.getAttribute('data-stage') ?? ''
}

export function advanceFoundationOnce(): void {
  const pending = document.querySelector<HTMLInputElement>(
    'fieldset[data-prediction-choices]:not(:disabled) input[type="radio"]',
  )
  if (
    pending &&
    !document.querySelector('fieldset[data-prediction-choices]:not(:disabled) input:checked')
  )
    fireEvent.click(pending)
  for (const select of document.querySelectorAll<HTMLSelectElement>(
    '[data-attribution-candidate] select:not(:disabled)',
  )) {
    if (!select.value) fireEvent.change(select, { target: { value: select.options[1].value } })
  }
  const primary =
    document.querySelector<HTMLButtonElement>('[data-now-primary]') ??
    document.querySelector<HTMLButtonElement>('[data-map-question-actions] button') ??
    screen.queryByRole<HTMLButtonElement>('button', { name: 'Continue' })
  if (!primary || primary.disabled)
    throw new Error(`No enabled advance action at ${currentFoundationStep()}`)
  fireEvent.click(primary)
}

export function reachFoundationStep(sectionId: string, taskId: string): void {
  for (let count = 0; currentFoundationStep() !== `${sectionId}-${taskId}`; count += 1) {
    if (count > 40) throw new Error(`Could not reach ${taskId} from ${currentFoundationStep()}`)
    advanceFoundationOnce()
  }
}

export function submitFoundationAnswer(choiceId?: string): void {
  const choice = document.querySelector<HTMLInputElement>(
    choiceId
      ? `fieldset[data-prediction-choices] input[value="${choiceId}"]`
      : 'fieldset[data-prediction-choices] input[type="radio"]',
  )
  if (!choice) throw new Error('No answer choice on the current task')
  fireEvent.click(choice)
  const button = screen.getByRole('button', {
    name: /^(Submit answer|Commit this prediction|Commit this answer)$/,
  })
  fireEvent.click(button)
}
