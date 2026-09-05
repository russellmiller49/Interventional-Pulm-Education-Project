'use client'

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'

import styles from './lesson-shell.module.css'

/**
 * "What do I do now?", as a modal dialog.
 *
 * The caller renders the current Now card's content into it. Focus moves into the dialog on open
 * and back to the trigger on close; Escape closes it. The children are only rendered while open,
 * so nothing the dialog would say is in the document for a leak scan to find beforehand.
 */
export function HelpDialog({
  open,
  onClose,
  title = 'What do I do now?',
  returnFocusTo,
  children,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly title?: string
  readonly returnFocusTo?: RefObject<HTMLElement | null>
  readonly children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const wasOpen = useRef(false)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal()
        else dialog.setAttribute('open', '')
      }
      wasOpen.current = true
      return
    }
    if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
    if (wasOpen.current) {
      wasOpen.current = false
      returnFocusTo?.current?.focus()
    }
  }, [open, returnFocusTo])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      data-stage-help-dialog
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClose={onClose}
    >
      {open ? (
        <div className={styles.dialogInner}>
          <div className={styles.dialogHeader}>
            <h2 id={titleId} className={styles.dialogTitle}>
              {title}
            </h2>
            <button type="button" className={styles.headerButton} onClick={onClose} autoFocus>
              Close
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  )
}
