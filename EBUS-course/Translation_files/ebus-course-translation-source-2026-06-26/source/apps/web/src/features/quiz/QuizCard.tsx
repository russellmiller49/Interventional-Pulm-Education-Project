import { useState } from 'react';

import { QuizExplanationPanel } from '@/components/education/EducationModuleRenderer';
import type { QuizQuestionContent } from '@/content/types';
import { calculateQuizResult, isQuizAnswerCorrect } from '@/lib/quiz';

function canSubmitQuestion(question: QuizQuestionContent, selectedOptionIds: string[]): boolean {
  if (question.type === 'ordering') {
    return selectedOptionIds.length === question.options.length;
  }

  return selectedOptionIds.length > 0;
}

function toggleMultiSelection(current: string[], optionId: string): string[] {
  return current.includes(optionId) ? current.filter((entry) => entry !== optionId) : [...current, optionId];
}

function toggleOrderingSelection(current: string[], optionId: string): string[] {
  return current.includes(optionId) ? current.filter((entry) => entry !== optionId) : [...current, optionId];
}

export function QuizCard({
  questions,
  label,
  onComplete,
  onRetake,
  initialAnswers = {},
  completionRecordedInitially = false,
  completionMessage = 'You may continue to the next required step.',
  allowRetake = false,
  readOnly = false,
  revealAnswers = true,
  deferFeedbackUntilComplete = false,
  showRunningScore = true,
  showDifficultyLabel = true,
  largeQuestionStem = false,
}: {
  questions: QuizQuestionContent[];
  label: string;
  onComplete?: (result: ReturnType<typeof calculateQuizResult>) => void;
  onRetake?: () => void;
  initialAnswers?: Record<string, string[] | undefined>;
  completionRecordedInitially?: boolean;
  completionMessage?: string;
  allowRetake?: boolean;
  readOnly?: boolean;
  revealAnswers?: boolean;
  deferFeedbackUntilComplete?: boolean;
  showRunningScore?: boolean;
  showDifficultyLabel?: boolean;
  largeQuestionStem?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[] | undefined>>(() => ({ ...initialAnswers }));
  const [draftSelections, setDraftSelections] = useState<Record<string, string[] | undefined>>({});
  const [completionRecorded, setCompletionRecorded] = useState(completionRecordedInitially);
  const currentQuestion = questions[currentIndex];
  const finalizedSelection = currentQuestion ? answers[currentQuestion.id] ?? [] : [];
  const draftSelection = currentQuestion ? draftSelections[currentQuestion.id] ?? [] : [];
  const currentSelection = finalizedSelection.length > 0 ? finalizedSelection : draftSelection;
  const answeredCurrent = Boolean(currentQuestion && finalizedSelection.length > 0);
  const result = calculateQuizResult(questions, answers);
  const shouldRevealAnswers = revealAnswers && (readOnly || !deferFeedbackUntilComplete || completionRecorded);

  if (questions.length === 0 || !currentQuestion) {
    return null;
  }

  function updateDraft(nextSelection: string[]) {
    if (answeredCurrent || readOnly || completionRecorded) {
      return;
    }

    setDraftSelections((current) => ({
      ...current,
      [currentQuestion.id]: nextSelection,
    }));
  }

  function handleSelect(optionId: string) {
    if (answeredCurrent || readOnly || completionRecorded) {
      return;
    }

    if (currentQuestion.type === 'multi-select') {
      updateDraft(toggleMultiSelection(currentSelection, optionId));
      return;
    }

    if (currentQuestion.type === 'ordering') {
      updateDraft(toggleOrderingSelection(currentSelection, optionId));
      return;
    }

    updateDraft([optionId]);
  }

  function submitCurrentQuestion() {
    if (readOnly || completionRecorded || !canSubmitQuestion(currentQuestion, currentSelection) || answeredCurrent) {
      return;
    }

    setAnswers((current) => ({
      ...current,
      [currentQuestion.id]: currentSelection,
    }));
  }

  function recordCompletion() {
    if (completionRecorded) {
      return;
    }

    setCompletionRecorded(true);
    onComplete?.(result);
  }

  function startRetake() {
    setAnswers({});
    setDraftSelections({});
    setCompletionRecorded(false);
    setCurrentIndex(0);
    onRetake?.();
  }

  return (
    <section className={`quiz-card${largeQuestionStem ? ' quiz-card--large-stem' : ''}`}>
      <div className="quiz-card__header">
        <div>
          <div className="eyebrow">{label}</div>
          <h2>{currentQuestion.prompt}</h2>
        </div>
        <span className="quiz-card__score">
          {showRunningScore
            ? `${result.correctCount}/${result.answeredCount || questions.length}`
            : `${result.answeredCount}/${questions.length} answered`}
        </span>
      </div>

      {completionRecorded ? (
        <div className="feedback-banner feedback-banner--success quiz-card__completion" role="status">
          <strong>✓ Score recorded.</strong>
          <p>{completionMessage}</p>
        </div>
      ) : null}

      <div className="quiz-card__progress">
        {questions.map((question, index) => {
          const selected = answers[question.id] ?? [];
          const isCorrect = isQuizAnswerCorrect(question, selected);

          return (
            <span
              key={question.id}
              className={`quiz-card__progress-pill${
                index === currentIndex
                  ? ' quiz-card__progress-pill--active'
                  : selected.length > 0 && shouldRevealAnswers
                    ? isCorrect
                      ? ' quiz-card__progress-pill--correct'
                      : ' quiz-card__progress-pill--incorrect'
                    : selected.length > 0
                      ? ' quiz-card__progress-pill--answered'
                    : ''
              }`}
            />
          );
        })}
      </div>

      <div className="quiz-card__question-meta">
        <span>{currentQuestion.type.replace(/-/g, ' ')}</span>
        <span>
          Question {currentIndex + 1} of {questions.length}
        </span>
      </div>

      {currentQuestion.caseTitle ? (
        <div className="education-card education-card--case">
          <div className="eyebrow">Case stem</div>
          <strong>{currentQuestion.caseTitle}</strong>
          {currentQuestion.caseSummary ? <p>{currentQuestion.caseSummary}</p> : null}
        </div>
      ) : null}

      {currentQuestion.imageAsset ? (
        <figure className="pretest-figure quiz-card__figure">
          <img alt={currentQuestion.imageAsset.alt} loading="lazy" src={currentQuestion.imageAsset.src} />
          <figcaption>{currentQuestion.imageAsset.caption}</figcaption>
        </figure>
      ) : null}

      {currentQuestion.type === 'ordering' ? (
        <div className="education-card education-card--checklist">
          <div className="eyebrow">Current order</div>
          <p>
            {currentSelection.length > 0
              ? currentSelection
                  .map((optionId, index) => {
                    const option = currentQuestion.options.find((entry) => entry.id === optionId);
                    return `${index + 1}. ${option?.label ?? optionId}`;
                  })
                  .join('  ')
              : 'Tap the steps in order. Tap a selected step again to remove it.'}
          </p>
        </div>
      ) : null}

      <div className="stack-list">
        {currentQuestion.options.map((option) => {
          const isSelected = currentSelection.includes(option.id);
          const isCorrect = currentQuestion.correctOptionIds.includes(option.id);
          const orderIndex = currentSelection.indexOf(option.id);

          return (
            <button
              key={option.id}
              className={`choice-card${
                answeredCurrent && shouldRevealAnswers
                  ? isCorrect
                    ? ' choice-card--correct'
                    : isSelected
                      ? ' choice-card--incorrect'
                      : ''
                  : isSelected
                    ? ' choice-card--selected'
                    : ''
              }`}
              onClick={() => handleSelect(option.id)}
              type="button"
            >
              {answeredCurrent && shouldRevealAnswers && (isSelected || isCorrect) ? (
                <span className="choice-card__mark" aria-hidden="true">
                  {isCorrect ? '✓' : '✕'}
                </span>
              ) : null}
              <strong>
                {currentQuestion.type === 'ordering' && orderIndex >= 0 ? `${orderIndex + 1}. ` : ''}
                {option.label}
              </strong>
            </button>
          );
        })}
      </div>

      {answeredCurrent && shouldRevealAnswers ? (
        <QuizExplanationPanel
          question={currentQuestion}
          selectedOptionIds={finalizedSelection}
          showDifficulty={showDifficultyLabel}
        />
      ) : null}

      <div className="button-row button-row--wrap">
        <button
          className="button button--ghost"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((index) => index - 1)}
          type="button"
        >
          Previous
        </button>
        {completionRecorded ? (
          <>
            {currentIndex < questions.length - 1 ? (
              <button
                className="button"
                onClick={() => setCurrentIndex((index) => index + 1)}
                type="button"
              >
                Next
              </button>
            ) : null}
            <button className="button button--ghost" onClick={() => setCurrentIndex(0)} type="button">
              Review quiz
            </button>
            {allowRetake ? (
              <button className="button button--ghost" onClick={startRetake} type="button">
                Retake quiz
              </button>
            ) : null}
          </>
        ) : !answeredCurrent ? (
          <>
            {currentQuestion.type === 'ordering' ? (
              <button
                className="button button--ghost"
                disabled={currentSelection.length === 0}
                onClick={() => updateDraft([])}
                type="button"
              >
                Reset order
              </button>
            ) : null}
            <button
              className="button"
              disabled={!canSubmitQuestion(currentQuestion, currentSelection)}
              onClick={submitCurrentQuestion}
              type="button"
            >
              {showRunningScore ? 'Check answer' : 'Lock answer'}
            </button>
          </>
        ) : currentIndex < questions.length - 1 ? (
          <button
            className="button"
            onClick={() => setCurrentIndex((index) => index + 1)}
            type="button"
          >
            Next
          </button>
        ) : (
          <button
            className="button"
            disabled={result.answeredCount !== questions.length}
            onClick={recordCompletion}
            type="button"
          >
            {showRunningScore ? `Save ${result.percent}% score` : 'Submit attempt'}
          </button>
        )}
      </div>
    </section>
  );
}
