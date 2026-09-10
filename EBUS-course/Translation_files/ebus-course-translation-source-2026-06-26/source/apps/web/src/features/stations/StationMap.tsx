import { stationConnections, zoneThemes } from '@/content/stations';
import type { CombinedStation, StationMapLayout, StationMapLandmark, TnmStationStatusValue } from '@/content/types';
import { StationNode } from '@/features/stations/StationNode';
import { resolveCourseAssetPath } from '@/lib/assets';

const STATION_MAP_IMAGE_SRC = '/media/stations/clean_mediastinum.png';
const STATION_MAP_QUIZ_IMAGE_SRC = '/media/stations/clean_mediastinum_unlabeled.jpg';

function renderLandmark(landmark: StationMapLandmark) {
  const style = {
    left: `${(landmark.x / 320) * 100}%`,
    top: `${(landmark.y / 420) * 100}%`,
    width: `${(landmark.width / 320) * 100}%`,
    height: `${(landmark.height / 420) * 100}%`,
    transform: `rotate(${landmark.rotation}deg)`,
  };

  return <div key={landmark.id} className={`station-map__landmark station-map__landmark--${landmark.kind}`} style={style} />;
}

export function StationMap({
  layout,
  stations,
  selectedStationId,
  correctStationId,
  onSelect,
  quizMode,
  stationStatuses,
}: {
  layout: StationMapLayout;
  stations: CombinedStation[];
  selectedStationId: string | null;
  correctStationId?: string | null;
  onSelect: (stationId: string) => void;
  quizMode?: boolean;
  stationStatuses?: Record<string, TnmStationStatusValue | undefined>;
}) {
  const stationLookup = Object.fromEntries(stations.map((station) => [station.id, station]));

  return (
    <div className={`station-map${quizMode ? ' station-map--quiz' : ''}`}>
      <img
        alt={quizMode ? 'Unlabeled mediastinal station quiz schematic' : 'Mediastinal anatomy and lymph node station schematic'}
        className={`station-map__image${quizMode ? ' station-map__image--quiz' : ''}`}
        src={resolveCourseAssetPath(quizMode ? STATION_MAP_QUIZ_IMAGE_SRC : STATION_MAP_IMAGE_SRC)}
      />
      {quizMode ? (
        <>
          <div className="station-map__quiz-scrim" />
          <svg className="station-map__connections" viewBox={`0 0 ${layout.designWidth} ${layout.designHeight}`} aria-hidden="true">
            {stationConnections.map((connection) => {
              const from = stationLookup[connection.from];
              const to = stationLookup[connection.to];

              if (!from || !to) {
                return null;
              }

              return (
                <line
                  key={`${connection.from}-${connection.to}`}
                  x1={from.mapNode.x + from.mapNode.width / 2}
                  x2={to.mapNode.x + to.mapNode.width / 2}
                  y1={from.mapNode.y + from.mapNode.height / 2}
                  y2={to.mapNode.y + to.mapNode.height / 2}
                />
              );
            })}
          </svg>
        </>
      ) : null}
      {layout.landmarks.map(renderLandmark)}
      {!quizMode ? (
        <>
          <div className="station-map__zone station-map__zone--upper">{zoneThemes.upper.label}</div>
          <div className="station-map__zone station-map__zone--subcarinal">{zoneThemes.subcarinal.label}</div>
          <div className="station-map__zone station-map__zone--hilar">{zoneThemes.hilar.label}</div>
        </>
      ) : null}
      {stations.map((station) => (
        <StationNode
          key={station.id}
          isQuizMode={quizMode}
          isCorrectAnswer={correctStationId === station.id}
          isSelected={selectedStationId === station.id}
          onSelect={onSelect}
          station={station}
          status={stationStatuses?.[station.id]}
        />
      ))}
    </div>
  );
}
