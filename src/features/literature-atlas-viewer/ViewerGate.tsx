import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import {
  ATLAS_WORDS,
  VIEWER_SESSION_ENDPOINT,
  VIEWER_WORDS,
  type ViewerReturn,
  type ViewerState,
} from './paths'

/**
 * The viewer-password screen: a plain form that posts to the server and returns to this page.
 * Nothing about the password is on the page, and it works without JavaScript.
 */
export function ViewerGate({
  locale,
  state,
  returnTo = 'evidence',
}: {
  locale: string
  state: ViewerState | null
  /** Where a correct password returns to: the draft evidence (default) or the main Atlas page. */
  returnTo?: ViewerReturn
}) {
  const atlas = returnTo === 'atlas'
  const words = atlas ? { ...VIEWER_WORDS, ...ATLAS_WORDS } : VIEWER_WORDS
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-12">
      <section
        aria-labelledby="atlas-viewer-title"
        className="w-full rounded-xl border bg-card p-6 shadow-sm md:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/90">
          {words.course}
        </p>
        <h1 id="atlas-viewer-title" className="mt-1 text-2xl font-semibold">
          {words.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-foreground/90">{words.intro}</p>
        {state && (
          <p
            className={
              state === 'ended'
                ? 'mt-4 rounded-md border px-3 py-2 text-sm'
                : 'mt-4 rounded-md border border-destructive px-3 py-2 text-sm text-destructive'
            }
            role={state === 'ended' ? 'status' : 'alert'}
          >
            {words.messages[state]}
          </p>
        )}
        <form method="post" action={VIEWER_SESSION_ENDPOINT} className="mt-5 flex flex-col gap-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="return" value={returnTo} />
          <label htmlFor="atlas-viewer-password" className="text-sm font-medium">
            {words.passwordLabel}
          </label>
          <Input
            id="atlas-viewer-password"
            name="password"
            type="password"
            required
            maxLength={200}
            autoComplete="current-password"
            spellCheck={false}
          />
          <Button type="submit">{words.open}</Button>
        </form>
        <p className="mt-4 text-xs leading-5 text-foreground/90">{words.help}</p>
      </section>
    </main>
  )
}

export function ViewerUnavailable({ returnTo = 'evidence' }: { returnTo?: ViewerReturn }) {
  const atlas = returnTo === 'atlas'
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center px-4 py-12">
      <section
        aria-labelledby="atlas-viewer-title"
        className="w-full rounded-xl border bg-card p-6 shadow-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/90">
          {VIEWER_WORDS.course}
        </p>
        <h1 id="atlas-viewer-title" className="mt-1 text-2xl font-semibold">
          {atlas ? ATLAS_WORDS.title : VIEWER_WORDS.title}
        </h1>
        <p className="mt-3 text-sm" role="alert">
          {atlas ? ATLAS_WORDS.unavailable : VIEWER_WORDS.unavailable}
        </p>
      </section>
    </main>
  )
}
