/**
 * `@/i18n/navigation` for the static foundation-workspace fixture.
 *
 * The real module is built by `createNavigation(routing)` from `next-intl/navigation`, whose `Link`
 * reads the Next app router out of React context. There is no router in a static page, so importing
 * it would throw before anything rendered. Every link the fixture mounts is chrome — the module nav,
 * the track control, the evidence links — and none of them is what the layout package is reviewed
 * for, so they render as anchors that go nowhere.
 *
 * Fixture-only. Nothing in `src/` imports this file.
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react'

export function Link({
  href,
  children,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string | { pathname: string }
  children: ReactNode
}) {
  const resolved = typeof href === 'string' ? href : href.pathname
  return (
    <a
      href={resolved}
      data-preview-inert-link=""
      onClick={(event) => event.preventDefault()}
      {...props}
    >
      {children}
    </a>
  )
}

export function usePathname() {
  return typeof window === 'undefined' ? '/' : window.location.pathname
}

export function useRouter() {
  return {
    push: () => undefined,
    replace: () => undefined,
    back: () => undefined,
    forward: () => undefined,
    refresh: () => undefined,
    prefetch: () => undefined,
  }
}

export function getPathname({ href }: { href: string }) {
  return href
}

export function redirect() {
  return undefined
}
