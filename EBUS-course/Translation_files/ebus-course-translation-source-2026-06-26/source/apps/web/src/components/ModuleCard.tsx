import { Link } from 'react-router-dom';

import type { AppModuleCard } from '@/content/types';

export function ModuleCard({
  module,
  locked = false,
  lockedPath = '/pretest',
  lockedReason,
}: {
  module: AppModuleCard;
  locked?: boolean;
  lockedPath?: string;
  lockedReason?: string | null;
}) {
  return (
    <Link className={`module-card${locked ? ' module-card--locked' : ''}`} to={locked ? lockedPath : module.path}>
      <div className="module-card__icon" style={{ color: module.accent }}>
        {module.icon}
      </div>
      <div className="module-card__body">
        <h3>{module.title}</h3>
        <p>{module.description}</p>
        {lockedReason ? <span className="module-card__status">{lockedReason}</span> : null}
      </div>
      <span className="module-card__arrow" aria-hidden="true">
        {locked ? '🔒' : '→'}
      </span>
    </Link>
  );
}
