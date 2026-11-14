import type { Metadata } from 'next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Terms of Use',
  description:
    'Terms of use for Interventional Pulmonology Education: educational use, non-affiliation, factual indexing, fair use and rights holder requests.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

const RIGHTS_CONTACT = 'admin@interventionalpulm.com'

const sections = [
  {
    title: 'Educational and non-clinical disclaimer',
    body: 'This site and the Literature Atlas are for non-commercial educational use only. Nothing here constitutes medical advice or clinical guidance, and it does not replace clinical judgment, institutional policy or the primary publications.',
  },
  {
    title: 'Institutional non-affiliation',
    body: 'Interventional Pulmonology Education is an independent, volunteer-driven open educational project. Its content does not represent the official policy or position of the Department of the Navy, the Department of Defense, the U.S. Government, or any affiliated university or medical center.',
  },
  {
    title: 'Factual indexing, fair use and takedown policy',
    body: (
      <div className="space-y-4">
        <div>
          <p className="font-semibold text-foreground">Factual indexing and fair use</p>
          <p className="mt-1">
            The Literature Atlas indexes bibliographic metadata and non-substitutive factual study
            parameters, such as study design, sample size and statistical outcomes. Its study briefs
            are machine-generated into a structured factual schema and compiled for non-commercial
            educational scholarship under 17 U.S.C. § 107 (fair use).
          </p>
        </div>
        <div>
          <p className="font-semibold text-foreground">No full-text hosting</p>
          <p className="mt-1">
            The Literature Atlas hosts no proprietary full-text manuscripts or figures. Each entry
            links directly to the publisher&apos;s Version of Record via DOI, or to PubMed where no
            DOI is available.
          </p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Rights holder requests</p>
          <p className="mt-1">
            Publishers and copyright holders may request immediate review or removal of any indexed
            entry by writing to{' '}
            <a
              className="text-primary underline hover:text-primary/80"
              href={`mailto:${RIGHTS_CONTACT}`}
            >
              {RIGHTS_CONTACT}
            </a>{' '}
            with the DOI or PMID of the entry and the nature of the concern. We handle every request
            in good faith, and an entry may be withdrawn while its review is under way.
          </p>
        </div>
      </div>
    ),
  },
]

export default function TermsPage() {
  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <section className="container space-y-4">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Terms of Use</h1>
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
