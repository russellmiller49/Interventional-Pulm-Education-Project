import type { Metadata } from 'next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Code of Conduct | Interventional Pulmonology Collaborative',
  description:
    'The Interventional Pulmonology Collaborative follows the Contributor Covenant Code of Conduct.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

const sections = [
  {
    title: 'Our pledge',
    body: `We pledge to make participation in the Interventional Pulmonology Collaborative a harassment-free experience for everyone, regardless of age, body size, visible or invisible disability, ethnicity, sex characteristics, gender identity and expression, experience level, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.`,
  },
  {
    title: 'Our standards',
    body: (
      <div className="space-y-4">
        <div>
          <p className="font-semibold text-foreground">We commit to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Demonstrating empathy and kindness toward other people.</li>
            <li>Being respectful of differing opinions, viewpoints, and experiences.</li>
            <li>Giving and gracefully accepting constructive feedback.</li>
            <li>Focusing on what is best for the community.</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-foreground">We do not tolerate:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>The use of sexualized language or imagery.</li>
            <li>Trolling, insulting or derogatory comments, and personal or political attacks.</li>
            <li>Public or private harassment.</li>
            <li>Publishing others&apos; private information without explicit permission.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: 'Scope',
    body: 'This Code of Conduct applies within project spaces and when an individual is officially representing the project in public spaces.',
  },
  {
    title: 'Enforcement',
    body: (
      <div className="space-y-3">
        <p>
          Instances of abusive, harassing, or otherwise unacceptable behaviour may be reported to
          the maintainers at{' '}
          <a
            className="text-primary underline hover:text-primary/80"
            href="mailto:security@interventionalpulm.org"
          >
            security@interventionalpulm.org
          </a>
          . All complaints will be reviewed and investigated promptly and fairly.
        </p>
        <div>
          <p className="font-semibold text-foreground">Enforcement guidelines</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">Correction:</span> private, written
              warning.
            </li>
            <li>
              <span className="font-semibold text-foreground">Warning:</span> public warning that
              requires acknowledgement of behaviour.
            </li>
            <li>
              <span className="font-semibold text-foreground">Temporary ban:</span> removal from
              interaction with the community for a defined period.
            </li>
            <li>
              <span className="font-semibold text-foreground">Permanent ban:</span> removal for
              repeated or severe violations.
            </li>
          </ol>
        </div>
      </div>
    ),
  },
  {
    title: 'Attribution',
    body: (
      <p>
        This Code of Conduct is adapted from the{' '}
        <a
          href="https://www.contributor-covenant.org"
          target="_blank"
          rel="noreferrer"
          className="text-primary underline hover:text-primary/80"
        >
          Contributor Covenant
        </a>
        , version 2.1.
      </p>
    ),
  },
]

export default function CodeOfConductPage() {
  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <section className="container space-y-4">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Code of Conduct</h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              The Interventional Pulmonology Collaborative follows the Contributor Covenant to keep
              this community welcoming. Please review the expectations below before contributing or
              joining discussions.
            </p>
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
