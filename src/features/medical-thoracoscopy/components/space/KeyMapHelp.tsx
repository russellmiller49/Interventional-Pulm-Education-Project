import styles from './space-pane.module.css'
import { spaceKeyAction, SPACE_KEY_HELP } from './spaceKeyMap'
import { commandWords, KEY_WORDS } from './spaceWords'
import { spaceControlId } from './types'

/**
 * The key help panel, read from the key map itself, so the table cannot drift from the keys. The
 * forceps' keys are listed only where the forceps can be used.
 */
export function KeyMapHelp({
  open,
  onToggle,
  reducedMotion,
  withTool = false,
}: {
  readonly open: boolean
  readonly onToggle: () => void
  readonly reducedMotion: boolean
  readonly withTool?: boolean
}) {
  const panelId = spaceControlId('key-help')
  return (
    <section className={styles.keyHelp} aria-labelledby={spaceControlId('key-help-heading')}>
      <h3 id={spaceControlId('key-help-heading')} className={styles.keyHelpHeading}>
        {KEY_WORDS.heading}
      </h3>
      <button
        id={spaceControlId('key-help-toggle')}
        type="button"
        className={styles.actionButton}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        {open ? KEY_WORDS.hideHelp : KEY_WORDS.showHelp}
      </button>
      <div id={panelId} hidden={!open}>
        <p className={styles.partNote}>
          {KEY_WORDS.focusNote} {reducedMotion ? KEY_WORDS.reducedNote : KEY_WORDS.holdNote}
        </p>
        <table className={styles.keyTable}>
          <thead>
            <tr>
              <th scope="col">{KEY_WORDS.keyColumn}</th>
              <th scope="col">{KEY_WORDS.actionColumn}</th>
            </tr>
          </thead>
          <tbody>
            {SPACE_KEY_HELP.map((row) => {
              const action = spaceKeyAction(row.key)
              if (action?.kind === 'tool' && !withTool) return null
              return (
                <tr key={row.key}>
                  <th scope="row">
                    <kbd>{row.keys}</kbd>
                  </th>
                  <td>
                    {action === null || action.kind === 'help'
                      ? `${KEY_WORDS.showHelp} or ${KEY_WORDS.hideHelp.toLowerCase()}`
                      : commandWords(action)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
