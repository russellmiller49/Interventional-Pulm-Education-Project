'use client'

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'

import styles from './bronch-stage.module.css'

/**
 * A teaching image at a size it can be read at (fellow walkthrough A18, A28, A29, SUP-13).
 *
 * A native modal dialog, opened only by the figure's own Enlarge button: Escape and Close shut it,
 * and focus goes back to that button. It is the same pattern as the stage's help dialog, kept here
 * because an image needs the viewport rather than a reading column. Opening it changes nothing the
 * course records; the learner's choices on the card underneath stay as they were.
 */
export function MediaEnlargeDialog({
  open,
  onClose,
  title,
  returnFocusTo,
  children,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: string
  readonly returnFocusTo: RefObject<HTMLElement | null>
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
      returnFocusTo.current?.focus()
    }
  }, [open, returnFocusTo])

  return (
    <dialog
      ref={ref}
      className={styles.mediaDialog}
      aria-labelledby={titleId}
      data-media-dialog
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClose={onClose}
    >
      {open ? (
        <div className={styles.mediaDialogInner}>
          <div className={styles.mediaDialogHeader}>
            <h2 id={titleId}>{title}</h2>
            <button type="button" onClick={onClose} autoFocus data-media-dialog-close>
              Close
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  )
}
