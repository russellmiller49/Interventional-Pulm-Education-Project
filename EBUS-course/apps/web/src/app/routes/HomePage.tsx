import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { buildHomeProgressModel } from '@/app/routes/home/progress';
import { CourseStepGuidance } from '@/components/CourseStepGuidance';
import { DeviceRecommendationNotice } from '@/components/DeviceRecommendationNotice';
import { ModuleCard } from '@/components/ModuleCard';
import { useCourseShellText, useLocalizedCourseInfo, useLocalizedHomeModuleCards } from '@/i18n/courseShell';
import { useLocalizedPath } from '@/i18n/locale';
import { canAccessRoute, getLockedRoutePath, getRouteLockReason, isPretestComplete } from '@/lib/access';
import { useCourseAdminSessionActive, useCourseVendorSessionActive } from '@/lib/adminSession';
import { useAuth } from '@/lib/auth';
import { useCourseNow } from '@/lib/courseClock';
import { getCourseStepModels, getNextCourseStep, isCoursePretestUnlocked } from '@/lib/courseWorkflow';
import { useLearnerProgress } from '@/lib/progress';

function ProgressMeter({ percent }: { percent: number }) {
  return (
    <span aria-hidden="true" className="progress-meter">
      <span className="progress-meter__bar" style={{ width: `${percent}%` }} />
    </span>
  );
}

export function HomePage() {
  const courseInfo = useLocalizedCourseInfo();
  const homeModuleCards = useLocalizedHomeModuleCards();
  const localizePath = useLocalizedPath();
  const t = useCourseShellText();
  const { state } = useLearnerProgress();
  const { isSupabaseEnabled, profile } = useAuth();
  const adminSessionActive = useCourseAdminSessionActive();
  const vendorSessionActive = useCourseVendorSessionActive();
  const previewSessionActive = adminSessionActive || vendorSessionActive;
  const nowMs = useCourseNow();
  const accountComplete = !isSupabaseEnabled || Boolean(profile);
  const accessOptions = useMemo(
    () => ({
      accountComplete,
      admin: adminSessionActive,
      nowMs,
      preview: vendorSessionActive,
    }),
    [accountComplete, adminSessionActive, nowMs, vendorSessionActive],
  );
  const { learningSteps, resumeModule } = buildHomeProgressModel(state);
  const pretestReady = previewSessionActive || isPretestComplete(state);
  const pretestUnlocked = previewSessionActive || isCoursePretestUnlocked(state, accessOptions);
  const nextCourseStep = getNextCourseStep(state, accessOptions);
  const courseStepModels = useMemo(() => getCourseStepModels(state, accessOptions), [accessOptions, state]);
  const reviewedLectures = Object.values(state.lectureWatchStatus).filter((lecture) => lecture.completed).length;
  const lastAssessment = state.quizScoreHistory[0];
  const pretestTag =
    state.pretest.submittedAt && state.pretest.totalQuestions > 0
      ? `Pre-test ${Math.round(((state.pretest.score ?? 0) / state.pretest.totalQuestions) * 100)}%`
      : t('Pre-test not submitted');
  const progressHighlights = [
    pretestTag,
    `${state.bookmarkedStations.length} ${t('bookmarked stations')}`,
    `${reviewedLectures} ${t('reviewed lectures')}`,
    lastAssessment ? `${t('Latest assessment')} ${lastAssessment.percent}%` : t('No assessment saved yet'),
  ];
  const resumePath = nextCourseStep?.path ?? resumeModule?.path ?? '/lectures';
  const resumeLabel = nextCourseStep
    ? `${t('Continue:')} ${t(nextCourseStep.title)}`
    : resumeModule
      ? `${t('Resume')} ${t(resumeModule.title)}`
      : t('Start the prep path');

  return (
    <div className="page-stack page-stack--course-overview">
      <section className="course-hero">
        <div className="course-hero__inner">
          <div className="course-hero__content">
            <div className="course-hero__brand">
              <img
                alt={courseInfo.visuals.logo.alt}
                className="course-hero__logo"
                loading="eager"
                src={courseInfo.visuals.logo.src}
              />
              <div className="course-hero__brand-copy">
                <div className="eyebrow">{t('Hosted by')}</div>
                <p className="course-hero__brand-line">{courseInfo.hostLine}</p>
                <p className="course-hero__department">{courseInfo.hostDepartment}</p>
              </div>
            </div>

            <div className="eyebrow">{t('10th Annual Southwest regional course')}</div>
            <h2 className="course-hero__title">{courseInfo.courseTitle}</h2>
            <p className="course-hero__lead">{courseInfo.overview}</p>

            <div className="course-hero__meta-grid">
              <article className="course-meta-card">
                <span>{t('When')}</span>
                <strong>{courseInfo.dateLabel}</strong>
                <p>{courseInfo.timeLabel}</p>
              </article>
              <article className="course-meta-card">
                <span>{t('Where')}</span>
                <strong>{courseInfo.venueName}</strong>
                <p>{courseInfo.venueDetail}</p>
              </article>
              <article className="course-meta-card">
                <span>{t('Who')}</span>
                <strong>1st-year fellows</strong>
                <p>Pulmonary and PCCM focus</p>
              </article>
            </div>

            <div className="button-row button-row--wrap">
              <Link className="button" to={localizePath(resumePath)}>
                {resumeLabel}
              </Link>
              <Link className="button button--ghost" to={localizePath('/lectures')}>
                {t('Browse prep lectures')}
              </Link>
            </div>

            <div className="course-fact-grid">
              {courseInfo.quickFacts.map((fact) => (
                <article key={fact.label} className="course-fact">
                  <strong>{fact.value}</strong>
                  <span>{fact.label}</span>
                  {fact.detail ? <p>{fact.detail}</p> : null}
                </article>
              ))}
            </div>
          </div>

          <div className="course-hero__media">
            <figure className="course-hero__media-primary">
              <img alt={courseInfo.visuals.hero.alt} loading="eager" src={courseInfo.visuals.hero.src} />
              <figcaption>{courseInfo.visuals.hero.caption}</figcaption>
            </figure>

            <div className="course-hero__media-stack">
              <figure className="course-hero__media-secondary">
                <img alt={courseInfo.visuals.inset.alt} loading="lazy" src={courseInfo.visuals.inset.src} />
                <figcaption>{courseInfo.visuals.inset.caption}</figcaption>
              </figure>

              <aside className="course-hero__callout">
                <div className="eyebrow">{t('Why fellows come here')}</div>
                <h3>Early, structured EBUS training with real faculty access.</h3>
                <ul className="course-checklist">
                  {courseInfo.positioningHighlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <DeviceRecommendationNotice />

      <CourseStepGuidance steps={courseStepModels} />

      <section aria-label="AABIP endorsement" className="course-endorsement">
        <span aria-hidden="true" className="course-endorsement__seal">
          <img alt="" loading="eager" src={courseInfo.endorsement.image.src} />
        </span>
        <p>{courseInfo.endorsement.text}</p>
      </section>

      {!pretestReady ? (
        <section className="section-card section-card--notice">
          <div className="section-card__heading">
            <div>
              <div className="eyebrow">{t('Course unlock')}</div>
              <h2>
                {pretestUnlocked
                  ? t('Finish the survey and baseline pre-test flow before Lecture 1 opens.')
                  : accountComplete
                    ? t('Start with the welcome video to unlock the baseline pre-test.')
                    : t('Sign up or log in, then watch the welcome video to unlock the baseline pre-test.')}
              </h2>
            </div>
          </div>
          <p>
            The course now follows the sequence used by the online curriculum: welcome video, pre-test, practice
            modules, in-lecture quizzes, final post-test, survey, answers, and certificate.
          </p>
          <div className="button-row button-row--wrap">
            <Link className="button" to={localizePath(pretestUnlocked ? '/pretest' : '/welcome')}>
              {pretestUnlocked ? t('Complete the pre-test') : t('Open welcome video')}
            </Link>
          </div>
        </section>
      ) : null}

      <section className="course-section course-section--split">
        <div className="course-section__lede">
          <div className="eyebrow">{t('Why this course exists')}</div>
          <h2>EBUS training demand has outpaced standardization, so the course starts early and stays practical.</h2>
          <p>{courseInfo.audience}</p>
          <ul className="course-checklist course-checklist--muted">
            {courseInfo.formatHighlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        </div>

        <div className="course-highlight-grid">
          {courseInfo.experienceHighlights.map((highlight) => (
            <article key={highlight.title} className="course-highlight">
              <div className="eyebrow">{t('Course design')}</div>
              <h3>{highlight.title}</h3>
              <p>{highlight.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="course-section course-section--grid">
        <article className="course-panel">
          <div className="eyebrow">{t('Before the live day')}</div>
          <h2>Prep opens weeks ahead so fellows arrive ready for simulation instead of cold-starting on site.</h2>
          <p>{courseInfo.prepWindow}</p>
          <div className="course-topic-list">
            {courseInfo.prepTopics.map((topic) => (
              <div key={topic} className="course-topic">
                {topic}
              </div>
            ))}
          </div>
        </article>

        <article className="course-panel">
          <div className="eyebrow">{t('Live day format')}</div>
          <h2>Teams rotate through tools, anatomy, planning, and execution with protected time for discussion.</h2>
          <div className="course-track-list">
            {courseInfo.liveSessionTracks.map((track) => (
              <article key={track.title} className="course-track">
                <h3>{track.title}</h3>
                <p>{track.detail}</p>
              </article>
            ))}
          </div>
          <a className="button button--ghost" href={courseInfo.facilityUrl} rel="noreferrer" target="_blank">
            {t('View simulation center')}
          </a>
        </article>
      </section>

      <section className="course-section">
        <div className="course-section__heading">
          <div>
            <div className="eyebrow">{t('Live day agenda')}</div>
            <h2>One sample team schedule shows a full day of motion, stations, and coached repetition.</h2>
          </div>
        </div>
        <div className="course-agenda">
          {courseInfo.liveDayAgenda.map((item) => (
            <article key={`${item.time}-${item.title}`} className="course-agenda__item">
              <span>{item.time}</span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="course-section course-section--community">
        <div className="course-section__heading course-section__heading--spread">
          <div>
            <div className="eyebrow">{t('Faculty and community')}</div>
            <h2>Small groups make the course feel regional, connected, and heavily coached.</h2>
            <p>{courseInfo.facultySummary}</p>
          </div>

          <div className="course-directors">
            <span>{t('Course directors')}</span>
            {courseInfo.courseDirectors.map((director) => (
              <strong key={director}>{director}</strong>
            ))}
          </div>
        </div>

        <div className="course-institution-list">
          {courseInfo.facultyInstitutions.map((institution) => (
            <span key={institution} className="tag">
              {institution}
            </span>
          ))}
        </div>

        <div className="course-gallery">
          {courseInfo.visuals.gallery.map((asset) => (
            <figure key={asset.src} className="course-gallery__item">
              <img alt={asset.alt} loading="lazy" src={asset.src} />
              {asset.caption ? <figcaption>{asset.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      </section>

      <section className="course-section course-section--grid">
        <article className="course-panel">
          <div className="eyebrow">{t('Location')}</div>
          <h2>{courseInfo.venueName}</h2>
          <p>{courseInfo.venueDetail}</p>
          <address className="course-address">
            {courseInfo.addressLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </address>
          <p>{courseInfo.parkingNote}</p>
        </article>

        <article className="course-panel">
          <div className="eyebrow">{t('Driving directions')}</div>
          <h2>Regional routes are called out directly on the flyer for arriving fellows.</h2>
          <div className="course-route-list">
            {courseInfo.travelDirections.map((route) => (
              <article key={route.origin} className="course-route">
                <h3>{route.origin}</h3>
                <p>{route.detail}</p>
              </article>
            ))}
          </div>
          <p>{courseInfo.travelNote}</p>
        </article>
      </section>

      <section className="course-section course-section--workspace" id="digital-prep">
        <div className="course-section__heading">
          <div>
            <div className="eyebrow">{t('Digital prep workspace')}</div>
            <h2>The app mirrors the course flow so fellows can study in sequence before the live event.</h2>
            <p>
              Use the pre-course test, lecture module, knobology labs, station tools, and case review to arrive ready
              for the sim day.
            </p>
          </div>
        </div>

        <div className="course-workspace">
          <div className="course-workspace__sidebar">
            {resumeModule ? (
              <Link className="course-resume-card" to={localizePath(resumeModule.path)}>
                <div className="course-resume-card__body">
                  <div className="eyebrow">{t('Pick up where you left off')}</div>
                  <strong>{t(resumeModule.title)}</strong>
                  <ProgressMeter percent={resumeModule.percent} />
                </div>
                <span className="button">{t('Resume')}</span>
              </Link>
            ) : null}

            <div className="course-step-list">
              {learningSteps.map((step, index) => (
                <Link
                  key={step.id}
                  className={`course-step${canAccessRoute(step.id, state, accessOptions) ? '' : ' course-step--locked'}`}
                  to={localizePath(getLockedRoutePath(step.id, step.path, state, accessOptions))}
                >
                  <span className={`course-step__marker${step.percent >= 100 ? ' course-step__marker--done' : ''}`}>
                    {step.percent >= 100 ? '✓' : index + 1}
                  </span>
                  <div className="course-step__body">
                    <strong>{t(step.title)}</strong>
                    <ProgressMeter percent={step.percent} />
                    {!canAccessRoute(step.id, state, accessOptions) ? (
                      <p>{t(getRouteLockReason(step.id, state, accessOptions) ?? '')}</p>
                    ) : null}
                  </div>
                  <span className="course-step__percent">{step.percent}%</span>
                </Link>
              ))}
            </div>

            <div className="tag-row">
              {progressHighlights.map((highlight) => (
                <span key={highlight} className="tag">
                  {highlight}
                </span>
              ))}
            </div>
          </div>

          <div className="course-workspace__modules">
            <div className="module-grid">
              {homeModuleCards.map((module) => (
                <ModuleCard
                  key={module.id}
                  locked={!canAccessRoute(module.id, state, accessOptions)}
                  lockedPath={getLockedRoutePath(module.id, module.path, state, accessOptions)}
                  lockedReason={getRouteLockReason(module.id, state, accessOptions)}
                  module={module}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
