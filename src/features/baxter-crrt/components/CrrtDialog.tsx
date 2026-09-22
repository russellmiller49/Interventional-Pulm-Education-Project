'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactElement, ReactNode, RefObject } from 'react'

import styles from './crrt-dialog.module.css'

/**
 * A deliberate, modal CRRT surface — Help and the expanded circuit.
 *
 * Radix supplies the focus trap, Escape, `aria-modal` and the labelled `dialog` role. The one
 * thing it cannot know is where focus belongs afterwards when the opener is not its own Trigger
 * (Help is a button in the shared activity header): `returnFocusRef` names that element, so
 * closing always lands the learner back where they asked for the surface. The content is
 * viewport-bounded and scrolls inside itself, so it cannot open off-screen at 320 px or at
 * enlarged text.
 */
export function CrrtDialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  returnFocusRef,
  size = 'standard',
  children,
}: {
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
  readonly title: ReactNode
  readonly description: ReactNode
  /** A button that opens the dialog; Radix then returns focus to it on close. */
  readonly trigger?: ReactElement
  /** Where focus returns when the dialog was opened from outside a Trigger. */
  readonly returnFocusRef?: RefObject<HTMLElement | null>
  readonly size?: 'standard' | 'wide'
  readonly children: ReactNode
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content
          className={styles.content}
          data-size={size}
          data-crrt-dialog
          onCloseAutoFocus={(event) => {
            const target = returnFocusRef?.current
            if (target && target.isConnected) {
              event.preventDefault()
              target.focus()
            }
          }}
        >
          <div className={styles.header}>
            <DialogPrimitive.Title className={styles.title}>{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close className={styles.close} aria-label="Close">
              <X aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className={styles.description}>
            {description}
          </DialogPrimitive.Description>
          <div className={styles.body}>{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
