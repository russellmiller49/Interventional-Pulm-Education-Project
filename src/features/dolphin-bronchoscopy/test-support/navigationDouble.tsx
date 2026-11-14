import type { AnchorHTMLAttributes, ReactNode } from 'react'

/** `@/i18n/navigation` for component tests: a plain anchor and a router that records pushes. */
export const pushed: unknown[] = []

export const navigationDouble = {
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}${href.query ? `?${new URLSearchParams(href.query).toString()}` : ''}`
    return (
      <a href={resolved} {...props}>
        {children}
      </a>
    )
  },
  useRouter: () => ({ push: (href: unknown) => pushed.push(href), replace: jest.fn() }),
  usePathname: () => '/dolphin-bronchoscopy',
  redirect: jest.fn(),
}
