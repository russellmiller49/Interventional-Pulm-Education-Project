import type { Metadata } from 'next'

import { AuthShell } from '@/components/auth/AuthShell'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Reset password',
  robots: {
    index: false,
    follow: false,
  },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function ForgotPasswordPage() {
  return (
    <HandoffContent>
      {
        <AuthShell title="Reset password" description="Send a password reset link to your email.">
          <ForgotPasswordForm />
        </AuthShell>
      }
    </HandoffContent>
  )
}
