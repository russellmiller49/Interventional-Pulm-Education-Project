import { Link } from 'react-router-dom';

import { useLocalizedPath } from '@/i18n/locale';

export function NotFoundPage() {
  const localizePath = useLocalizedPath();

  return (
    <div className="page-stack">
      <section className="section-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Not found</div>
            <h2>This route is not wired in the web scaffold.</h2>
          </div>
        </div>
        <p>Use the primary navigation to return to the main learning routes.</p>
        <Link className="button" to={localizePath('/')}>
          Return home
        </Link>
      </section>
    </div>
  );
}
