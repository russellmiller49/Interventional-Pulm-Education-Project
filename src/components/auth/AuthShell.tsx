import Link from 'next/link'
import type { Route } from 'next'
import type { ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AuthShellProps {
  children: ReactNode
  description: string
  title: string
}

export function AuthShell({ children, description, title }: AuthShellProps) {
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
