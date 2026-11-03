import type { Metadata } from 'next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What Interventional Pulmonology Education collects, why, who processes it and how to have it removed.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

const PRIVACY_CONTACT = 'admin@interventionalpulm.com'

const contactLink = (
  <a className="text-primary underline hover:text-primary/80" href={`mailto:${PRIVACY_CONTACT}`}>
    {PRIVACY_CONTACT}
  </a>
)

const sections = [
  {
    title: 'What we do not do',
    body: 'We do not sell personal information, show advertising or use third-party analytics or advertising trackers.',
  },
  {
    title: 'Browsing without an account',
    body: 'You can read public pages, including the Literature Atlas, without an account. We do not record usage analytics for visitors who are not signed in. Our hosting provider may keep standard server logs, such as IP address and request details, for security and operations. Literature Atlas downloads are counted by connection address, in memory only, to limit bulk copying.',
  },
  {
    title: 'Account information',
    body: 'If you create an account we store your email address, name, professional role, specialty where it applies, institution and institution type, country, training level, years in practice, and the interests and learning goals you choose.',
  },
  {
    title: 'Learning activity',
    body: 'When you are signed in we record which modules you open, how long you are active in them, the sections you complete, and your quiz, assessment and simulator results, so that we can save your progress and understand how the material is used. Course enrollment and video progress are stored the same way, as is content you create, such as preference cards.',
  },
  {
    title: 'Feedback',
    body: 'If you send feedback on a module we store your email address, your comment, the page, any text you selected and any screenshot you attach.',
  },
  {
    title: 'Cookies and browser storage',
    body: 'We use cookies for sign-in sessions, preview access and your language preference, and no advertising cookies. Your browser’s local storage keeps settings such as your theme and some module progress on your own device.',
  },
  {
    title: 'Service providers',
    body: 'Supabase provides authentication, database and file storage, and sends account email such as verification and password reset. Railway hosts the site. Some pages load resources from other services, such as code libraries from jsDelivr and videos through YouTube’s privacy-enhanced embed, and those services receive your connection details when they do.',
  },
  {
    title: 'Keeping and removing your information',
    body: (
      <p>
        We keep account and learning records while your account exists; there is no fixed deletion
        schedule. To see, correct or delete your information, write to {contactLink}. Deleting your
        account removes your profile and learning records. Feedback you sent is kept without the
        link to your account unless you ask us to remove it too.
      </p>
    ),
  },
  {
    title: 'Who this site is for',
    body: 'This site is intended for health professionals and trainees and is not directed to children.',
  },
  {
    title: 'Contact and changes',
    body: (
      <p>
        Questions about this policy can go to {contactLink}. We will update this page when our
        practices change.
      </p>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <section className="container space-y-4">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated November 2, 2026.</p>
          </section>
          <section className="container grid gap-6">
            {sections.map((section) => (
              <Card key={section.title} className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold tracking-tight">
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {typeof section.body === 'string' ? <p>{section.body}</p> : section.body}
                </CardContent>
              </Card>
            ))}
          </section>
        </div>
      }
    </HandoffContent>
  )
}
