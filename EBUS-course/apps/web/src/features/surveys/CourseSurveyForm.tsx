import type { FormEvent } from 'react';

import {
  assignUniqueRankingResponse,
  type CourseSurveyItem,
  type CourseSurveyRankingItem,
  type CourseSurveyResponses,
  type CourseSurveySingleChoiceItem,
  getChoiceFreeTextResponseKey,
  getRankingOtherTextResponseKey,
  getRankingResponseKey,
  getScaleOptions,
  isCourseSurveyComplete,
} from '@/content/courseSurveys';

interface CourseSurveyFormProps {
  disabled?: boolean;
  items: CourseSurveyItem[];
  onResponsesChange: (responses: CourseSurveyResponses) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  responses: CourseSurveyResponses;
  submitLabel: string;
}

function withoutEmptyValues(responses: CourseSurveyResponses) {
  return Object.fromEntries(Object.entries(responses).filter(([, value]) => value.trim())) as CourseSurveyResponses;
}

function CourseSurveySingleChoiceField({
  disabled,
  item,
  onResponsesChange,
  responses,
}: {
  disabled?: boolean;
  item: CourseSurveySingleChoiceItem;
  onResponsesChange: (responses: CourseSurveyResponses) => void;
  responses: CourseSurveyResponses;
}) {
  function selectOption(optionId: string) {
    const next = {
      ...responses,
      [item.id]: optionId,
    };

    for (const option of item.options) {
      if (option.id !== optionId && option.freeText) {
        delete next[getChoiceFreeTextResponseKey(item, option.id)];
      }
    }

    onResponsesChange(withoutEmptyValues(next));
  }

  return (
    <fieldset className="survey-fieldset" disabled={disabled}>
      <legend>{item.label}</legend>
      <div className="button-row button-row--wrap">
        {item.options.map((option) => (
          <label key={option.id} className="control-pill">
            <input
              checked={responses[item.id] === option.id}
              name={item.id}
              onChange={() => selectOption(option.id)}
              type="radio"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {item.options.map((option) => {
        if (!option.freeText || responses[item.id] !== option.id) {
          return null;
        }

        const responseKey = getChoiceFreeTextResponseKey(item, option.id);

        return (
          <label key={responseKey} className="field survey-inline-field">
            <span>{option.freeText.label}</span>
            <input
              onChange={(event) =>
                onResponsesChange(
                  withoutEmptyValues({
                    ...responses,
                    [responseKey]: event.target.value,
                  }),
                )
              }
              placeholder={option.freeText.placeholder}
              required={option.freeText.required}
              type="text"
              value={responses[responseKey] ?? ''}
            />
          </label>
        );
      })}
    </fieldset>
  );
}

function CourseSurveyScaleField({
  disabled,
  item,
  onResponsesChange,
  responses,
}: {
  disabled?: boolean;
  item: Extract<CourseSurveyItem, { type: 'scale' }>;
  onResponsesChange: (responses: CourseSurveyResponses) => void;
  responses: CourseSurveyResponses;
}) {
  return (
    <fieldset className="survey-fieldset survey-fieldset--scale" disabled={disabled}>
      <legend>{item.label}</legend>
      <div className="survey-scale" role="radiogroup" aria-label={item.label}>
        {getScaleOptions(item).map((value) => (
          <label key={value} className={`control-pill survey-scale__option${responses[item.id] === value ? ' control-pill--active' : ''}`}>
            <input
              checked={responses[item.id] === value}
              name={item.id}
              onChange={() =>
                onResponsesChange({
                  ...responses,
                  [item.id]: value,
                })
              }
              type="radio"
            />
            <span>{value}</span>
          </label>
        ))}
      </div>
      <div className="survey-scale__labels">
        <span>{item.minLabel}</span>
        <span>{item.maxLabel}</span>
      </div>
    </fieldset>
  );
}

function CourseSurveyRankingField({
  disabled,
  item,
  onResponsesChange,
  responses,
}: {
  disabled?: boolean;
  item: CourseSurveyRankingItem;
  onResponsesChange: (responses: CourseSurveyResponses) => void;
  responses: CourseSurveyResponses;
}) {
  const rankOptions = item.options.map((_, index) => String(index + 1));
  const selectedRanks = item.options.map((option) => responses[getRankingResponseKey(item, option.id)]).filter(Boolean);
  const hasDuplicateRanks = new Set(selectedRanks).size !== selectedRanks.length;

  return (
    <fieldset className="survey-fieldset" disabled={disabled}>
      <legend>{item.label}</legend>
      <p className="survey-fieldset__help">{item.instructions}</p>
      <div className="survey-rank-grid">
        {item.options.map((option) => {
          const responseKey = getRankingResponseKey(item, option.id);

          return (
            <label key={option.id} className="survey-rank-row">
              <span>{option.label}</span>
              <select
                aria-label={`Rank for ${option.label}`}
                onChange={(event) =>
                  onResponsesChange(
                    withoutEmptyValues(assignUniqueRankingResponse(item, responses, option.id, event.target.value)),
                  )
                }
                required
                value={responses[responseKey] ?? ''}
              >
                <option value="">Rank</option>
                {rankOptions.map((rank) => (
                  <option key={rank} value={rank}>
                    {rank}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      {hasDuplicateRanks ? <p className="survey-fieldset__error">Use each rank once.</p> : null}
      {item.otherText ? (
        <label className="field survey-inline-field">
          <span>{item.otherText.label}</span>
          <input
            onChange={(event) =>
              onResponsesChange(
                withoutEmptyValues({
                  ...responses,
                  [getRankingOtherTextResponseKey(item)]: event.target.value,
                }),
              )
            }
            placeholder={item.otherText.placeholder}
            type="text"
            value={responses[getRankingOtherTextResponseKey(item)] ?? ''}
          />
        </label>
      ) : null}
    </fieldset>
  );
}

function CourseSurveyTextField({
  disabled,
  item,
  onResponsesChange,
  responses,
}: {
  disabled?: boolean;
  item: Extract<CourseSurveyItem, { type: 'text' }>;
  onResponsesChange: (responses: CourseSurveyResponses) => void;
  responses: CourseSurveyResponses;
}) {
  return (
    <label className="field survey-text-field">
      <span>{item.label}</span>
      <textarea
        disabled={disabled}
        onChange={(event) =>
          onResponsesChange(
            withoutEmptyValues({
              ...responses,
              [item.id]: event.target.value,
            }),
          )
        }
        placeholder={item.placeholder}
        required={!item.optional}
        rows={item.rows ?? 4}
        value={responses[item.id] ?? ''}
      />
    </label>
  );
}

function CourseSurveyField({
  disabled,
  item,
  onResponsesChange,
  responses,
}: {
  disabled?: boolean;
  item: CourseSurveyItem;
  onResponsesChange: (responses: CourseSurveyResponses) => void;
  responses: CourseSurveyResponses;
}) {
  if (item.type === 'single-choice') {
    return (
      <CourseSurveySingleChoiceField
        disabled={disabled}
        item={item}
        onResponsesChange={onResponsesChange}
        responses={responses}
      />
    );
  }

  if (item.type === 'scale') {
    return (
      <CourseSurveyScaleField disabled={disabled} item={item} onResponsesChange={onResponsesChange} responses={responses} />
    );
  }

  if (item.type === 'ranking') {
    return (
      <CourseSurveyRankingField disabled={disabled} item={item} onResponsesChange={onResponsesChange} responses={responses} />
    );
  }

  return (
    <CourseSurveyTextField disabled={disabled} item={item} onResponsesChange={onResponsesChange} responses={responses} />
  );
}

export function CourseSurveyForm({
  disabled,
  items,
  onResponsesChange,
  onSubmit,
  responses,
  submitLabel,
}: CourseSurveyFormProps) {
  const canSubmit = !disabled && isCourseSurveyComplete(items, responses);

  return (
    <form className="survey-form" onSubmit={onSubmit}>
      {items.map((item) => (
        <CourseSurveyField
          key={item.id}
          disabled={disabled}
          item={item}
          onResponsesChange={onResponsesChange}
          responses={responses}
        />
      ))}
      <button className="button" disabled={!canSubmit} type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
