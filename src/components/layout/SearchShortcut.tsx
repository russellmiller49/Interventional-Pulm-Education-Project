import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/cn'
import { HandoffContent } from '@/i18n/handoff'

interface SearchShortcutProps {
  className?: string
}

export function SearchShortcut({ className }: SearchShortcutProps) {
  return (
    <HandoffContent>
      {
        <span className={cn('flex items-center gap-1', className)}>
          <Kbd className="text-[10px] uppercase">Ctrl</Kbd>
          <span className="text-xs text-muted-foreground">/</span>
          <Kbd className="text-[10px] uppercase">⌘</Kbd>
          <span className="text-xs text-muted-foreground">+</span>
          <Kbd className="text-[10px] uppercase">K</Kbd>
        </span>
      }
    </HandoffContent>
  )
}
