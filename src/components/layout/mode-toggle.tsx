'use client'

import { useEffect, useState, type ComponentProps } from 'react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/layout/theme-provider'
import { cn } from '@/lib/cn'

type ButtonProps = ComponentProps<typeof Button>

interface ModeToggleProps {
  className?: string
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
}

export function ModeToggle({ className, variant = 'outline', size }: ModeToggleProps) {
  const common = useTranslations('common')
  const { theme, systemTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentTheme = theme === 'system' ? systemTheme : theme
  const isDarkMode = mounted && currentTheme === 'dark'

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
      aria-label={common('toggleDarkMode')}
      className={cn('gap-2', className)}
    >
      <span aria-hidden className="text-base">
        {isDarkMode ? '🌙' : '☀️'}
      </span>
      <span>{isDarkMode ? common('darkMode') : common('lightMode')}</span>
    </Button>
  )
}
