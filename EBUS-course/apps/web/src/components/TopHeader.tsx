import { Link, useLocation } from 'react-router-dom';

import { useCourseShellText, useLocalizedCourseInfo } from '@/i18n/courseShell';
import { useLocalizedPath } from '@/i18n/locale';
import { useCourseAdminSessionActive, useCourseVendorSessionActive } from '@/lib/adminSession';
import { useAuth } from '@/lib/auth';
import { clearCourseAdminPasscode, clearCourseVendorPasscode, isPretestComplete } from '@/lib/access';
import { useLearnerProgress } from '@/lib/progress';
import { useTheme } from '@/lib/theme';

interface TopHeaderProps {
  publicMode?: {
    subtitle: string;
    title: string;
  };
}

export function TopHeader({ publicMode }: TopHeaderProps) {
  const location = useLocation();
  const courseInfo = useLocalizedCourseInfo();
  const localizePath = useLocalizedPath();
  const t = useCourseShellText();
  const { isSupabaseEnabled, profile, signOut, user } = useAuth();
  const { state } = useLearnerProgress();
  const { effectiveTheme, toggleTheme } = useTheme();
  const adminSessionActive = useCourseAdminSessionActive();
  const vendorSessionActive = useCourseVendorSessionActive();
  const pretestReady = isPretestComplete(state);
  const sessionLabel = adminSessionActive
    ? 'Admin access active'
    : vendorSessionActive
      ? 'Sponsor preview active'
      : pretestReady
        ? 'Modules unlocked'
        : 'Pretest unlock required';
  const nextPath = `${location.pathname}${location.search}`;
  const learnerSignInPath = location.pathname.startsWith('/auth') ? '/auth' : `/auth?next=${encodeURIComponent(nextPath)}`;

  return (
    <header className="top-header">
      <div className="top-header__identity">
        <div className="top-header__mark" aria-hidden="true">
          📡
        </div>
        <div>
          <div className="eyebrow">{publicMode ? t('Open access module') : 'SoCal EBUS 2026'}</div>
          <h1 className="top-header__title">{publicMode?.title ?? t('Fellow Prep')}</h1>
          <p className="top-header__subtitle">{publicMode?.subtitle ?? courseInfo.hostLine}</p>
        </div>
      </div>
      <div className="top-header__meta">
        {publicMode ? (
          <>
            <span>{t('Public learning asset')}</span>
            <span>{t('No lecture, pretest, or login lockout')}</span>
            <div className="top-header__actions">
              <button className="button button--ghost top-header__action" onClick={toggleTheme} type="button">
                {effectiveTheme === 'dark' ? t('Light mode') : t('Dark mode')}
              </button>
            </div>
          </>
        ) : (
          <>
            <span>{courseInfo.dateLabel}</span>
            <span>{courseInfo.venueName}</span>
            <span>{t(sessionLabel)}</span>
            {isSupabaseEnabled || adminSessionActive || vendorSessionActive ? (
              <>
                <span>{vendorSessionActive ? t('Sponsor preview') : profile?.fullName || user?.email || profile?.email || t('Signed out')}</span>
                <div className="top-header__actions">
                  <button className="button button--ghost top-header__action" onClick={toggleTheme} type="button">
                    {effectiveTheme === 'dark' ? t('Light mode') : t('Dark mode')}
                  </button>
                  {isSupabaseEnabled && !user ? (
                    <Link className="button button--ghost top-header__action" to={localizePath(learnerSignInPath)}>
                      {t('Sign in')}
                    </Link>
                  ) : null}
                  <Link className="button button--ghost top-header__action" to={localizePath('/auth?mode=support')}>
                    {t('Help / Feedback')}
                  </Link>
                  {!adminSessionActive ? (
                    vendorSessionActive ? (
                      <button className="button button--ghost top-header__action" onClick={() => clearCourseVendorPasscode()} type="button">
                        {t('End preview')}
                      </button>
                    ) : (
                      <Link className="button button--ghost top-header__action" to={localizePath('/auth?mode=vendor')}>
                        {t('Vendor Login')}
                      </Link>
                    )
                  ) : null}
                  <Link className="button button--ghost top-header__action" to={localizePath('/admin')}>
                    {adminSessionActive ? t('Dashboard') : t('Admin')}
                  </Link>
                  {adminSessionActive ? (
                    <button className="button button--ghost top-header__action" onClick={() => clearCourseAdminPasscode()} type="button">
                      {t('Log out admin')}
                    </button>
                  ) : null}
                  {user ? (
                    <button className="button button--ghost top-header__action" onClick={() => void signOut()} type="button">
                      {t('Sign out')}
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <span>{t('Local mode')}</span>
                <div className="top-header__actions">
                  <button className="button button--ghost top-header__action" onClick={toggleTheme} type="button">
                    {effectiveTheme === 'dark' ? t('Light mode') : t('Dark mode')}
                  </button>
                  <Link className="button button--ghost top-header__action" to={localizePath('/auth?mode=support')}>
                    {t('Help / Feedback')}
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </header>
  );
}
