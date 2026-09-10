import { NavLink } from 'react-router-dom';

import type { NavigationItem } from '@/content/types';

export function BottomNav({ items }: { items: NavigationItem[] }) {
  const visibleItems = items.filter((item) => !item.hideInBottom);

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {visibleItems.map((item) => (
        <NavLink
          key={item.id}
          aria-disabled={item.locked || undefined}
          className={({ isActive }) =>
            `bottom-nav__link${isActive ? ' bottom-nav__link--active' : ''}${item.locked ? ' bottom-nav__link--locked' : ''}`
          }
          title={item.locked ? item.lockedReason : undefined}
          to={item.path}
        >
          <span className="bottom-nav__icon" aria-hidden="true">
            {item.locked ? '•' : item.icon}
          </span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
