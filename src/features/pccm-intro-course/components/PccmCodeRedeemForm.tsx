'use client'

import { useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter } from '@/i18n/navigation'

export function PccmCodeRedeemForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/pccm-intro-course/redeem-code', {
        body: JSON.stringify({ code }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        setError(payload?.error ?? 'Unable to redeem this course code.')
        return
      }

      router.push('/pccm-intro-course')
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="max-w-2xl rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <KeyRound className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Have a PCCM intro course code?</h2>
            <p className="text-sm text-muted-foreground">
              Redeem your UCSD or Loma Linda course or faculty code to open the bronchoscopy and
              pleural disease course materials.
            </p>
          </div>
          <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={onSubmit}>
            <Input
              aria-label="PCCM intro course code"
              autoComplete="off"
              disabled={isSubmitting}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Enter course code"
              value={code}
            />
            <Button disabled={isSubmitting || code.trim().length === 0} type="submit">
              {isSubmitting ? 'Checking...' : 'Redeem'}
            </Button>
          </form>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </section>
  )
}
