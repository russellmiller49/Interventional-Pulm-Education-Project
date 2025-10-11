'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState, type ComponentProps } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

type ButtonProps = ComponentProps<typeof Button>

interface ModeToggleProps {
  className?: string
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
}

export function ModeToggle({ className, variant = 'outline', size }: ModeToggleProps) {
  const { theme, systemTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentTheme = theme === 'system' ? systemTheme : theme

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle dark mode"
      className={cn('gap-2', className)}
    >
      <span aria-hidden className="text-base">
        {mounted && currentTheme === 'dark' ? '🌙' : '☀️'}
      </span>
      <span>{mounted && currentTheme === 'dark' ? 'Dark' : 'Light'} mode</span>
    </Button>
  )
}
