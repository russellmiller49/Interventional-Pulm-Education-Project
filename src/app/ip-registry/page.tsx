import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export default function IpRegistryPage() {
  const baseUrl = process.env.PROC_API_URL?.trim()

  if (!baseUrl) {
    return (
      <section className="container py-16">
        <Card className="mx-auto max-w-2xl border-border/60 bg-card/80 shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl font-semibold">
              IP Registry needs configuration
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              The Procedure Suite endpoint is not configured for this deployment.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Set <span className="font-semibold text-foreground">PROC_API_URL</span> to the base
              URL of the Procedure Suite service (for example,{' '}
              <span className="font-mono text-foreground">
                https://your-proc-suite.up.railway.app
              </span>
              ).
            </p>
            <Button asChild variant="outline">
              <a href="mailto:admin@interventionalpulm.com?subject=PROC_API_URL%20missing">
                Contact the site administrator
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  const target = `${stripTrailingSlash(baseUrl)}/ui/`
  redirect(target)
}
