import { EmptyState } from '@/components/EmptyState';
import { StationDetail } from '@/features/stations/StationDetail';
import { StationMap } from '@/features/stations/StationMap';
import { useCourseShellText } from '@/i18n/courseShell';
import { useLearnerProgress } from '@/lib/progress';

import { useStationsRouteContext } from './context';

export function StationsExplorePage() {
  const t = useCourseShellText();
  const { explorerContent, layout, mapContent, selectedStation, selectedStationId, selectStation, stations } =
    useStationsRouteContext();
  const { state, toggleStationBookmark } = useLearnerProgress();

  return (
    <div className="page-stack">
      <section className="section-card reference-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">{t('Explore')}</div>
            <h2>{t('Read the mediastinum as map first, then correlate the images')}</h2>
            {explorerContent.extensionNote ? <p>{explorerContent.extensionNote}</p> : null}
          </div>
        </div>
        <div className="mini-card-grid">
          {mapContent.introSections.map((section) => (
            <article key={section.id} className="mini-card reference-card">
              <strong>{section.title}</strong>
              <p>{section.summary}</p>
              <span>{section.takeaway}</span>
            </article>
          ))}
          {explorerContent.introSections.map((section) => (
            <article key={section.id} className="mini-card reference-card">
              <strong>{section.title}</strong>
              <p>{section.summary}</p>
              <span>{section.takeaway}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card interactive-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">{t('Map Explore')}</div>
            <h2>{t('Core IASLC stations with synchronized detail')}</h2>
          </div>
          <span className="tag">{stations.length} {t('stations loaded')}</span>
        </div>
        <div className="split-grid split-grid--map">
          <div className="stack-card interactive-card">
            <StationMap
              layout={layout}
              onSelect={selectStation}
              selectedStationId={selectedStationId}
              stations={stations}
            />
            <div className="tag-row">
              {mapContent.mapTips.map((tip) => (
                <span key={tip} className="tag">
                  {tip}
                </span>
              ))}
            </div>
          </div>

          <div>
            {selectedStation ? (
              <StationDetail
                isBookmarked={state.bookmarkedStations.includes(selectedStation.id)}
                onToggleBookmark={toggleStationBookmark}
                station={selectedStation}
              />
            ) : (
              <EmptyState
                detail={t('Select a station from the map to open the correlate images, accordion sections, and bookmark action.')}
                icon="◎"
                title={t('No Station Selected')}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
