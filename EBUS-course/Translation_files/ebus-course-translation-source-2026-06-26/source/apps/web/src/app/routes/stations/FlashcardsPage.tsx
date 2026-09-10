import { useState } from 'react';

import { useLearnerProgress } from '@/lib/progress';

import { useStationsRouteContext } from './context';

function shuffle<T>(items: T[]): T[] {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = current;
  }

  return next;
}

export function StationsFlashcardsPage() {
  const { mapContent, stations } = useStationsRouteContext();
  const { setModuleProgress } = useLearnerProgress();
  const [flashcardOrder, setFlashcardOrder] = useState(() => stations.map((station) => station.id));
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardRevealed, setFlashcardRevealed] = useState(false);
  const currentFlashcard = stations.find((station) => station.id === flashcardOrder[flashcardIndex]) ?? stations[0];

  if (!currentFlashcard) {
    return null;
  }

  function toggleReveal() {
    setFlashcardRevealed((current) => !current);
    setModuleProgress('station-map', 45);
  }

  return (
    <section className="section-card interactive-card">
      <div className="section-card__heading">
        <div>
          <div className="eyebrow">Flashcards</div>
          <h2>{mapContent.flashcardPrompt}</h2>
        </div>
        <div className="button-row button-row--wrap">
          <span className="tag">
            Card {flashcardIndex + 1} of {flashcardOrder.length}
          </span>
          <button
            className="button button--ghost"
            onClick={() => {
              setFlashcardOrder(shuffle(stations.map((station) => station.id)));
              setFlashcardIndex(0);
              setFlashcardRevealed(false);
              setModuleProgress('station-map', 50);
            }}
            type="button"
          >
            Shuffle
          </button>
        </div>
      </div>

      <div
        aria-label={`Flashcard for ${currentFlashcard.displayName}`}
        className="flashcard interactive-card"
        onClick={toggleReveal}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleReveal();
          }
        }}
        role="button"
        tabIndex={0}
      >
        {!flashcardRevealed ? (
          <>
            <div className="flashcard__station">{currentFlashcard.id}</div>
            <span>Tap to reveal</span>
          </>
        ) : (
          <>
            <h3>{currentFlashcard.displayName}</h3>
            <p>{currentFlashcard.description}</p>
            <span>{currentFlashcard.iaslcName}</span>
            <span>{currentFlashcard.memoryCues[0]}</span>
          </>
        )}
      </div>

      <div className="button-row">
        <button
          className="button button--ghost"
          onClick={() => {
            setFlashcardIndex((index) => (index - 1 + flashcardOrder.length) % flashcardOrder.length);
            setFlashcardRevealed(false);
          }}
          type="button"
        >
          Previous
        </button>
        <button
          className="button"
          onClick={() => {
            setFlashcardIndex((index) => (index + 1) % flashcardOrder.length);
            setFlashcardRevealed(false);
          }}
          type="button"
        >
          Next
        </button>
      </div>
    </section>
  );
}
