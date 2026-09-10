import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';

import { finalPostTestAssessment } from '@/content/courseAssessments';
import {
  type CourseSurveyResponses,
  isCourseSurveyComplete as isCourseSurveyResponseComplete,
  postCourseSurveyItems,
} from '@/content/courseSurveys';
import { QuizCard } from '@/features/quiz/QuizCard';
import { CourseSurveyForm } from '@/features/surveys/CourseSurveyForm';
import { useCourseAdminSessionActive, useCourseVendorSessionActive } from '@/lib/adminSession';
import { useAuth } from '@/lib/auth';
import { formatCourseEndAvailability, isCourseEndUnlocked } from '@/lib/courseConfig';
import { useCourseNow } from '@/lib/courseClock';
import {
  getAssessmentWorkflowStatus,
  getCourseAssessmentProgress,
  isCourseCertificateUnlocked,
  getLectureModuleProgressSummary,
  getPostCourseAssessmentLockReason,
  isPostCourseAssessmentUnlocked,
  isCourseSurveyComplete,
} from '@/lib/courseWorkflow';
import type { QuizResult } from '@/lib/quiz';
import { type CourseAssessmentProgress, useLearnerProgress } from '@/lib/progress';

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return 'Not completed';
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function getAssessmentScoreLabel(progress: CourseAssessmentProgress | null) {
  if (!finalPostTestAssessment) {
    return 'Unavailable';
  }

  if (!progress?.completedAt) {
    return `${finalPostTestAssessment.questions.length} questions`;
  }

  return `${progress.percent}% saved`;
}

function getSavedAssessmentAnswers(progress: CourseAssessmentProgress | null) {
  if (!progress) {
    return {};
  }

  return Object.fromEntries(
    progress.answers.map((answer) => [answer.questionId, answer.selectedOptionIds]),
  );
}

export function PostCoursePage() {
  const {
    recordCourseAssessmentResult,
    recordQuizResult,
    setModuleProgress,
    state,
    submitCourseSurvey,
  } = useLearnerProgress();
  const { profile, user } = useAuth();
  const adminSessionActive = useCourseAdminSessionActive();
  const vendorSessionActive = useCourseVendorSessionActive();
  const previewSessionActive = adminSessionActive || vendorSessionActive;
  const nowMs = useCourseNow();
  const accessOptions = useMemo(
    () => ({ admin: adminSessionActive, nowMs, preview: vendorSessionActive }),
    [adminSessionActive, nowMs, vendorSessionActive],
  );
  const [surveyResponses, setSurveyResponses] = useState<CourseSurveyResponses>({});
  const postTestProgress = finalPostTestAssessment
    ? getCourseAssessmentProgress(state, finalPostTestAssessment.id)
    : null;
  const postTestWorkflow = finalPostTestAssessment
    ? getAssessmentWorkflowStatus(state, finalPostTestAssessment, accessOptions)
    : null;
  const surveyStep = useMemo(
    () => getLectureModuleProgressSummary(state),
    [state],
  );
  const surveyComplete = isCourseSurveyComplete(state);
  const courseEnded = isCourseEndUnlocked(nowMs);
  const postCourseUnlocked = isPostCourseAssessmentUnlocked(state, accessOptions);
  const postCourseLockReason = getPostCourseAssessmentLockReason(state, accessOptions) ?? formatCourseEndAvailability();
  const postTestUnlocked = Boolean(finalPostTestAssessment && postCourseUnlocked);
  const surveyUnlocked = postCourseUnlocked;
  const completionArtifactsUnlocked = previewSessionActive || isCourseCertificateUnlocked(state);
  const reviewPostTest = Boolean(postTestProgress?.completedAt && completionArtifactsUnlocked);
  const canSubmitSurvey = isCourseSurveyResponseComplete(postCourseSurveyItems, surveyResponses);
  const learnerName = profile?.fullName || user?.email || 'EBUS learner';

  function handleCourseAssessmentComplete(result: QuizResult) {
    if (!finalPostTestAssessment) {
      return;
    }

    const wasComplete = Boolean(state.courseAssessmentResults[finalPostTestAssessment.id]?.completedAt);
    const nextCompletedCount = surveyStep.completedCount + (wasComplete ? 0 : 1);
    const answers = result.items.map((item) => ({
      questionId: item.question.id,
      selectedOptionIds: item.selectedOptionIds,
      correctOptionIds: item.question.correctOptionIds,
      isCorrect: item.isCorrect,
    }));

    recordCourseAssessmentResult({
      assessmentId: finalPostTestAssessment.id,
      correctCount: result.correctCount,
      totalCount: result.totalCount,
      percent: result.percent,
      answers,
    });
    recordQuizResult({
      id: `${finalPostTestAssessment.id}-${Date.now()}`,
      label: finalPostTestAssessment.title,
      moduleId: 'lectures',
      correctCount: result.correctCount,
      totalCount: result.totalCount,
      percent: result.percent,
    });
    setModuleProgress(
      'lectures',
      Math.round((nextCompletedCount / surveyStep.totalCount) * 100),
      nextCompletedCount >= surveyStep.totalCount,
    );
  }

  function handleSurveySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmitSurvey || !surveyUnlocked) {
      return;
    }

    const nextCompletedCount = surveyStep.completedCount + (surveyComplete ? 0 : 1);

    submitCourseSurvey(surveyResponses);
    setModuleProgress(
      'lectures',
      Math.round((nextCompletedCount / surveyStep.totalCount) * 100),
      nextCompletedCount >= surveyStep.totalCount,
    );
  }

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div className="eyebrow">Post-course survey and test</div>
        <h2>Post-course assessment is open after the pre-test.</h2>
        <p>
          Learners who completed the pre-test can submit the final post-test and post-course survey after the live
          course ends, even if module progress is incomplete. Answers remain hidden during the test experience for
          cohort review.
        </p>
        <div className="tag-row">
          <span className="tag">{courseEnded ? 'Course ended' : formatCourseEndAvailability()}</span>
          <span className="tag">Post-test: {getAssessmentScoreLabel(postTestProgress)}</span>
        </div>
      </section>

      <section className={`section-card${postTestUnlocked ? '' : ' section-card--locked'}`}>
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Post-test</div>
            <h2>{postTestProgress?.completedAt ? 'Post-test submitted' : 'Post-test'}</h2>
            <p>
              {postTestUnlocked
                ? 'Final post-test is open; module completion is not required.'
                : postTestWorkflow?.lockedReason ?? postCourseLockReason}
            </p>
          </div>
          <span className="tag">{formatTimestamp(postTestProgress?.completedAt)}</span>
        </div>
        {finalPostTestAssessment && postTestUnlocked ? (
          <QuizCard
            key={`${finalPostTestAssessment.id}-${postTestProgress?.attemptCount ?? 0}-${reviewPostTest ? 'review' : 'attempt'}`}
            completionMessage="Answers are available because the final post-test and post-course survey are complete."
            completionRecordedInitially={reviewPostTest}
            deferFeedbackUntilComplete
            initialAnswers={reviewPostTest ? getSavedAssessmentAnswers(postTestProgress) : undefined}
            label={finalPostTestAssessment.title}
            largeQuestionStem
            onComplete={handleCourseAssessmentComplete}
            questions={finalPostTestAssessment.questions}
            readOnly={reviewPostTest}
            revealAnswers={completionArtifactsUnlocked}
            showRunningScore={false}
          />
        ) : null}
      </section>

      <section className={`section-card${surveyUnlocked ? '' : ' section-card--locked'}`}>
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Post-course survey</div>
            <h2>{surveyComplete ? 'Survey submitted' : 'Submit the survey to unlock the certificate'}</h2>
            <p>{surveyUnlocked ? 'Survey is open; module completion is not required.' : postCourseLockReason}</p>
          </div>
          <span className="tag">{formatTimestamp(state.courseSurvey.submittedAt)}</span>
        </div>
        {!surveyComplete ? (
          <div className="survey-intro">
            <strong>Before you begin</strong>
            <p>Please provide your impressions of each question as you'd rate them AFTER the EBUS course.</p>
          </div>
        ) : null}
        {surveyComplete ? (
          <div className="feedback-banner feedback-banner--success">
            <strong>{completionArtifactsUnlocked ? 'Post-course work complete.' : 'Survey saved.'}</strong>
            <p>
              {completionArtifactsUnlocked
                ? 'Post-test answers are now available in the portal.'
                : 'Complete the final post-test to unlock the certificate.'}
            </p>
          </div>
        ) : (
          <CourseSurveyForm
            disabled={!surveyUnlocked}
            items={postCourseSurveyItems}
            onResponsesChange={setSurveyResponses}
            onSubmit={handleSurveySubmit}
            responses={surveyResponses}
            submitLabel="Submit survey"
          />
        )}
      </section>

      <section className={`section-card certificate-card${completionArtifactsUnlocked ? '' : ' section-card--locked'}`}>
        <div className="eyebrow">Certificate and feedback</div>
        <h2>{completionArtifactsUnlocked ? 'Course completion recorded' : 'Certificate pending'}</h2>
        <p>The Course Staff will email you a course completion certificate along with personalized performance feedback.</p>
        <div className="tag-row">
          <span className="tag">{learnerName}</span>
          <span className="tag">
            {completionArtifactsUnlocked ? `Completed ${formatTimestamp(state.courseSurvey.submittedAt)}` : 'Complete post-test and survey'}
          </span>
        </div>
      </section>
    </div>
  );
}
