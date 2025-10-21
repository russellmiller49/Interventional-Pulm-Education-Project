import Link from 'next/link'
import type { Route } from 'next'

type InternalFooterHref =
  | '/'
  | '/tools'
  | '/make'
  | '/board-prep'
  | '/fluoroview'
  | '/learn/anatomy'
  | '/training'
  | '/community/contributors'
  | '/privacy'
  | '/terms'
  | '/community/code-of-conduct'

type FooterLink =
  | {
      label: string
      href: string
      external: true
      route?: never
    }
  | {
      label: string
      href: string
      external?: false
      route: InternalFooterHref
    }

const columnLinks: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: 'Explore',
    links: [
      { label: 'Home', href: '/', route: '/' },
      { label: 'Tools', href: '/tools', route: '/tools' },
      { label: 'DIY Lab', href: '/make', route: '/make' },
      { label: 'IP Board Prep', href: '/board-prep', route: '/board-prep' },
    ],
  },
  {
    title: 'Learning',
    links: [
      { label: '3D Anatomy Viewer', href: '/learn/anatomy', route: '/learn/anatomy' },
      { label: 'FluoroView', href: '/fluoroview', route: '/fluoroview' },
      { label: 'Training Modules', href: '/training', route: '/training' },
      { label: 'Guides', href: '/tools', route: '/tools' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Contributors', href: '/community/contributors', route: '/community/contributors' },
      { label: 'GitHub', href: 'https://github.com/interventional-pulm', external: true },
      {
        label: 'Discussions',
        href: 'https://github.com/orgs/interventional-pulm/discussions',
        external: true,
      },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container space-y-10 py-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm space-y-4">
            <div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                Interventional Pulmonology Collaborative
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Open source tools, printable models, and modern curricula advancing airway care around
              the globe. Built by clinicians, educators, and engineers.
            </p>
            <div className="text-xs text-muted-foreground">
              Prefer a low motion experience? Enable it in your operating system preferences and
              we&apos;ll match it.
            </div>
          </div>
          <div className="grid flex-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {columnLinks.map((column) => (
              <div key={column.title} className="space-y-3">
                <h3 className="text-sm font-semibold tracking-tight">{column.title}</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.route as Route}
                          className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t pt-6 text-xs text-muted-foreground">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} Interventional Pulmonology Collaborative. Educational
              use only.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href={'/privacy' as Route}
                className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Privacy
              </Link>
              <Link
                href={'/terms' as Route}
                className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Terms
              </Link>
              <Link
                href={'/community/code-of-conduct' as Route}
                className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Code of Conduct
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
