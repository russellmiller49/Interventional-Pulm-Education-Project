import Link from 'next/link'
import type { Route } from 'next'
import type { ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AuthShellProps {
  children: ReactNode
  description: string
  showPromo?: boolean
  title: string
}

const promoVideoSrc = '/videos/interventionalpulm-modules-promo.mp4'
const promoPosterSrc = '/videos/interventionalpulm-modules-promo-poster.png'

function AuthPromoSplash() {
  return (
    <aside className="min-w-0 lg:sticky lg:top-24">
      <div className="w-full max-w-full overflow-hidden rounded-2xl border border-primary/20 bg-slate-950 shadow-2xl shadow-primary/10">
        <video
          aria-label="Preview of interventionalpulm.com interactive learning modules"
          autoPlay
          className="aspect-square w-full max-w-full bg-slate-950 object-cover"
          controls
          loop
          muted
          playsInline
          poster={promoPosterSrc}
          preload="metadata"
          src={promoVideoSrc}
        >
          <p>Preview video for interventionalpulm.com interactive learning modules.</p>
        </video>
      </div>
    </aside>
  )
}

export function AuthShell({ children, description, showPromo = false, title }: AuthShellProps) {
  if (showPromo) {
    return (
      <section className="container py-10 sm:py-14 lg:py-16">
        <div className="grid w-full max-w-[calc(100vw-3rem)] min-w-0 gap-8 lg:max-w-none lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.9fr)] lg:items-start">
          <AuthPromoSplash />
          <Card className="min-w-0 w-full">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>{children}</CardContent>
          </Card>
        </div>
      </section>
    )
  }

  return (
    <section className="container flex min-h-[70vh] items-center justify-center py-16">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  )
}

export function AuthFooterLink({
  href,
  label,
  text,
}: {
  href: Route
  label: string
  text: string
}) {
  return (
    <p className="text-sm text-muted-foreground">
      {text}{' '}
      <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">
        {label}
      </Link>
    </p>
  )
}
