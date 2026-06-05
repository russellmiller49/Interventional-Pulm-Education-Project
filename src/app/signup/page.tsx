import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AuthShell } from '@/components/auth/AuthShell'
import { SignupForm } from '@/components/auth/SignupForm'

export const metadata: Metadata = {
  title: 'Create account',
  robots: {
    index: false,
    follow: false,
  },
}

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your free account"
      description="Your profile helps tailor education modules and aggregate learning analytics."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading signup form...</p>}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  )
}
