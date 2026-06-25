import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AuthShell } from '@/components/auth/AuthShell'
import { SignupForm } from '@/components/auth/SignupForm'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Create account',
  robots: {
    index: false,
    follow: false,
  },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function SignupPage() {
  return (
    <HandoffContent>
      {
        <AuthShell
          title="Create your free account"
          description="Your profile helps tailor education modules and aggregate learning analytics."
          showPromo
        >
          <Suspense
            fallback={<p className="text-sm text-muted-foreground">Loading signup form...</p>}
          >
            <SignupForm />
          </Suspense>
        </AuthShell>
      }
    </HandoffContent>
  )
}
