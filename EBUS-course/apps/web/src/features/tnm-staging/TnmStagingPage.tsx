import { useEffect, useMemo, useState } from 'react';

import { Accordion, AccordionPanel } from '@/components/Accordion';
import { tnmCases, tnmReferenceCards, tnmStageMatrix, tnmStationRules, tnmTBuilderContent } from '@/content/tnmStaging';
import { getStationMapLayout, getStations } from '@/content/stations';
import type {
  TnmBuilderState,
  TnmMCategory,
  TnmSelection,
  TnmStageableNCategory,
  TnmStageableTCategory,
  TnmStationStatusValue,
} from '@/content/types';
import { StationMap } from '@/features/stations/StationMap';
import { useLearnerProgress } from '@/lib/progress';

import {
  deriveNDescriptor,
  deriveTDescriptor,
  getAdjacentStageComparisons,
  getInitialStationStatuses,
  getInitialTBuilderState,
  getInitialTnmSelection,
  getNextStationStatus,
  scoreTnmCase,
  stageTnm,
} from './logic';

import './tnm-staging.css';

type TnmTabId = 'reference' | 'stager' | 't-builder' | 'n-map' | 'cases';

const tabs: Array<{ id: TnmTabId; label: string; progress: number }> = [
  { id: 'reference', label: 'Reference', progress: 25 },
  { id: 'stager', label: 'Stager', progress: 45 },
  { id: 't-builder', label: 'T Builder', progress: 60 },
  { id: 'n-map', label: 'N Map', progress: 75 },
  { id: 'cases', label: 'Cases', progress: 85 },
];

const statusLabels: Record<TnmStationStatusValue, string> = {
  unassessed: 'Unassessed',
  'sampled-negative': 'Sampled negative',
  positive: 'Positive',
};

function unique(values: string[]) {
  return [...new Set(values)];
}

function SelectorGroup<TValue extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: TValue; label: string; descriptor: string }>;
  value: TValue;
  onChange: (value: TValue) => void;
}) {
  return (
    <div className="tnm-selector-group">
      <div className="eyebrow">{label}</div>
      <div className="tnm-selector-grid">
        {options.map((option) => (
          <button
            key={option.id}
            className={`tnm-option${value === option.id ? ' tnm-option--active' : ''}`}
            onClick={() => onChange(option.id)}
            type="button"
          >
            <strong>{option.label}</strong>
            <span>{option.descriptor}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ReferenceTab() {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCards = tnmReferenceCards.filter((card) => {
    if (!normalizedQuery) {
      return true;
    }

    return [card.category, card.title, card.summary, card.changedFrom8th, ...card.bullets]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  });
  const categories = ['T', 'N', 'M', 'Stage'] as const;

  return (
    <section className="section-card tnm-panel">
      <div className="section-card__heading">
        <div>
          <div className="eyebrow">Reference</div>
          <h2>Searchable TNM-9 descriptors and stage-group changes</h2>
          <p>Local paraphrased teaching cards derived from IASLC 9th-edition staging material.</p>
        </div>
      </div>

      <label className="field tnm-search">
        <span>Search descriptors</span>
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try N2b, atelectasis, M1c1, stage group"
          type="search"
          value={query}
        />
      </label>

      <div className="tnm-reference-grid">
        {categories.map((category) => {
          const cards = filteredCards.filter((card) => card.category === category);

          if (cards.length === 0) {
            return null;
          }

          return (
            <Accordion key={category}>
              {cards.map((card, index) => (
                <AccordionPanel
                  key={card.id}
                  defaultOpen={!normalizedQuery && index === 0}
                  id={`tnm-reference-${card.id}`}
                  title={`${card.category}: ${card.title}`}
                >
                  <article className="tnm-reference-card">
                    <p>{card.summary}</p>
                    <ul className="plain-list">
                      {card.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                    <aside className="tnm-change-callout">
                      <strong>What changed from 8th</strong>
                      <p>{card.changedFrom8th}</p>
                    </aside>
                  </article>
                </AccordionPanel>
              ))}
            </Accordion>
          );
        })}
      </div>
    </section>
  );
}

function StagerTab() {
  const [selection, setSelection] = useState<TnmSelection>(getInitialTnmSelection);
  const result = stageTnm(selection);
  const comparisons = getAdjacentStageComparisons(selection);

  function updateSelection<TKey extends keyof TnmSelection>(key: TKey, value: TnmSelection[TKey]) {
    setSelection((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <section className="section-card tnm-panel">
      <div className="section-card__heading">
        <div>
          <div className="eyebrow">Interactive stager</div>
          <h2>Choose T, N, and M to compute cStage</h2>
          <p>Stage grouping follows the local 9th-edition matrix used throughout this module.</p>
        </div>
        <div className="tnm-stage-badge">
          <span>cStage</span>
          <strong>{result.stage}</strong>
        </div>
      </div>

      <div className="tnm-stager-layout">
        <div className="tnm-stager-selectors">
          <SelectorGroup
            label="T descriptor"
            onChange={(value) => updateSelection('t', value)}
            options={tnmStageMatrix.tCategories}
            value={selection.t}
          />
          <SelectorGroup
            label="N descriptor"
            onChange={(value) => updateSelection('n', value)}
            options={tnmStageMatrix.nCategories}
            value={selection.n}
          />
          <SelectorGroup
            label="M descriptor"
            onChange={(value) => updateSelection('m', value)}
            options={tnmStageMatrix.mCategories}
            value={selection.m}
          />
        </div>

        <aside className="tnm-result-panel">
          <div className="eyebrow">Explanation</div>
          <h3>
            {selection.t}
            {selection.n}
            {selection.m} is stage {result.stage}
          </h3>
          <p>{result.explanation}</p>
          <div className="tnm-adjacent-list">
            <strong>Adjacent comparisons</strong>
            {comparisons.length === 0 ? (
              <p>Nearby descriptor changes do not change the stage group for this selection.</p>
            ) : (
              comparisons.map((comparison) => (
                <article key={`${comparison.axis}-${comparison.label}`} className="tnm-adjacent-card">
                  <span>{comparison.label}</span>
                  <strong>{comparison.stage}</strong>
                  <p>{comparison.explanation}</p>
                </article>
              ))
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function LungSchematic({ builder, t }: { builder: TnmBuilderState; t: TnmStageableTCategory }) {
  const sideX = builder.primarySide === 'right' ? 66 : 34;
  const locationOffset = {
    peripheral: { x: builder.primarySide === 'right' ? 8 : -8, y: 2 },
    central: { x: builder.primarySide === 'right' ? -8 : 8, y: -4 },
    pleural: { x: builder.primarySide === 'right' ? 13 : -13, y: 5 },
    mediastinal: { x: builder.primarySide === 'right' ? -18 : 18, y: 0 },
    diaphragmatic: { x: builder.primarySide === 'right' ? 0 : 0, y: 22 },
  }[builder.locationId];
  const tumorRadius = Math.min(12, 1.8 + builder.sizeCm * 1.15);
  const tumorX = sideX + locationOffset.x;
  const tumorY = 43 + locationOffset.y;

  return (
    <svg className="tnm-lung-schematic" viewBox="0 0 100 100" role="img" aria-label={`Lung schematic with ${t} tumor`}>
      <path className="tnm-lung-schematic__airway" d="M48 8 h4 v22 c0 7 -8 9 -15 14" />
      <path className="tnm-lung-schematic__airway" d="M52 30 c0 7 8 9 15 14" />
      <path
        className={`tnm-lung-schematic__lung${builder.primarySide === 'left' ? ' tnm-lung-schematic__lung--active' : ''}`}
        d="M43 18 C23 20 13 37 14 59 c1 21 13 30 28 25 8 -3 6 -15 4 -28 -2 -15 -1 -27 -3 -38Z"
      />
      <path
        className={`tnm-lung-schematic__lung${builder.primarySide === 'right' ? ' tnm-lung-schematic__lung--active' : ''}`}
        d="M57 18 c20 2 30 19 29 41 -1 21 -13 30 -28 25 -8 -3 -6 -15 -4 -28 2 -15 1 -27 3 -38Z"
      />
      <circle className={`tnm-lung-schematic__tumor tnm-lung-schematic__tumor--${t.toLowerCase()}`} cx={tumorX} cy={tumorY} r={tumorRadius} />
      {builder.separateNodule !== 'none' ? (
        <circle
          className="tnm-lung-schematic__nodule"
          cx={builder.separateNodule === 'contralateral-lobe' ? (builder.primarySide === 'right' ? 31 : 69) : tumorX + 7}
          cy={builder.separateNodule === 'same-lobe' ? tumorY + 17 : 72}
          r="4.5"
        />
      ) : null}
    </svg>
  );
}

function TBuilderTab() {
  const [builder, setBuilder] = useState<TnmBuilderState>(getInitialTBuilderState);
  const derived = deriveTDescriptor(builder);

  function toggleInvasion(invasionId: string) {
    setBuilder((current) => ({
      ...current,
      invasionIds: current.invasionIds.includes(invasionId)
        ? current.invasionIds.filter((entry) => entry !== invasionId)
        : [...current.invasionIds, invasionId],
    }));
  }

  return (
    <section className="section-card tnm-panel">
      <div className="section-card__heading">
        <div>
          <div className="eyebrow">Visual T builder</div>
          <h2>Build a tumor descriptor from size, location, invasion, and nodules</h2>
          <p>{tnmTBuilderContent.atelectasisNote}</p>
        </div>
        <div className="tnm-stage-badge tnm-stage-badge--t">
          <span>Computed T</span>
          <strong>{derived.t}</strong>
        </div>
      </div>

      <div className="tnm-builder-layout">
        <div className="tnm-builder-visual">
          <LungSchematic builder={builder} t={derived.t} />
          <article className="tnm-result-panel">
            <div className="eyebrow">Driver</div>
            <h3>{derived.driver}</h3>
            <p>{derived.explanation}</p>
            <div className="tag-row">
              {derived.candidates.map((candidate) => (
                <span key={`${candidate.t}-${candidate.reason}`} className="tag">
                  {candidate.t}: {candidate.reason}
                </span>
              ))}
            </div>
          </article>
        </div>

        <div className="tnm-control-stack">
          <div className="tnm-control-panel">
            <label className="field">
              <span>Primary side</span>
              <select
                onChange={(event) => setBuilder((current) => ({ ...current, primarySide: event.target.value as TnmBuilderState['primarySide'] }))}
                value={builder.primarySide}
              >
                <option value="right">Right</option>
                <option value="left">Left</option>
              </select>
            </label>
            <label className="field">
              <span>Size: {builder.sizeCm.toFixed(1)} cm</span>
              <input
                max="9"
                min="0.5"
                onChange={(event) => setBuilder((current) => ({ ...current, sizeCm: Number(event.target.value) }))}
                step="0.1"
                type="range"
                value={builder.sizeCm}
              />
            </label>
          </div>

          <div className="tnm-control-panel">
            <div className="eyebrow">Location</div>
            <div className="button-row button-row--wrap">
              {tnmTBuilderContent.locations.map((location) => (
                <button
                  key={location.id}
                  className={`control-pill${builder.locationId === location.id ? ' control-pill--active' : ''}`}
                  onClick={() => setBuilder((current) => ({ ...current, locationId: location.id }))}
                  type="button"
                >
                  {location.label}
                </button>
              ))}
            </div>
          </div>

          <div className="tnm-control-panel">
            <div className="eyebrow">Invasion features</div>
            <div className="tnm-checkbox-grid">
              {tnmTBuilderContent.invasionRules.map((rule) => (
                <label key={rule.id} className="tnm-check-card">
                  <input
                    checked={builder.invasionIds.includes(rule.id)}
                    onChange={() => toggleInvasion(rule.id)}
                    type="checkbox"
                  />
                  <span>
                    <strong>{rule.label}</strong>
                    <small>{rule.t}</small>
                  </span>
                </label>
              ))}
              <label className="tnm-check-card">
                <input
                  checked={builder.hasAtelectasisOrPneumonitis}
                  onChange={(event) =>
                    setBuilder((current) => ({ ...current, hasAtelectasisOrPneumonitis: event.target.checked }))
                  }
                  type="checkbox"
                />
                <span>
                  <strong>Atelectasis / pneumonitis</strong>
                  <small>T2 feature</small>
                </span>
              </label>
            </div>
          </div>

          <div className="tnm-control-panel">
            <div className="eyebrow">Separate tumor nodule</div>
            <div className="button-row button-row--wrap">
              {tnmTBuilderContent.separateNoduleRules.map((rule) => (
                <button
                  key={rule.id}
                  className={`control-pill${builder.separateNodule === rule.id ? ' control-pill--active' : ''}`}
                  onClick={() => setBuilder((current) => ({ ...current, separateNodule: rule.id }))}
                  type="button"
                >
                  {rule.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function NMapTab() {
  const stations = getStations();
  const layout = getStationMapLayout();
  const [primarySide, setPrimarySide] = useState<'right' | 'left'>('right');
  const [stationStatuses, setStationStatuses] = useState(getInitialStationStatuses);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const derived = deriveNDescriptor({ primarySide, stationStatuses });
  const selectedStation = selectedStationId ? stations.find((station) => station.id === selectedStationId) : null;
  const externalRules = tnmStationRules.filter((rule) => rule.external);

  function cycleStation(stationId: string) {
    setSelectedStationId(stationId);
    setStationStatuses((current) => ({
      ...current,
      [stationId]: getNextStationStatus(current[stationId] ?? 'unassessed'),
    }));
  }

  return (
    <section className="section-card tnm-panel">
      <div className="section-card__heading">
        <div>
          <div className="eyebrow">N descriptor map</div>
          <h2>Mark positive stations and compute cN by laterality</h2>
          <p>Station 7 counts as N2, 11Rs and 11Ri share a right station 11 group, and any N3 finding outranks N1 or N2.</p>
        </div>
        <div className="tnm-stage-badge tnm-stage-badge--n">
          <span>Computed N</span>
          <strong>{derived.n}</strong>
        </div>
      </div>

      <div className="tnm-nmap-layout">
        <div className="tnm-map-shell">
          <div className="button-row button-row--wrap">
            <button
              className={`control-pill${primarySide === 'right' ? ' control-pill--active' : ''}`}
              onClick={() => setPrimarySide('right')}
              type="button"
            >
              Right primary
            </button>
            <button
              className={`control-pill${primarySide === 'left' ? ' control-pill--active' : ''}`}
              onClick={() => setPrimarySide('left')}
              type="button"
            >
              Left primary
            </button>
            <button className="control-pill" onClick={() => setStationStatuses(getInitialStationStatuses())} type="button">
              Reset stations
            </button>
          </div>
          <StationMap
            layout={layout}
            onSelect={cycleStation}
            selectedStationId={selectedStationId}
            stationStatuses={stationStatuses}
            stations={stations}
          />
          <div className="tnm-status-legend">
            {(['unassessed', 'sampled-negative', 'positive'] as const).map((status) => (
              <span key={status} className={`tnm-status-pill tnm-status-pill--${status}`}>
                {statusLabels[status]}
              </span>
            ))}
          </div>
        </div>

        <aside className="tnm-result-panel">
          <div className="eyebrow">N-stage explanation</div>
          <h3>{derived.n}</h3>
          <p>{derived.explanation}</p>

          <div className="tnm-external-nodes">
            <strong>External N3 groups</strong>
            {externalRules.map((rule) => {
              const status = stationStatuses[rule.stationId] ?? 'unassessed';

              return (
                <button
                  key={rule.stationId}
                  className={`tnm-status-button tnm-status-button--${status}`}
                  onClick={() =>
                    setStationStatuses((current) => ({
                      ...current,
                      [rule.stationId]: getNextStationStatus(current[rule.stationId] ?? 'unassessed'),
                    }))
                  }
                  type="button"
                >
                  <span>{rule.label}</span>
                  <strong>{statusLabels[status]}</strong>
                </button>
              );
            })}
          </div>

          {derived.missingSystematicStations.length > 0 ? (
            <aside className="tnm-change-callout tnm-change-callout--warning">
              <strong>Systematic staging reminder</strong>
              <p>
                4R, 4L, and 7 are commonly expected in systematic EBUS staging. Still unassessed:{' '}
                {derived.missingSystematicStations.join(', ')}. Work from N3 to N2 to N1 when staging.
              </p>
            </aside>
          ) : (
            <aside className="tnm-change-callout">
              <strong>Systematic staging reminder</strong>
              <p>4R, 4L, and 7 have each been assessed in this teaching map.</p>
            </aside>
          )}

          <div className="tnm-station-summary">
            <strong>{selectedStation ? selectedStation.displayName : 'Selected station'}</strong>
            <p>
              {selectedStation
                ? `${selectedStation.shortLabel}: ${statusLabels[stationStatuses[selectedStation.id] ?? 'unassessed']}`
                : 'Tap a station to cycle through unassessed, sampled negative, and positive.'}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function CasesTab() {
  const { recordTnmCaseAttempt, setLastViewedTnmCase, setModuleProgress, state } = useLearnerProgress();
  const tags = useMemo(() => unique(tnmCases.flatMap((tnmCase) => tnmCase.focusTags)).sort(), []);
  const initialCase = tnmCases.find((tnmCase) => tnmCase.id === state.lastViewedTnmCaseId) ?? tnmCases[0];
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedCaseId, setSelectedCaseId] = useState(initialCase?.id ?? '');
  const [answer, setAnswer] = useState<TnmSelection>(getInitialTnmSelection);
  const [score, setScore] = useState<ReturnType<typeof scoreTnmCase> | null>(null);
  const filteredCases = selectedTag === 'all' ? tnmCases : tnmCases.filter((tnmCase) => tnmCase.focusTags.includes(selectedTag));
  const selectedCase = tnmCases.find((tnmCase) => tnmCase.id === selectedCaseId) ?? filteredCases[0] ?? tnmCases[0];
  const selectedStage = stageTnm(answer).stage;

  useEffect(() => {
    if (selectedCase && !filteredCases.some((tnmCase) => tnmCase.id === selectedCase.id)) {
      setSelectedCaseId(filteredCases[0]?.id ?? tnmCases[0]?.id ?? '');
    }
  }, [filteredCases, selectedCase]);

  useEffect(() => {
    if (selectedCase) {
      setLastViewedTnmCase(selectedCase.id);
    }
  }, [selectedCase, setLastViewedTnmCase]);

  function updateAnswer<TKey extends keyof TnmSelection>(key: TKey, value: TnmSelection[TKey]) {
    setAnswer((current) => ({
      ...current,
      [key]: value,
    }));
    setScore(null);
  }

  function submitCaseAnswer() {
    if (!selectedCase) {
      return;
    }

    const nextScore = scoreTnmCase(selectedCase, answer);
    const alreadyAttempted = Boolean(state.tnmCaseStats[selectedCase.id]?.attempts);
    const nextAttemptedCount = Object.keys(state.tnmCaseStats).length + (alreadyAttempted ? 0 : 1);

    setScore(nextScore);
    recordTnmCaseAttempt(selectedCase.id, selectedCase.focusTags, nextScore.correct);
    setModuleProgress('tnm-staging', nextAttemptedCount >= tnmCases.length ? 100 : nextScore.correct ? 92 : 85, nextAttemptedCount >= tnmCases.length);
  }

  return (
    <section className="section-card tnm-panel">
      <div className="section-card__heading">
        <div>
          <div className="eyebrow">Case scenarios</div>
          <h2>Assign TNM, then compare the stage and rationale</h2>
          <p>Cases are local JSON content and intentionally focus on descriptor traps rather than diagnostic validation.</p>
        </div>
        <span className="tag">{Object.keys(state.tnmCaseStats).length}/{tnmCases.length} cases attempted</span>
      </div>

      <div className="button-row button-row--wrap">
        <button className={`control-pill${selectedTag === 'all' ? ' control-pill--active' : ''}`} onClick={() => setSelectedTag('all')} type="button">
          All
        </button>
        {tags.map((tag) => (
          <button
            key={tag}
            className={`control-pill${selectedTag === tag ? ' control-pill--active' : ''}`}
            onClick={() => setSelectedTag(tag)}
            type="button"
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="tnm-case-layout">
        <div className="tnm-case-list">
          {filteredCases.map((tnmCase) => {
            const stat = state.tnmCaseStats[tnmCase.id];

            return (
              <button
                key={tnmCase.id}
                className={`tnm-case-list-item${selectedCase?.id === tnmCase.id ? ' tnm-case-list-item--active' : ''}`}
                onClick={() => {
                  setSelectedCaseId(tnmCase.id);
                  setScore(null);
                }}
                type="button"
              >
                <strong>{tnmCase.title}</strong>
                <span>{tnmCase.difficulty}</span>
                {stat ? <small>{stat.correct}/{stat.attempts} correct</small> : <small>Not attempted</small>}
              </button>
            );
          })}
        </div>

        {selectedCase ? (
          <div className="tnm-case-workspace">
            <article className="tnm-case-stem">
              <div className="eyebrow">{selectedCase.difficulty} case</div>
              <h3>{selectedCase.title}</h3>
              <div className="tnm-case-findings">
                <div>
                  <strong>CT</strong>
                  <ul className="plain-list">
                    {selectedCase.ctFindings.map((finding) => (
                      <li key={finding}>{finding}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>PET</strong>
                  <ul className="plain-list">
                    {selectedCase.petFindings.map((finding) => (
                      <li key={finding}>{finding}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>EBUS</strong>
                  <ul className="plain-list">
                    {selectedCase.ebusFindings.map((finding) => (
                      <li key={finding}>{finding}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="tag-row">
                {selectedCase.focusTags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </article>

            <div className="tnm-case-answer">
              <SelectorGroup
                label="Your T"
                onChange={(value: TnmStageableTCategory) => updateAnswer('t', value)}
                options={tnmStageMatrix.tCategories}
                value={answer.t}
              />
              <SelectorGroup
                label="Your N"
                onChange={(value: TnmStageableNCategory) => updateAnswer('n', value)}
                options={tnmStageMatrix.nCategories}
                value={answer.n}
              />
              <SelectorGroup
                label="Your M"
                onChange={(value: TnmMCategory) => updateAnswer('m', value)}
                options={tnmStageMatrix.mCategories}
                value={answer.m}
              />
              <div className="button-row button-row--wrap">
                <span className="tnm-stage-badge">
                  <span>Your stage</span>
                  <strong>{selectedStage}</strong>
                </span>
                <button className="button" onClick={submitCaseAnswer} type="button">
                  Check case
                </button>
              </div>
            </div>

            {score ? (
              <article className={`tnm-case-feedback${score.correct ? ' tnm-case-feedback--correct' : ''}`}>
                <div className="eyebrow">Feedback</div>
                <h3>{score.correct ? 'Correct TNM assignment' : `${score.correctCount}/${score.totalCount} fields matched`}</h3>
                <p>
                  Expected {selectedCase.expected.t}
                  {selectedCase.expected.n}
                  {selectedCase.expected.m}, stage {score.expectedStage}. Your stage was {score.selectedStage}.
                </p>
                <p>{score.feedback}</p>
              </article>
            ) : null}

            {Object.keys(state.tnmTagStats).length > 0 ? (
              <div className="tnm-tag-performance">
                <strong>Tag performance</strong>
                <div className="tag-row">
                  {Object.entries(state.tnmTagStats)
                    .sort(([left], [right]) => left.localeCompare(right))
                    .slice(0, 12)
                    .map(([tag, stat]) => (
                      <span key={tag} className="tag">
                        {tag}: {stat.correct}/{stat.attempts}
                      </span>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function TnmStagingPage() {
  const { setModuleProgress } = useLearnerProgress();
  const [activeTab, setActiveTab] = useState<TnmTabId>('reference');
  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  useEffect(() => {
    setModuleProgress('tnm-staging', activeTabMeta.progress);
  }, [activeTabMeta.progress, setModuleProgress]);

  return (
    <div className="page-stack tnm-page">
      <section className="section-card tnm-hero">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Module</div>
            <h2 className="page-title">IASLC 9th Edition TNM Staging</h2>
            <p>
              A compact staging workbench for T descriptors, N2a/N2b nodal logic, M1c1/M1c2 metastatic burden, and
              case-based practice.
            </p>
          </div>
          <div className="tag-row">
            <span className="tag">{tnmCases.length} cases</span>
            <span className="tag">{tnmReferenceCards.length} reference cards</span>
          </div>
        </div>
        <nav className="sub-tab-row" aria-label="TNM staging tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`control-pill sub-tab-row__link${activeTab === tab.id ? ' control-pill--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </section>

      {activeTab === 'reference' ? <ReferenceTab /> : null}
      {activeTab === 'stager' ? <StagerTab /> : null}
      {activeTab === 't-builder' ? <TBuilderTab /> : null}
      {activeTab === 'n-map' ? <NMapTab /> : null}
      {activeTab === 'cases' ? <CasesTab /> : null}
    </div>
  );
}
