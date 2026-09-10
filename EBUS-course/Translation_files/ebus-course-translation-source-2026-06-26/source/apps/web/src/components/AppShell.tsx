import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { BottomNav } from '@/components/BottomNav';
import { TopHeader } from '@/components/TopHeader';
import type { NavigationItem } from '@/content/types';

export function AppShell({
  children,
  navItems,
  publicMode,
}: {
  children: ReactNode;
  navItems: NavigationItem[];
  publicMode?: {
    subtitle: string;
    title: string;
  };
}) {
  return (
    <div className="app-shell">
      <div className="app-shell__frame">
        <TopHeader publicMode={publicMode} />
        <nav className="top-nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              aria-disabled={item.locked || undefined}
              className={({ isActive }) =>
                `top-nav__link${isActive ? ' top-nav__link--active' : ''}${item.locked ? ' top-nav__link--locked' : ''}`
              }
              title={item.locked ? item.lockedReason : undefined}
              to={item.path}
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
