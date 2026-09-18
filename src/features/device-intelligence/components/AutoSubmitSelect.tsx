'use client'

import type { ReactNode } from 'react'

/**
 * A select that submits its (GET) form when changed. Progressive enhancement only: the form
 * carries a visible submit button inside <noscript>, so it works identically without
 * JavaScript, and the URL remains the single source of state either way.
 */
export function AutoSubmitSelect({
  id,
  name,
  defaultValue,
  className,
  children,
}: {
  id: string
  name: string
  defaultValue: string
  className?: string
  children: ReactNode
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      className={className}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    >
      {children}
    </select>
  )
}
