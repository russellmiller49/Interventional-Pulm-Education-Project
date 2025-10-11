'use client'

import * as React from 'react'

import { cn } from '@/lib/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', leadingIcon, trailingIcon, ...props }, ref) => {
    return (
      <div
        className={cn(
          'group relative flex items-center rounded-full border border-border/70 bg-background transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30',
          className,
        )}
      >
        {leadingIcon ? (
          <span className="pl-4 text-muted-foreground group-focus-within:text-primary">
            {leadingIcon}
          </span>
        ) : null}
        <input
          type={type}
          className={cn(
            'flex-1 bg-transparent px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            leadingIcon ? 'pl-2' : 'pl-4',
            trailingIcon ? 'pr-2' : 'pr-4',
          )}
          ref={ref}
          {...props}
        />
        {trailingIcon ? (
          <span className="pr-4 text-muted-foreground group-focus-within:text-primary">
            {trailingIcon}
          </span>
        ) : null}
      </div>
    )
  },
)
Input.displayName = 'Input'

export { Input }
