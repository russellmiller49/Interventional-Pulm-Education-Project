'use client'

import { useState } from 'react'

/**
 * Section 18's copy pattern (the note template, PI-FELLOW-03), for another value-free aid: copy the
 * text to the clipboard, say "Copied", and say plainly when copying is not available so the lines
 * can be selected instead. Nothing is stored or downloaded.
 */
export function CopyTextButton({
  text,
  label,
  dataAttribute,
}: {
  readonly text: string
  readonly label: string
  /** The attribute a test finds the button by, e.g. `data-copy-readiness-aid`. */
  readonly dataAttribute: string
}) {
  const [copied, setCopied] = useState<'copied' | 'unavailable' | null>(null)
  return (
    <>
      <button
        type="button"
        {...{ [dataAttribute]: true }}
        onClick={() => {
          const clipboard = navigator.clipboard
          if (!clipboard) {
            setCopied('unavailable')
            return
          }
          void clipboard.writeText(text).then(
            () => setCopied('copied'),
            () => setCopied('unavailable'),
          )
        }}
      >
        {copied === 'copied' ? 'Copied' : label}
      </button>
      {copied === 'unavailable' ? (
        <span role="status">Copying is not available here; select the lines above instead.</span>
      ) : null}
    </>
  )
}
