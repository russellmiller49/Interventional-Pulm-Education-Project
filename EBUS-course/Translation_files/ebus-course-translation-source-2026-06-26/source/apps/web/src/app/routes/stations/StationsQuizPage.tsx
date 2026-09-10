import { useEffect, useState } from 'react';

import { StationMap } from '@/features/stations/StationMap';
import { useLearnerProgress } from '@/lib/progress';

import { useStationsRouteContext } from './context';

export function StationsQuizPage() {
  const { layout, mapContent, selectedStation, selectedStationId, selectStation, stations } = useStationsRouteContext();
  const { recordRecognitionAttempt, setModuleProgress, state } = useLearnerProgress();
  const [mapQuizIndex, setMapQuizIndex] = useState(0);
  const [mapQuizAnswer, setMapQuizAnswer] = useState<string | null>(null);
  const [challengeAnswer, setChallengeAnswer] = useState<string | null>(null);
  const currentQuizRound = mapContent.quizRounds[mapQuizIndex] ?? mapContent.quizRounds[0];
  const challengePrompt = selectedStation?.quizItems[0];
  const challengeStat = selectedStation ? state.stationRecognitionStats[selectedStation.id] : undefined;

  useEffect(() => {
    setChallengeAnswer(null);
  }, [selectedStationId]);

  if (!currentQuizRound) {
    return null;
  }

  return (
    <div className="page-stack">
      <section className="section-card interactive-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Pin-The-Station Quiz</div>
            <h2>{currentQuizRound.prompt}</h2>
          </div>
        </div>
        <StationMap
          correctStationId={mapQuizAnswer ? currentQuizRound.stationId : null}
          layout={layout}
          onSelect={(stationId) => {
            setMapQuizAnswer(stationId);
            if (stationId === currentQuizRound.stationId) {
              setModuleProgress(
                'station-map',
                mapQuizIndex === mapContent.quizRounds.length - 1 ? 100 : 70,
                mapQuizIndex === mapContent.quizRounds.length - 1,
              );
            }
          }}
          quizMode
          selectedStationId={mapQuizAnswer}
          stations={stations}
        />
        <div className={`feedback-banner${mapQuizAnswer === currentQuizRound.stationId ? ' feedback-banner--success' : ''}`}>
          <strong>{mapQuizAnswer ? (mapQuizAnswer === currentQuizRound.stationId ? 'Correct Station' : 'Not Quite') : 'Hint'}</strong>
          <p>{mapQuizAnswer ? currentQuizRound.explanation : currentQuizRound.hint}</p>
        </div>
        <div className="button-row">
          <button
            className="button button--ghost"
            disabled={mapQuizIndex === 0}
            onClick={() => {
              setMapQuizIndex((index) => index - 1);
              setMapQuizAnswer(null);
            }}
            type="button"
          >
            Previous
          </button>
          <button
            className="button"
            disabled={mapQuizIndex === mapContent.quizRounds.length - 1}
            onClick={() => {
              setMapQuizIndex((index) => index + 1);
              setMapQuizAnswer(null);
            }}
            type="button"
          >
            Next
          </button>
        </div>
      </section>

      <section className="section-card interactive-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Recognition Challenge</div>
            <h2>{challengePrompt?.prompt ?? 'Select a station to load a challenge.'}</h2>
          </div>
        </div>

        <div className="button-row button-row--wrap" role="tablist" aria-label="Select station for recognition challenge">
          {stations.map((station) => (
            <button
              key={station.id}
              aria-selected={selectedStationId === station.id}
              className={`control-pill${selectedStationId === station.id ? ' control-pill--active' : ''}`}
              onClick={() => selectStation(station.id)}
              role="tab"
              type="button"
            >
              {station.id}
            </button>
          ))}
        </div>

        {selectedStation && challengePrompt ? (
          <>
            <div className="stack-list">
              {challengePrompt.optionIds.map((optionId) => {
                const optionStation = stations.find((station) => station.id === optionId);

                return (
                  <button
                    key={optionId}
                    className={`choice-card${challengeAnswer === optionId ? ' choice-card--selected' : ''}${
                      challengeAnswer
                        ? optionId === selectedStation.id
                          ? ' choice-card--correct'
                          : challengeAnswer === optionId
                            ? ' choice-card--incorrect'
                            : ''
                        : ''
                    }`}
                    onClick={() => {
                      setChallengeAnswer(optionId);
                      recordRecognitionAttempt(selectedStation.id, optionId === selectedStation.id);
                      setModuleProgress('station-explorer', optionId === selectedStation.id ? 80 : 55);
                    }}
                    type="button"
                  >
                    <strong>{optionStation?.displayName ?? optionId}</strong>
                    <span>{optionStation?.iaslcName ?? optionId}</span>
                  </button>
                );
              })}
            </div>
            <div className={`feedback-banner${challengeAnswer === selectedStation.id ? ' feedback-banner--success' : ''}`}>
              <strong>{challengeAnswer ? (challengeAnswer === selectedStation.id ? 'Correct' : 'Review The Correlate') : 'Use the station selector above'}</strong>
              <p>
                {challengeAnswer
                  ? challengePrompt.explanation
                  : 'Switch between stations here, then use the explore tab if you want to revisit the synchronized CT, bronchoscopy, and EBUS views before answering.'}
              </p>
              {challengeStat ? (
                <p>
                  {challengeStat.correct}/{challengeStat.attempts} correct for {selectedStation.id}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
