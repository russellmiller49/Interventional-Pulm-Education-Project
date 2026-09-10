import { NavLink } from 'react-router-dom';

import type { NavigationItem } from '@/content/types';
import { useCourseShellText } from '@/i18n/courseShell';
import { useLocalizedPath } from '@/i18n/locale';

export function BottomNav({ items }: { items: NavigationItem[] }) {
  const localizePath = useLocalizedPath();
  const t = useCourseShellText();
  const visibleItems = items.filter((item) => !item.hideInBottom);

  return (
    <nav className="bottom-nav" aria-label={t('Primary')}>
      {visibleItems.map((item) => (
        <NavLink
          key={item.id}
          aria-disabled={item.locked || undefined}
          className={({ isActive }) =>
            `bottom-nav__link${isActive ? ' bottom-nav__link--active' : ''}${item.locked ? ' bottom-nav__link--locked' : ''}`
          }
          title={item.locked ? item.lockedReason : undefined}
          to={localizePath(item.path)}
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
