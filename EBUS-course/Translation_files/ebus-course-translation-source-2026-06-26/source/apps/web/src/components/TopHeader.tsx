import { Link, useLocation } from 'react-router-dom';

import { courseInfo } from '@/content/course';
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
          <div className="eyebrow">{publicMode ? 'Open access module' : 'SoCal EBUS 2026'}</div>
          <h1 className="top-header__title">{publicMode?.title ?? 'Fellow Prep'}</h1>
          <p className="top-header__subtitle">{publicMode?.subtitle ?? courseInfo.hostLine}</p>
        </div>
      </div>
      <div className="top-header__meta">
        {publicMode ? (
          <>
            <span>Public learning asset</span>
            <span>No lecture, pretest, or login lockout</span>
            <div className="top-header__actions">
              <button className="button button--ghost top-header__action" onClick={toggleTheme} type="button">
                {effectiveTheme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
            </div>
          </>
        ) : (
          <>
            <span>{courseInfo.dateLabel}</span>
            <span>{courseInfo.venueName}</span>
            <span>{sessionLabel}</span>
            {isSupabaseEnabled || adminSessionActive || vendorSessionActive ? (
              <>
                <span>{vendorSessionActive ? 'Sponsor preview' : profile?.fullName || user?.email || profile?.email || 'Signed out'}</span>
                <div className="top-header__actions">
                  <button className="button button--ghost top-header__action" onClick={toggleTheme} type="button">
                    {effectiveTheme === 'dark' ? 'Light mode' : 'Dark mode'}
                  </button>
                  {isSupabaseEnabled && !user ? (
                    <Link className="button button--ghost top-header__action" to={learnerSignInPath}>
                      Sign in
                    </Link>
                  ) : null}
                  <Link className="button button--ghost top-header__action" to="/auth?mode=support">
                    Help / Feedback
                  </Link>
                  {!adminSessionActive ? (
                    vendorSessionActive ? (
                      <button className="button button--ghost top-header__action" onClick={() => clearCourseVendorPasscode()} type="button">
                        End preview
                      </button>
                    ) : (
                      <Link className="button button--ghost top-header__action" to="/auth?mode=vendor">
                        Vendor Login
                      </Link>
                    )
                  ) : null}
                  <Link className="button button--ghost top-header__action" to="/admin">
                    {adminSessionActive ? 'Dashboard' : 'Admin'}
                  </Link>
                  {adminSessionActive ? (
                    <button className="button button--ghost top-header__action" onClick={() => clearCourseAdminPasscode()} type="button">
                      Log out admin
                    </button>
                  ) : null}
                  {user ? (
                    <button className="button button--ghost top-header__action" onClick={() => void signOut()} type="button">
                      Sign out
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <span>Local mode</span>
                <div className="top-header__actions">
                  <button className="button button--ghost top-header__action" onClick={toggleTheme} type="button">
                    {effectiveTheme === 'dark' ? 'Light mode' : 'Dark mode'}
                  </button>
                  <Link className="button button--ghost top-header__action" to="/auth?mode=support">
                    Help / Feedback
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
