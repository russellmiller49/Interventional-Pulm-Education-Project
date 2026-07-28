'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PenLine, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

import { MAX_CUSTOM_DESCRIPTION, MAX_CUSTOM_NOTE, type CustomItem } from '../domain/custom-item'

interface CustomItemFormProps {
  roleCode: string
  roleLabel: string
  onAdd: (item: CustomItem) => void
  className?: string
}

/**
 * Write a line the catalog does not have.
 *
 * Six roles the templates ask for — PPE, suction, specimen handling, collateral-ventilation
 * assessment, the energy platform, whole-lung lavage fluid — are room resources or locally
 * stocked consumables with nothing catalogued. Without this they stay unresolved forever.
 */
export function CustomItemForm({ roleCode, roleLabel, onAdd, className }: CustomItemFormProps) {
  const t = useTranslations('preferenceCards.customItem')
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [itemNumber, setItemNumber] = useState('')
  const [notes, setNotes] = useState('')

  const trimmed = description.trim()

  function submit() {
    if (!trimmed) return
    onAdd({
      // Unique per line without needing a counter threaded through the wizard. Stable once
      // added, so re-saving a card keeps the same hospital-item id.
      id: `${roleCode}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      roleCode,
      description: trimmed.slice(0, MAX_CUSTOM_DESCRIPTION),
      itemNumber: itemNumber.trim() ? itemNumber.trim().slice(0, 120) : null,
      notes: notes.trim() ? notes.trim().slice(0, MAX_CUSTOM_NOTE) : null,
    })
    setDescription('')
    setItemNumber('')
    setNotes('')
    setOpen(false)
  }

  return (
    <div className={cn('mt-2', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-full justify-center gap-1.5 text-xs"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <PenLine aria-hidden="true" className="h-3.5 w-3.5" />
        {open ? t('hide') : t('add')}
      </Button>

      {open ? (
        <div className="mt-2 space-y-2 rounded-lg border border-border bg-muted/20 p-2">
          <label className="block text-[11px] font-semibold text-foreground">
            {t('descriptionLabel')}
            <input
              type="text"
              value={description}
              maxLength={MAX_CUSTOM_DESCRIPTION}
              autoFocus
              onChange={(event) => setDescription(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submit()
                }
              }}
              placeholder={t('descriptionPlaceholder', { requirement: roleLabel })}
              className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="block text-[11px] font-semibold text-foreground">
            {t('itemNumberLabel')}
            <input
              type="text"
              value={itemNumber}
              maxLength={120}
              onChange={(event) => setItemNumber(event.target.value)}
              placeholder={t('itemNumberPlaceholder')}
              className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="block text-[11px] font-semibold text-foreground">
            {t('notesLabel')}
            <input
              type="text"
              value={notes}
              maxLength={MAX_CUSTOM_NOTE}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <Button
            type="button"
            size="sm"
            disabled={!trimmed}
            className="h-7 w-full gap-1 text-[11px]"
            onClick={submit}
          >
            <Plus aria-hidden="true" className="h-3 w-3" />
            {t('save')}
          </Button>
          <p className="text-[10px] leading-4 text-muted-foreground">{t('unverifiedNote')}</p>
        </div>
      ) : null}
    </div>
  )
}
