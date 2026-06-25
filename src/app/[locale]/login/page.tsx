import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/auth/LoginForm'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Sign in',
  robots: {
    index: false,
    follow: false,
  },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function LoginPage() {
  return (
    <HandoffContent>
      {
        <AuthShell title="Sign in" description="Use your email and password to continue." showPromo>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading sign in...</p>}>
            <LoginForm />
          </Suspense>
        </AuthShell>
      }
    </HandoffContent>
  )
}
