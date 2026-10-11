import { findCopyErrors } from './authoringRules'
import { findFrameErrors } from './findFrames'
import { IMAGE_BANK_ROWS, IMAGE_BANK_SETS, imageBankSet } from './imageBank'

/**
 * The image bank's checks, kept apart from its content so the page that shows a set does not load
 * the authoring rules.
 */

/** What is wrong with the bank. Empty when every question is sound. */
export function imageBankErrors(): readonly string[] {
  const errors: string[] = []
  const ids = IMAGE_BANK_ROWS.map((entry) => entry.id)
  if (new Set(ids).size !== ids.length) errors.push('The image bank repeats a question id.')
  IMAGE_BANK_SETS.forEach((rows, index) => {
    const where = `image bank set ${index + 1}`
    const find = imageBankSet(index + 1)!
    errors.push(...findCopyErrors(where, find))
    for (const entry of rows) {
      errors.push(...findFrameErrors(`${where} image ${entry.id}`, entry))
      if (!entry.context.startsWith('You '))
        errors.push(`${where} image ${entry.id} does not say where the scope is.`)
    }
    const asked = rows.map((entry) => `${entry.frameId}/${entry.targetId}`)
    if (new Set(asked).size !== asked.length)
      errors.push(`${where} asks for the same opening twice.`)
    rows.forEach((entry, position) => {
      if (position > 0 && rows[position - 1].frameId === entry.frameId)
        errors.push(`${where} shows the same picture twice in a row (${entry.id}).`)
    })
  })
  return errors
}
