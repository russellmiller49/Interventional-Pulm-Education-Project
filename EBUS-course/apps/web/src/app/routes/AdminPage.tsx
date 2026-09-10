import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  approveLearner,
  buildAdminProgressSummary,
  fetchAdminLearnerOverview,
  getLearnerAverageProgress,
  isLearnerPostCourseComplete,
  type AdminAnswerDetail,
  type AdminLearnerOverview,
  type AdminSurveyResult,
} from '@/lib/admin';
import {
  clearCourseAdminPasscode,
  getStoredCourseAdminPasscode,
  storeCourseAdminPasscode,
  validateCourseAdminPasscode,
} from '@/lib/access';
import { isSupabaseConfigured } from '@/lib/supabase';

type AdminFilter = 'pending' | 'approved' | 'all';

const moduleOrder = ['pretest', 'lectures', 'knobology', 'stations', 'tnm-staging', 'simulator'];
const moduleLabels: Record<string, string> = {
  pretest: 'Pretest',
  lectures: 'Lectures',
  knobology: 'Knobology',
  stations: 'Stations',
  'tnm-staging': 'TNM-9',
  simulator: 'Simulator',
};

function formatDate(value: string | null) {
  if (!value) {
    return 'Not recorded';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatFellowshipYear(value: string | null) {
  if (value === 'first') {
    return 'First year';
  }

  if (value === 'second') {
    return 'Second year';
  }

  if (value === 'third') {
    return 'Third year';
  }

  return 'Not provided';
}

function getProgressByModule(learner: AdminLearnerOverview) {
  return new Map(learner.moduleProgress.map((module) => [module.moduleId, module]));
}

function formatAnswerLabels(labels: string[]) {
  return labels.length > 0 ? labels.join(' | ') : 'Not answered';
}

function getCorrectAnswerCount(answers: AdminAnswerDetail[]) {
  return answers.filter((answer) => answer.isCorrect).length;
}

function getPostTestScoreLabel(learner: Pick<AdminLearnerOverview, 'postTestAnswers' | 'postTestSubmittedAt'>) {
  if (learner.postTestAnswers.length > 0) {
    const correctCount = getCorrectAnswerCount(learner.postTestAnswers);
    const percent = Math.round((correctCount / learner.postTestAnswers.length) * 100);

    return `${percent}% (${correctCount}/${learner.postTestAnswers.length})`;
  }

  return learner.postTestSubmittedAt ? 'Submitted' : 'Not submitted';
}

function AdminAssessmentAnswers({
  answers,
  emptyLabel,
  title,
}: {
  answers: AdminAnswerDetail[];
  emptyLabel: string;
  title: string;
}) {
  if (answers.length === 0) {
    return (
      <div className="admin-answer-panel">
        <strong>{title}</strong>
        <p>{emptyLabel}</p>
      </div>
    );
  }

  return (
    <details className="admin-answer-panel">
      <summary>
        <strong>{title}</strong>
        <span>{getCorrectAnswerCount(answers)}/{answers.length} correct</span>
      </summary>
      <div className="admin-answer-list">
        {answers.map((answer, index) => (
          <article
            key={answer.questionId}
            className={`admin-answer-row${answer.isCorrect ? ' admin-answer-row--correct' : ' admin-answer-row--incorrect'}`}
          >
            <div>
              <span className="admin-answer-row__index">Q{index + 1}</span>
              <p>{answer.prompt}</p>
            </div>
            <dl>
              <div>
                <dt>Selected</dt>
                <dd>{formatAnswerLabels(answer.selectedLabels)}</dd>
              </div>
              <div>
                <dt>Correct</dt>
                <dd>{formatAnswerLabels(answer.correctLabels)}</dd>
              </div>
              <div>
                <dt>Result</dt>
                <dd>{answer.isCorrect ? 'Correct' : 'Incorrect'}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </details>
  );
}

function AdminSurveyResponses({ result, title }: { result: AdminSurveyResult; title: string }) {
  if (!result.submittedAt && result.responses.length === 0) {
    return (
      <div className="admin-answer-panel">
        <strong>{title}</strong>
        <p>No synced survey response yet.</p>
      </div>
    );
  }

  return (
    <details className="admin-answer-panel">
      <summary>
        <strong>{title}</strong>
        <span>{formatDate(result.submittedAt)}</span>
      </summary>
      <div className="admin-answer-list">
        {result.responses.map((response) => (
          <article key={response.questionId} className="admin-survey-row">
            <p>{response.prompt}</p>
            <strong>{response.response}</strong>
          </article>
        ))}
      </div>
    </details>
  );
}

export function AdminPage() {
  const [adminPasscode, setAdminPasscode] = useState(getStoredCourseAdminPasscode);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [learners, setLearners] = useState<AdminLearnerOverview[]>([]);
  const [filter, setFilter] = useState<AdminFilter>('pending');
  const [isLoading, setIsLoading] = useState(false);
  const [approvingLearnerId, setApprovingLearnerId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSupabaseEnabled = isSupabaseConfigured();

  const loadOverview = useCallback(async (passcode: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const nextLearners = await fetchAdminLearnerOverview(passcode);
      setLearners(nextLearners);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the admin dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminPasscode || !isSupabaseEnabled) {
      return;
    }

    void loadOverview(adminPasscode);
  }, [adminPasscode, isSupabaseEnabled, loadOverview]);

  const summary = useMemo(() => buildAdminProgressSummary(learners), [learners]);
  const filteredLearners = useMemo(() => {
    if (filter === 'all') {
      return learners;
    }

    return learners.filter((learner) => learner.approvalStatus === filter);
  }, [filter, learners]);

  function handleAdminLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextPasscode = passcodeInput.trim();

    if (!validateCourseAdminPasscode(nextPasscode)) {
      setError('Enter the course leadership password.');
      return;
    }

    storeCourseAdminPasscode(nextPasscode);
    setAdminPasscode(nextPasscode);
    setPasscodeInput('');
    setMessage('Leadership dashboard unlocked for this browser session.');
    setError(null);
  }

  function handleAdminLogout() {
    clearCourseAdminPasscode();
    setAdminPasscode('');
    setLearners([]);
    setMessage('Admin session ended.');
    setError(null);
  }

  async function handleApproveLearner(learner: AdminLearnerOverview) {
    setApprovingLearnerId(learner.id);
    setError(null);
    setMessage(null);

    try {
      await approveLearner(adminPasscode, learner.id);
      setMessage(`${learner.fullName ?? learner.email ?? 'Learner'} approved.`);
      await loadOverview(adminPasscode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to approve this learner.');
    } finally {
      setApprovingLearnerId(null);
    }
  }

  if (!isSupabaseEnabled) {
    return (
      <div className="page-stack">
        <section className="section-card">
          <div className="eyebrow">Course leadership</div>
          <h2>Admin progress review needs Supabase to be configured.</h2>
          <p>
            Add the Supabase URL and anon key, then apply `supabase/schema.sql` so the dashboard can read learner
            progress and approve pending signups.
          </p>
        </section>
      </div>
    );
  }

  if (!adminPasscode) {
    return (
      <div className="page-stack">
        <section className="hero-card auth-card">
          <div className="eyebrow">Course leadership</div>
          <h2>Open the admin dashboard</h2>
          <p>Use the shared course leadership password to review learner information, progress, and pending approvals.</p>
          {message ? <p className="auth-card__message">{message}</p> : null}
          {error ? <p className="auth-card__error">{error}</p> : null}
          <form className="auth-form" onSubmit={handleAdminLogin}>
            <label className="field">
              <span>Leadership password</span>
              <input
                autoComplete="current-password"
                onChange={(event) => setPasscodeInput(event.target.value)}
                required
                type="password"
                value={passcodeInput}
              />
            </label>
            <div className="button-row button-row--wrap">
              <button className="button" type="submit">
                Unlock dashboard
              </button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack admin-dashboard">
      <section className="admin-dashboard__header">
        <div>
          <div className="eyebrow">Course leadership</div>
          <h2>Admin dashboard</h2>
          <p>Review learner signup status, training profile details, and synced progress snapshots.</p>
        </div>
        <div className="button-row button-row--wrap">
          <button className="button button--ghost" disabled={isLoading} onClick={() => void loadOverview(adminPasscode)} type="button">
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="button button--ghost" onClick={handleAdminLogout} type="button">
            Log out admin
          </button>
        </div>
      </section>

      <section className="admin-summary-grid" aria-label="Learner summary">
        <article className="admin-summary-card">
          <span>Total learners</span>
          <strong>{summary.totalLearners}</strong>
        </article>
        <article className="admin-summary-card admin-summary-card--pending">
          <span>Pending approval</span>
          <strong>{summary.pendingCount}</strong>
        </article>
        <article className="admin-summary-card">
          <span>Approved</span>
          <strong>{summary.approvedCount}</strong>
        </article>
        <article className="admin-summary-card">
          <span>Average progress</span>
          <strong>{summary.averageProgressPercent}%</strong>
        </article>
        <article className="admin-summary-card admin-summary-card--post-course-complete">
          <span>Ready for cert + feedback</span>
          <strong>{summary.postCourseCompleteCount}</strong>
        </article>
      </section>

      <section className="admin-toolbar" aria-label="Learner filters">
        {(['pending', 'approved', 'all'] satisfies AdminFilter[]).map((nextFilter) => (
          <button
            key={nextFilter}
            className={`admin-filter-button${filter === nextFilter ? ' admin-filter-button--active' : ''}`}
            onClick={() => setFilter(nextFilter)}
            type="button"
          >
            {nextFilter === 'all' ? 'All learners' : nextFilter === 'pending' ? 'Pending' : 'Approved'}
          </button>
        ))}
      </section>

      {message ? <p className="auth-card__message">{message}</p> : null}
      {error ? <p className="auth-card__error">{error}</p> : null}

      <section className="admin-learner-list" aria-live="polite">
        {isLoading && learners.length === 0 ? (
          <div className="admin-empty-state">Loading learner roster...</div>
        ) : filteredLearners.length === 0 ? (
          <div className="admin-empty-state">No learners match this filter.</div>
        ) : (
          filteredLearners.map((learner) => {
            const moduleProgressById = getProgressByModule(learner);
            const averageProgress = getLearnerAverageProgress(learner);
            const postCourseComplete = isLearnerPostCourseComplete(learner);

            return (
              <article
                key={learner.id}
                className={`admin-learner-card admin-learner-card--${learner.approvalStatus}${
                  postCourseComplete ? ' admin-learner-card--post-course-complete' : ''
                }`}
              >
                <header className="admin-learner-card__header">
                  <div>
                    <div className="eyebrow">
                      {postCourseComplete
                        ? 'Post-course complete'
                        : learner.approvalStatus === 'approved'
                          ? 'Approved learner'
                          : 'Awaiting approval'}
                    </div>
                    <h3 className={postCourseComplete ? 'admin-learner-card__name--post-course-complete' : undefined}>
                      {learner.fullName ?? learner.email ?? 'Unnamed learner'}
                    </h3>
                    <p>{learner.institution ?? 'Institution not provided'}</p>
                  </div>
                  <div className="admin-learner-card__actions">
                    {postCourseComplete ? (
                      <span className="admin-status admin-status--post-course-complete">
                        Ready for certificate + feedback
                      </span>
                    ) : null}
                    <span className={`admin-status admin-status--${learner.approvalStatus}`}>
                      {learner.approvalStatus}
                    </span>
                    {learner.approvalStatus === 'pending' ? (
                      <button
                        className="button"
                        disabled={approvingLearnerId === learner.id}
                        onClick={() => void handleApproveLearner(learner)}
                        type="button"
                      >
                        {approvingLearnerId === learner.id ? 'Approving...' : 'Approve'}
                      </button>
                    ) : null}
                  </div>
                </header>

                <dl className="admin-info-grid">
                  <div>
                    <dt>Login email</dt>
                    <dd>{learner.email ?? 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt>Institutional email</dt>
                    <dd>{learner.institutionalEmail ?? 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt>Training year</dt>
                    <dd>{formatFellowshipYear(learner.fellowshipYear)}</dd>
                  </div>
                  <div>
                    <dt>Degree</dt>
                    <dd>{learner.degree ?? 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt>EBUS count</dt>
                    <dd>{learner.ebusCount ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Flexible bronch count</dt>
                    <dd>{learner.flexibleBronchoscopyCount ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd>{learner.ebusConfidence ?? 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDate(learner.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Last sign in</dt>
                    <dd>{formatDate(learner.lastSignInAt)}</dd>
                  </div>
                </dl>

                <div className="admin-progress-summary">
                  <div>
                    <span>Overall progress</span>
                    <strong>{averageProgress}%</strong>
                  </div>
                  <div>
                    <span>Pretest</span>
                    <strong>{learner.pretestPercent === null ? 'Not submitted' : `${learner.pretestPercent}%`}</strong>
                  </div>
                  <div>
                    <span>Lectures completed</span>
                    <strong>{learner.lectureSummary.completedCount}</strong>
                  </div>
                  <div>
                    <span>Video watch time</span>
                    <strong>{formatDuration(learner.lectureSummary.totalWatchedSeconds)}</strong>
                  </div>
                  <div>
                    <span>Page-open time</span>
                    <strong>{formatDuration(learner.totalTimeSpentSeconds)}</strong>
                  </div>
                  <div>
                    <span>Post-test</span>
                    <strong>{getPostTestScoreLabel(learner)}</strong>
                  </div>
                  <div className={postCourseComplete ? 'admin-progress-summary__complete' : undefined}>
                    <span>Certificate status</span>
                    <strong>{postCourseComplete ? 'Ready to email' : 'Pending'}</strong>
                  </div>
                </div>

                <div className="admin-answer-stack">
                  <AdminSurveyResponses result={learner.preCourseSurvey} title="Pre-course survey" />
                  <AdminAssessmentAnswers
                    answers={learner.pretestAnswers}
                    emptyLabel="No synced pretest submission answers yet."
                    title="Pretest answers"
                  />
                  <AdminAssessmentAnswers
                    answers={learner.postTestAnswers}
                    emptyLabel="No synced post-test submission answers yet."
                    title="Post-test answers"
                  />
                  <AdminSurveyResponses result={learner.postCourseSurvey} title="Post-course survey" />
                </div>

                <div className="admin-module-progress" aria-label={`${learner.fullName ?? 'Learner'} module progress`}>
                  {moduleOrder.map((moduleId) => {
                    const moduleProgress = moduleProgressById.get(moduleId);
                    const percentComplete = moduleProgress?.percentComplete ?? 0;

                    return (
                      <div key={moduleId} className="admin-module-progress__row">
                        <span>{moduleLabels[moduleId]}</span>
                        <span aria-hidden="true" className="progress-meter">
                          <span className="progress-meter__bar" style={{ width: `${percentComplete}%` }} />
                        </span>
                        <strong>{percentComplete}%</strong>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
