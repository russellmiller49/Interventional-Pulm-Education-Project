import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { CourseStepGuidance } from '@/components/CourseStepGuidance';
import { welcomeLecture } from '@/content/welcome';
import { LearnerAccessBox } from '@/features/account/LearnerAccessBox';
import { LectureCard } from '@/features/lectures/LectureCard';
import { useCourseAdminSessionActive, useCourseVendorSessionActive } from '@/lib/adminSession';
import { useAuth } from '@/lib/auth';
import { getCourseStepModels } from '@/lib/courseWorkflow';
import { useLearnerProgress } from '@/lib/progress';

export function WelcomePage() {
  const { isSupabaseEnabled, profile } = useAuth();
  const { setLectureState, state } = useLearnerProgress();
  const adminSessionActive = useCourseAdminSessionActive();
  const vendorSessionActive = useCourseVendorSessionActive();
  const previewSessionActive = adminSessionActive || vendorSessionActive;
  const welcomeWatchState = state.lectureWatchStatus[welcomeLecture.id];
  const welcomeComplete = Boolean(welcomeWatchState?.completed);
  const accountComplete = !isSupabaseEnabled || Boolean(profile);
  const canViewWelcomeVideo = previewSessionActive || !isSupabaseEnabled || Boolean(profile);
  const canOpenPretest = canViewWelcomeVideo && welcomeComplete;
  const accessOptions = useMemo(
    () => ({
      accountComplete,
      admin: adminSessionActive,
      preview: vendorSessionActive,
    }),
    [accountComplete, adminSessionActive, vendorSessionActive],
  );
  const courseStepModels = useMemo(() => getCourseStepModels(state, accessOptions), [accessOptions, state]);

  return (
    <div className="page-stack">
      <section className="hero-card welcome-hero">
        <div className="eyebrow">Welcome</div>
        <h2>Start with account access, then the welcome video, then the survey and baseline pre-test.</h2>
        <p>
          The course intro is gated behind learner sign-in. Once it is marked reviewed, the pre-course survey and
          baseline pre-test flow opens in the next tab.
        </p>
        <div className="tag-row">
          <span className="tag">{canViewWelcomeVideo ? 'Account complete' : 'Account required'}</span>
          <span className="tag">{welcomeComplete ? 'Welcome complete' : 'Welcome video next'}</span>
          <span className="tag">{canOpenPretest ? 'Survey unlocked' : 'Survey locked'}</span>
        </div>
      </section>

      <CourseStepGuidance steps={courseStepModels} />

      <section className="section-card welcome-step">
        <div className="welcome-step__heading">
          <span className="welcome-step__number">#1</span>
          <div>
            <div className="eyebrow">Account access</div>
            <h2>Sign up or log in</h2>
            <p>Complete this step before the welcome video is available.</p>
          </div>
        </div>
        <LearnerAccessBox />
      </section>

      <section className="welcome-step" aria-labelledby="welcome-video-heading">
        <div className="welcome-step__heading welcome-step__heading--standalone">
          <span className="welcome-step__number">#2</span>
          <div>
            <div className="eyebrow">Welcome video</div>
            <h2 id="welcome-video-heading">Course intro video</h2>
            <p>
              {canViewWelcomeVideo
                ? 'Watch the intro and mark it reviewed to open the next step.'
                : 'Locked until step #1 is complete.'}
            </p>
          </div>
        </div>
        <LectureCard
          defaultExpanded
          defaultPlayerExpanded={canViewWelcomeVideo}
          lecture={welcomeLecture}
          locked={!canViewWelcomeVideo}
          lockedReason="Sign up or log in in step #1 to watch the welcome video."
          onUpdateWatchState={(lectureId, update) => setLectureState(lectureId, update)}
          readyLabel="Opened"
          watchState={welcomeWatchState}
        />
        <div className="welcome-step__completion">
          <p id="welcome-reviewed-help">
            Click this after watching the welcome video to unlock the pre-course survey and test.
          </p>
          {welcomeComplete ? (
            <div className="feedback-banner feedback-banner--success" role="status">
              <strong>Welcome reviewed.</strong>
              <p>The pre-course survey and test are unlocked.</p>
            </div>
          ) : null}
        </div>
        <div className="button-row button-row--wrap welcome-step__actions">
          {welcomeLecture.resourceUrl && canViewWelcomeVideo ? (
            <a
              className="button"
              href={welcomeLecture.resourceUrl}
              onClick={() =>
                setLectureState(welcomeLecture.id, {
                  opened: true,
                  quizReady: true,
                })
              }
              rel="noreferrer"
              target="_blank"
            >
              {welcomeLecture.resourceLabel ?? 'Open welcome resource'}
            </a>
          ) : null}
          <button
            aria-describedby="welcome-reviewed-help"
            className="button"
            disabled={!canViewWelcomeVideo || welcomeComplete}
            onClick={() =>
              setLectureState(welcomeLecture.id, {
                completed: true,
                opened: true,
                quizReady: true,
                watchedSeconds: Math.max(welcomeWatchState?.watchedSeconds ?? 0, 60),
              })
            }
            type="button"
          >
            {welcomeComplete ? 'Welcome reviewed' : 'I have reviewed the welcome video - unlock next step'}
          </button>
        </div>
      </section>

      <section className={`section-card welcome-step${canOpenPretest ? '' : ' section-card--locked'}`}>
        <div className="welcome-step__heading">
          <span className="welcome-step__number">#3</span>
          <div>
            <div className="eyebrow">Start here</div>
            <h2>Survey and baseline pre-test</h2>
            <p>After the intro video is reviewed, continue to the pre-course survey and baseline pre-test.</p>
          </div>
        </div>
        <div className="button-row button-row--wrap">
          {canOpenPretest ? (
            <Link className="button" to="/pretest">
              Open survey and baseline pre-test
            </Link>
          ) : (
            <button className="button" disabled type="button">
              Open survey and baseline pre-test
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
