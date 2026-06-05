import type { Metadata } from 'next'

import { AuthShell } from '@/components/auth/AuthShell'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export const metadata: Metadata = {
  title: 'Reset password',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset password" description="Send a password reset link to your email.">
      <ForgotPasswordForm />
    </AuthShell>
  )
}
