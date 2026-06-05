import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Sign in',
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" description="Use your email and password to continue.">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading sign in...</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
