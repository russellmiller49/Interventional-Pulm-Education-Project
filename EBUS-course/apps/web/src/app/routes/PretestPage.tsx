import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { CourseStepGuidance } from '@/components/CourseStepGuidance';
import { type CourseSurveyResponses, isCourseSurveyComplete, preCourseSurveyItems } from '@/content/courseSurveys';
import { getPretestImage, pretestContent } from '@/content/pretest';
import {
  getFirstUnansweredQuestionIndex,
  getNextUnansweredQuestionIndex,
  scorePretest,
} from '@/features/pretest/logic';
import { CourseSurveyForm } from '@/features/surveys/CourseSurveyForm';
import { useLocalizedPath } from '@/i18n/locale';
import { useCourseAdminSessionActive, useCourseVendorSessionActive } from '@/lib/adminSession';
import { useAuth } from '@/lib/auth';
import { useCourseNow } from '@/lib/courseClock';
import { getCourseStepModels, getNextCourseStep } from '@/lib/courseWorkflow';
import { useLearnerProgress } from '@/lib/progress';

function formatTimestamp(value: string | null) {
  if (!value) {
    return 'Not submitted yet';
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function PretestPage() {
  const localizePath = useLocalizedPath();
  const { state, setModuleProgress, setPretestAnswer, setPretestQuestionIndex, submitPreCourseSurvey, submitPretest } =
    useLearnerProgress();
  const { isSupabaseEnabled, profile } = useAuth();
  const adminSessionActive = useCourseAdminSessionActive();
  const vendorSessionActive = useCourseVendorSessionActive();
  const nowMs = useCourseNow();
  const [surveyResponses, setSurveyResponses] = useState<CourseSurveyResponses>({});
  const [pretestSubmissionError, setPretestSubmissionError] = useState<string | null>(null);
  const questions = pretestContent.questions;
  const pretest = state.pretest;
  const currentIndex = Math.max(0, Math.min(questions.length - 1, pretest.currentQuestionIndex));
  const currentQuestion = questions[currentIndex];
  const currentImage = currentQuestion?.imageAssetKey ? getPretestImage(currentQuestion.imageAssetKey) : null;
  const submitted = Boolean(pretest.submittedAt);
  const unlockedByPasscode = Boolean(pretest.unlockedByPasscodeAt);
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
  const preCourseSurveyComplete = Boolean(state.preCourseSurvey.submittedAt);
  const pretestAccessUnlocked = submitted || unlockedByPasscode || (accountComplete && preCourseSurveyComplete);
  const result = useMemo(() => scorePretest(questions, pretest.answers), [questions, pretest.answers]);
  const firstUnansweredQuestionIndex = getFirstUnansweredQuestionIndex(questions, pretest.answers);
  const nextUnansweredQuestionIndex = getNextUnansweredQuestionIndex(questions, pretest.answers, currentIndex);
  const savedScore = pretest.score ?? result.correctCount;
  const savedTotal = pretest.totalQuestions || questions.length;
  const courseStepModels = useMemo(() => getCourseStepModels(state, accessOptions), [accessOptions, state]);
  const nextCourseStep = getNextCourseStep(state, accessOptions);
  const progressPercent =
    submitted || unlockedByPasscode || result.totalCount === 0
      ? 100
      : preCourseSurveyComplete
        ? Math.max(38, Math.round((result.answeredCount / result.totalCount) * 92))
        : accountComplete
          ? 24
          : 12;
  const canSubmitSurvey = isCourseSurveyComplete(preCourseSurveyItems, surveyResponses);

  useEffect(() => {
    setModuleProgress('pretest', progressPercent, pretestAccessUnlocked);
  }, [pretestAccessUnlocked, progressPercent, setModuleProgress]);

  function openQuestion(index: number) {
    if (index < 0 || index >= questions.length) {
      return;
    }

    setPretestQuestionIndex(index);
  }

  function handleSelect(optionId: string) {
    if (!currentQuestion || submitted || !pretestAccessUnlocked) {
      return;
    }

    setPretestAnswer(currentQuestion.id, optionId);
  }

  function handleSubmit() {
    if (!pretestAccessUnlocked || result.answeredCount < result.totalCount) {
      if (firstUnansweredQuestionIndex >= 0) {
        openQuestion(firstUnansweredQuestionIndex);
      }

      return;
    }

    try {
      submitPretest({
        score: result.correctCount,
        answeredCount: result.answeredCount,
        totalQuestions: result.totalCount,
      });
      setPretestSubmissionError(null);
    } catch {
      setPretestSubmissionError('Unable to save the pre-course test. Please try again before continuing.');
    }
  }

  function handleSurveySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accountComplete || !canSubmitSurvey) {
      return;
    }

    submitPreCourseSurvey(surveyResponses);
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div className="eyebrow">Baseline assessment</div>
        <h2>{pretestContent.title}</h2>
        <p>{pretestContent.summary}</p>
        <div className="tag-row">
          <span className="tag">{accountComplete ? 'Account complete' : 'Account required'}</span>
          <span className="tag">{preCourseSurveyComplete ? 'Survey submitted' : 'Survey first'}</span>
          <span className="tag">{questions.length} questions</span>
          <span className="tag">Answers hidden</span>
          <span className="tag">Demo local logging</span>
        </div>
        <div className="stack-list">
          {pretestContent.instructions.map((instruction) => (
            <div key={instruction} className="mini-card">
              <p>{instruction}</p>
            </div>
          ))}
        </div>
      </section>

      <CourseStepGuidance steps={courseStepModels} />

      <section className="section-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Step 1</div>
            <h2>{accountComplete ? 'Account step complete' : 'Create account / log in'}</h2>
            <p>
              {accountComplete
                ? 'Your learner access step is complete for this browser session.'
                : 'Create your learner account or sign in before submitting the pre-course survey.'}
            </p>
          </div>
        </div>
        {!accountComplete ? (
          <div className="button-row button-row--wrap">
            <Link className="button" to={localizePath('/auth?mode=sign-up&next=%2Fpretest')}>
              Create account
            </Link>
            <Link className="button button--ghost" to={localizePath('/auth?next=%2Fpretest')}>
              Sign in
            </Link>
          </div>
        ) : null}
      </section>

      <section className="section-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Step 2</div>
            <h2>{preCourseSurveyComplete ? 'Pre-course survey submitted' : 'Pre-course survey'}</h2>
            <p>Submit the survey before starting the baseline pre-test.</p>
          </div>
          <span className="tag">{formatTimestamp(state.preCourseSurvey.submittedAt)}</span>
        </div>
        {preCourseSurveyComplete ? (
          <div className="feedback-banner feedback-banner--success">
            <strong>Survey saved</strong>
            <p>Your pre-course survey response is saved locally and queued for Supabase sync when connected.</p>
          </div>
        ) : (
          <CourseSurveyForm
            disabled={!accountComplete}
            items={preCourseSurveyItems}
            onResponsesChange={setSurveyResponses}
            onSubmit={handleSurveySubmit}
            responses={surveyResponses}
            submitLabel="Submit pre-course survey"
          />
        )}
      </section>

      <section className={`section-card${pretestAccessUnlocked ? '' : ' section-card--locked'}`}>
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Step 3</div>
            <h2>{pretestAccessUnlocked ? `Question ${currentIndex + 1} of ${questions.length}` : 'Pre-test locked'}</h2>
            {!pretestAccessUnlocked ? (
              <p>Complete account setup and the pre-course survey to unlock the test.</p>
            ) : null}
          </div>
        </div>
        {pretestAccessUnlocked ? (
          <>
            {submitted ? (
              <div className="feedback-banner feedback-banner--success" role="status">
                <strong>Your pre-course test has been saved.</strong>
                <p>
                  Answers and explanations will be available after course completion. You may now continue to the next
                  required step.
                </p>
                {nextCourseStep ? (
                  <div className="button-row button-row--wrap">
                    <Link className="button" to={localizePath(nextCourseStep.path)}>
                      Continue: {nextCourseStep.title}
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}
            {pretestSubmissionError ? (
              <div className="feedback-banner" role="alert">
                <strong>Pre-test was not saved.</strong>
                <p>{pretestSubmissionError}</p>
              </div>
            ) : null}
            <div className="pretest-chip-grid" role="list" aria-label="Pretest question navigator">
              {questions.map((question, index) => {
                const answered = Boolean(pretest.answers[question.id]);

                return (
                  <button
                    key={question.id}
                    className={`control-pill pretest-chip${currentIndex === index ? ' pretest-chip--active' : ''}${answered ? ' pretest-chip--answered' : ''}`}
                    onClick={() => openQuestion(index)}
                    type="button"
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            {!submitted && firstUnansweredQuestionIndex >= 0 ? (
              <div className="button-row button-row--wrap">
                <button
                  className="button button--ghost"
                  onClick={() =>
                    openQuestion(
                      nextUnansweredQuestionIndex >= 0 ? nextUnansweredQuestionIndex : firstUnansweredQuestionIndex,
                    )
                  }
                  type="button"
                >
                  Jump to unanswered #
                  {(nextUnansweredQuestionIndex >= 0 ? nextUnansweredQuestionIndex : firstUnansweredQuestionIndex) + 1}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      {pretestAccessUnlocked ? (
        <section className="quiz-card quiz-card--large-stem">
          <div className="quiz-card__header">
            <div>
              <div className="eyebrow">{currentQuestion.type.replace(/-/g, ' ')}</div>
              <h2>{currentQuestion.prompt}</h2>
            </div>
            <span className="quiz-card__score">
              {submitted ? `${savedScore}/${savedTotal}` : `${result.answeredCount}/${questions.length}`}
            </span>
          </div>

          {currentImage ? (
            <figure className="pretest-figure">
              <img alt={currentImage.alt} src={currentImage.src} />
              <figcaption>{currentImage.caption}</figcaption>
            </figure>
          ) : null}

          <div className="stack-list">
            {currentQuestion.options.map((option) => {
              const isSelected = pretest.answers[currentQuestion.id] === option.id;

              return (
                <button
                  key={option.id}
                  className={`choice-card${isSelected ? ' choice-card--selected' : ''}`}
                  disabled={submitted}
                  onClick={() => handleSelect(option.id)}
                  type="button"
                >
                  <strong>{option.label}</strong>
                </button>
              );
            })}
          </div>

          <div className="button-row button-row--wrap">
            <button
              className="button button--ghost"
              disabled={currentIndex === 0}
              onClick={() => openQuestion(currentIndex - 1)}
              type="button"
            >
              Previous
            </button>
            <button
              className="button button--ghost"
              disabled={currentIndex === questions.length - 1}
              onClick={() => openQuestion(currentIndex + 1)}
              type="button"
            >
              Next
            </button>
            <button
              className="button"
              disabled={submitted || result.answeredCount !== result.totalCount}
              onClick={handleSubmit}
              type="button"
            >
              {submitted ? 'Pre-test saved' : 'Submit pre-test'}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
