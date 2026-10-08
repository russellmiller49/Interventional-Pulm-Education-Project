import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { BottomNav } from '@/components/BottomNav';
import { TopHeader } from '@/components/TopHeader';
import type { NavigationItem } from '@/content/types';
import { useCourseShellText } from '@/i18n/courseShell';
import { useLocalizedPath } from '@/i18n/locale';

export function AppShell({
  children,
  navItems,
  siteModule = false,
}: {
  children: ReactNode;
  navItems: NavigationItem[];
  /**
   * The route is an open module shown on the main site. The site supplies the page header,
   * navigation and theme, so the course header, course navigation and framed card are not drawn.
   */
  siteModule?: boolean;
}) {
  const localizePath = useLocalizedPath();
  const t = useCourseShellText();

  if (siteModule) {
    return (
      <div className="app-shell app-shell--site-module">
        <main className="app-shell__content">{children}</main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-shell__frame">
        <TopHeader />
        <nav className="top-nav" aria-label={t('Primary')}>
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              aria-disabled={item.locked || undefined}
              className={({ isActive }) =>
                `top-nav__link${isActive ? ' top-nav__link--active' : ''}${item.locked ? ' top-nav__link--locked' : ''}`
              }
              title={item.locked ? item.lockedReason : undefined}
              to={localizePath(item.path)}
              end={item.path === '/'}
            >
              <span aria-hidden="true">{item.locked ? '•' : item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <main className="app-shell__content">{children}</main>
      </div>
      <BottomNav items={navItems} />
    </div>
  );
}
