'use client'

import { Check, CircleAlert, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

const domains = [
  {
    id: 'indication',
    title: 'Original indication resolved',
    prompt:
      'The reason for tracheostomy no longer requires an artificial airway, or a safe alternative plan exists.',
  },
  {
    id: 'stability',
    title: 'Respiratory and hemodynamic stability',
    prompt:
      'Oxygen/ventilatory needs and clinical trajectory are stable enough for a supervised trial.',
  },
  {
    id: 'airway',
    title: 'Patent upper airway',
    prompt:
      'History, examination, observed airflow, endoscopy, or other appropriate testing supports a usable upper-airway route.',
  },
  {
    id: 'cough',
    title: 'Effective cough',
    prompt: 'The patient can mobilize secretions or has a realistic assisted-clearance plan.',
  },
  {
    id: 'secretions',
    title: 'Manageable secretions',
    prompt:
      'Secretion burden and suction frequency are compatible with the local decannulation protocol.',
  },
  {
    id: 'protective',
    title: 'Airway-protective function assessed',
    prompt:
      'Mental status, swallowing, aspiration risk, and oral intake have been evaluated when relevant.',
  },
  {
    id: 'team',
    title: 'Multidisciplinary plan and patient goals',
    prompt:
      'The responsible team agrees on monitoring, rescue, follow-up, and the patient or surrogate understands the plan.',
  },
] as const

export function DecannulationReadinessLab() {
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [reviewed, setReviewed] = useState(false)
  const missing = useMemo(() => domains.filter((domain) => !selected[domain.id]), [selected])

  return (
    <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm md:p-7">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">
          Decannulation readiness conversation
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">
          Review domains—do not calculate a “safe” score
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          There is no universal numeric threshold or mandatory capping duration. Mark the domains
          supported by the case, then identify what still needs assessment under the local protocol.
        </p>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {domains.map((domain) => {
          const active = Boolean(selected[domain.id])
          return (
            <button
              key={domain.id}
              type="button"
              onClick={() => {
                setSelected((current) => ({ ...current, [domain.id]: !current[domain.id] }))
                setReviewed(false)
              }}
              aria-pressed={active}
              className={cn(
                'flex gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-border/70 bg-background hover:border-violet-500/40',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                  active
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-border bg-muted text-transparent',
                )}
              >
                <Check className="h-4 w-4" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">{domain.title}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {domain.prompt}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setReviewed(true)}>
          Review readiness domains
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-2"
          onClick={() => {
            setSelected({})
            setReviewed(false)
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Clear
        </Button>
      </div>

      {reviewed ? (
        <div
          className={cn(
            'mt-5 rounded-2xl border p-4 text-sm leading-6',
            missing.length === 0
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-amber-500/40 bg-amber-500/5',
          )}
          role="status"
        >
          <div className="flex items-start gap-3">
            {missing.length === 0 ? (
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden />
            ) : (
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
            )}
            <div>
              <p className="font-semibold text-foreground">
                {missing.length === 0
                  ? 'All readiness domains are represented in this case.'
                  : `${missing.length} domain${missing.length === 1 ? '' : 's'} still need evidence.`}
              </p>
              <p className="mt-1 text-muted-foreground">
                {missing.length === 0
                  ? 'This supports a multidisciplinary decannulation decision; it does not authorize decannulation or replace the local trial and monitoring protocol.'
                  : `Clarify ${missing.map((domain) => domain.title.toLowerCase()).join(', ')} before advancing the pathway.`}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
