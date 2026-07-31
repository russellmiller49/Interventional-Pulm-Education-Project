'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function GoldSetTestUnlockButton({ batchId }: { batchId: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function unlock() {
    const reason = window.prompt(
      'Why is the locked test being opened now? This reason is written to the immutable batch audit log.',
      'Development split completed; opening the test split for final evaluation.',
    )
    if (reason === null) return
    if (reason.trim().length < 5) {
      setError('Enter an audit reason of at least 5 characters.')
      return
    }
    if (
      !window.confirm(
        'Unlock the test split? This exposes held-out labels for final evaluation and cannot be undone.',
      )
    ) {
      return
    }

    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/literature/gold-set/batch/${batchId}/unlock-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string }
        } | null
        throw new Error(body?.error?.message ?? 'The test split could not be unlocked.')
      }
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The test split could not be unlocked.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" disabled={saving} onClick={() => void unlock()}>
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        {saving ? 'Unlocking…' : 'Unlock test for final evaluation'}
      </Button>
      {error ? (
        <p role="alert" className="max-w-xl text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
