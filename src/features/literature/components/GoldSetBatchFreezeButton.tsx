'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LockKeyhole } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function GoldSetBatchFreezeButton({ batchId }: { batchId: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function freeze() {
    if (
      !window.confirm(
        'Freeze this completed batch? Reviews, labels, reveal state, and sampling metadata will become read-only.',
      )
    ) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/literature/gold-set/batch/${batchId}/freeze`, {
        method: 'POST',
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string }
        } | null
        throw new Error(body?.error?.message ?? 'The batch could not be frozen.')
      }
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The batch could not be frozen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" disabled={saving} onClick={() => void freeze()}>
        <LockKeyhole className="h-4 w-4" aria-hidden="true" />
        {saving ? 'Freezing…' : 'Freeze completed batch'}
      </Button>
      {error ? (
        <p role="alert" className="max-w-md text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
