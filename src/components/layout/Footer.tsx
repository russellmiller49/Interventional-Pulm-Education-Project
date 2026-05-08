import Link from 'next/link'
import type { Route } from 'next'

type InternalFooterHref =
  | '/'
  | '/board-prep'
  | '/fluoroview'
  | '/learn/anatomy'
  | '/resources'
  | '/resources/creative-commons'
  | '/coming-soon'
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
      { label: 'IP Board Prep', href: '/board-prep', route: '/board-prep' },
      {
        label: 'Resources',
        href: '/resources',
        route: '/resources',
      },
      { label: 'Coming Soon', href: '/coming-soon', route: '/coming-soon' },
    ],
  },
  {
    title: 'Learning',
    links: [
      { label: '3D Anatomy Viewer', href: '/learn/anatomy', route: '/learn/anatomy' },
      { label: 'FluoroView', href: '/fluoroview', route: '/fluoroview' },
      { label: 'IP Board Prep', href: '/board-prep', route: '/board-prep' },
      {
        label: 'Resources',
        href: '/resources',
        route: '/resources',
      },
    ],
  },
  {
    title: 'Coming Soon',
    links: [
      { label: 'Tools suite', href: '/coming-soon', route: '/coming-soon' },
      { label: 'DIY Lab guides', href: '/coming-soon', route: '/coming-soon' },
      { label: 'Simulation training', href: '/coming-soon', route: '/coming-soon' },
      { label: 'Community hub', href: '/coming-soon', route: '/coming-soon' },
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
                Interventional Pulmonology Education
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Practical learning tools, printable models, and modern curricula advancing airway
              education around the globe. Built for clinicians, educators, and trainees.
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
              © {new Date().getFullYear()} Interventional Pulmonology Education. Educational use
              only.
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
