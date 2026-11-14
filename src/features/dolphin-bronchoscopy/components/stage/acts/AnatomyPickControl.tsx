'use client'

import dolphinAnatomyManifest from '@/features/dolphin-anatomy/content/dolphin-001-manifest.json'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'

import { DOLPHIN_ANATOMY_PRESETS } from '../../../content/anatomyPresets'
import type { AnatomyPickPrompt, AnatomyPresetId } from '../../../content/types'
import styles from '../dolphin-stage.module.css'

const NAME_BY_ID = new Map(dolphinAnatomyManifest.structures.map((s) => [s.id, s.name] as const))

export function anatomyName(id: string): string {
  return NAME_BY_ID.get(id) ?? id
}

/** The prompt the next pick in the 3D model answers: the first not yet answered. */
export function currentAnatomyPrompt(
  prompts: readonly AnatomyPickPrompt[],
  picks: Readonly<Record<string, string>> | undefined,
): AnatomyPickPrompt | null {
  return prompts.find((prompt) => picks?.[prompt.id] === undefined) ?? null
}

/**
 * Pick each structure in the 3D dolphin — or from the list, which is the same answer without a
 * pointer. The first pick for each prompt is the one the card explains; the model then highlights
 * the structure the prompt asked for.
 */
export function AnatomyPickControl({
  preset,
  prompts,
  picks,
  onPick,
}: {
  readonly preset: AnatomyPresetId
  readonly prompts: readonly AnatomyPickPrompt[]
  readonly picks: Readonly<Record<string, string>> | undefined
  readonly onPick: (promptId: string, structureId: string) => void
}) {
  const current = currentAnatomyPrompt(prompts, picks)
  const options = orderChoices(
    preset,
    DOLPHIN_ANATOMY_PRESETS[preset].structures
      .filter((id) => id !== 'body-surface')
      .map((id) => ({ id })),
  )
  return (
    <section className={styles.question} aria-label="Prompt" data-anatomy-pick={preset}>
      <ol className={styles.rows}>
        {prompts.map((prompt) => {
          const picked = picks?.[prompt.id]
          const holds = picked === prompt.answerId
          return (
            <li
              key={prompt.id}
              className={styles.row}
              data-verdict={picked === undefined ? undefined : holds ? 'holds' : 'misplaced'}
              aria-current={prompt === current ? 'step' : undefined}
            >
              <span>{prompt.prompt}</span>
              {picked !== undefined ? (
                <p className={styles.rowFeedback}>
                  {holds
                    ? `${anatomyName(prompt.answerId)}. `
                    : `You picked ${anatomyName(picked).toLowerCase()}; the structure is ${anatomyName(prompt.answerId).toLowerCase()}. `}
                  {prompt.rationale}
                </p>
              ) : prompt === current ? (
                <div className={styles.actions} role="group" aria-label="Or choose from the list">
                  {options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={styles.button}
                      onClick={() => onPick(prompt.id, option.id)}
                    >
                      {anatomyName(option.id)}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
