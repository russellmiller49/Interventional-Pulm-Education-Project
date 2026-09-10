import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { getStationExplorerContent, getStationMapContent, getStationMapLayout, getStations } from '@/content/stations';
import { useLearnerProgress } from '@/lib/progress';
import type { StationsRouteContextValue } from '@/app/routes/stations/context';

const mapContent = getStationMapContent();
const explorerContent = getStationExplorerContent();
const layout = getStationMapLayout();
const stations = getStations();

const stationTabs = [
  { id: 'explore', label: 'Explore', to: 'explore' },
  { id: 'sonographic-interpretation', label: 'Sonographic Interpretation', to: 'sonographic-interpretation' },
  { id: 'flashcards', label: 'Flashcards', to: 'flashcards' },
  { id: 'quiz', label: 'Quiz', to: 'quiz' },
  { id: 'handbook', label: 'Handbook', to: 'handbook' },
] as const;

export function StationsPage() {
  const { state, setLastViewedStation, setModuleProgress } = useLearnerProgress();
  const [selectedStationId, setSelectedStationId] = useState<string>(state.lastViewedStationId ?? stations[0]?.id ?? '');
  const selectedStation = stations.find((station) => station.id === selectedStationId);

  useEffect(() => {
    if (selectedStationId) {
      setLastViewedStation(selectedStationId);
      setModuleProgress('station-map', 35);
      setModuleProgress('station-explorer', 25);
    }
  }, [selectedStationId, setLastViewedStation, setModuleProgress]);

  const contextValue = useMemo<StationsRouteContextValue>(
    () => ({
      explorerContent,
      layout,
      mapContent,
      selectedStation,
      selectedStationId,
      selectStation: setSelectedStationId,
      stations,
    }),
    [selectedStation, selectedStationId],
  );

  return (
    <div className="page-stack">
      <section className="section-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Module</div>
            <h2 className="page-title">Mediastinal Stations</h2>
            <p>Move between map study, flashcards, quizzes, and handbook content without losing your place.</p>
          </div>
          <div className="tag-row">
            <span className="tag">{stations.length} core stations</span>
            {selectedStation ? <span className="tag">Selected: {selectedStation.id}</span> : null}
          </div>
        </div>
        <nav className="sub-tab-row" aria-label="Station sub-modules">
          {stationTabs.map((tab) => (
            <NavLink
              key={tab.id}
              className={({ isActive }) => `control-pill sub-tab-row__link${isActive ? ' control-pill--active' : ''}`}
              to={tab.to}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </section>

      <Outlet context={contextValue} />
    </div>
  );
}
