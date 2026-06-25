import type { Metadata, Route } from 'next'
import Link from 'next/link'

import { AuthShell } from '@/components/auth/AuthShell'
import { Button } from '@/components/ui/button'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Verify email',
  robots: {
    index: false,
    follow: false,
  },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function VerifyEmailPage() {
  return (
    <HandoffContent>
      {
        <AuthShell
          title="Verify your email"
          description="Open the confirmation link in your email before signing in."
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If the email does not arrive, check spam or try signing up again with the same
              address.
            </p>
            <Button asChild>
              <Link href={'/login' as Route}>Back to sign in</Link>
            </Button>
          </div>
        </AuthShell>
      }
    </HandoffContent>
  )
}
