import { useEffect, useState } from 'react';

import { Accordion, AccordionPanel } from '@/components/Accordion';
import {
  LandmarkChecklist,
  RelatedImagesStrip,
  StationBoundaryCard,
  StationStagingSummary,
} from '@/components/education/EducationModuleRenderer';
import { getStationMediaVariants, getStationPrimaryMedia } from '@/content/media';
import { getViewLabel, zoneThemes } from '@/content/stations';
import type { CombinedStation, ExplorerViewId, StationAnnotationSet } from '@/content/types';

function getAnnotationTone(label: string): 'station' | 'structure' {
  return label.toLowerCase().includes('station') ? 'station' : 'structure';
}

function getLabelAnchor(points: Array<[number, number]>): { x: number; y: number } {
  const total = points.reduce(
    (sum, [x, y]) => ({
      x: sum.x + x,
      y: sum.y + y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

function AnnotationOverlay({
  annotations,
  isVisible,
}: {
  annotations: StationAnnotationSet;
  isVisible: boolean;
}) {
  return (
    <svg
      aria-hidden={!isVisible}
      className={`media-slot__annotations${isVisible ? ' media-slot__annotations--visible' : ''}`}
      preserveAspectRatio="xMidYMid meet"
      viewBox={`0 0 ${annotations.width} ${annotations.height}`}
    >
      {annotations.regions.map((region, index) => {
        const anchor = getLabelAnchor(region.points);
        const tone = getAnnotationTone(region.label);

        return (
          <g key={`${region.label}-${index}`}>
            <polygon
              className={`media-slot__annotation media-slot__annotation--${tone}`}
              points={region.points.map(([x, y]) => `${x},${y}`).join(' ')}
            />
            <text
              className={`media-slot__annotation-label media-slot__annotation-label--${tone}`}
              textAnchor="middle"
              x={anchor.x}
              y={anchor.y}
            >
              {region.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MediaSlot({
  station,
  viewId,
}: {
  station: CombinedStation;
  viewId: ExplorerViewId;
}) {
  const variants = getStationMediaVariants(station.media, viewId);
  const view = station.views[viewId];
  const firstVariantId = variants[0]?.id ?? '';
  const [selectedVariantId, setSelectedVariantId] = useState(firstVariantId);
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setSelectedVariantId(firstVariantId);
    setIsPinned(false);
    setIsHovered(false);
  }, [firstVariantId, station.id, viewId]);

  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? variants[0];
  const hasRevealImage = Boolean(selectedVariant?.image && selectedVariant.revealImage);
  const hasAnnotations = Boolean(selectedVariant?.annotations);
  const revealAvailable = hasRevealImage || hasAnnotations;
  const revealVisible = revealAvailable && (isPinned || isHovered);
  const frameSource = selectedVariant?.image ?? selectedVariant?.revealImage;

  return (
    <article className="media-slot">
      <div className="media-slot__eyebrow">
        <span>{getViewLabel(viewId)}</span>
        <span>{view.focusLabel}</span>
      </div>

      {variants.length > 1 || revealAvailable ? (
        <div className="media-slot__controls">
          {variants.length > 1 ? (
            <div className="button-row button-row--wrap" role="tablist" aria-label={`${station.id} ${getViewLabel(viewId)} views`}>
              {variants.map((variant) => (
                <button
                  key={variant.id}
                  aria-selected={selectedVariant?.id === variant.id}
                  className={`control-pill${selectedVariant?.id === variant.id ? ' control-pill--active' : ''}`}
                  onClick={() => {
                    setSelectedVariantId(variant.id);
                    setIsPinned(false);
                  }}
                  role="tab"
                  type="button"
                >
                  {variant.label}
                </button>
              ))}
            </div>
          ) : null}

          {revealAvailable ? (
            <button
              className={`control-pill${revealVisible ? ' control-pill--active' : ''}`}
              onClick={() => setIsPinned((current) => !current)}
              type="button"
            >
              {isPinned ? 'Hide labels' : 'Pin labels'}
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        aria-label={revealAvailable ? `Click to ${isPinned ? 'hide' : 'show'} labels` : undefined}
        className={`media-slot__frame media-slot__frame--${view.visualAnchor}${revealAvailable ? ' media-slot__frame--interactive' : ''}`}
        onClick={() => {
          if (revealAvailable) {
            setIsPinned((current) => !current);
          }
        }}
        onKeyDown={(event) => {
          if (!revealAvailable) {
            return;
          }

          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsPinned((current) => !current);
          }
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role={revealAvailable ? 'button' : undefined}
        tabIndex={revealAvailable ? 0 : undefined}
      >
        {frameSource ? (
          <>
            <img
              alt={`${station.id} ${getViewLabel(viewId)} correlate${selectedVariant?.label ? ` (${selectedVariant.label})` : ''}`}
              className="media-slot__image"
              src={frameSource}
            />
            {hasRevealImage ? (
              <img
                alt=""
                aria-hidden="true"
                className={`media-slot__overlay${revealVisible ? ' media-slot__overlay--visible' : ''}`}
                src={selectedVariant?.revealImage}
              />
            ) : null}
            {selectedVariant?.annotations ? (
              <AnnotationOverlay annotations={selectedVariant.annotations} isVisible={revealVisible} />
            ) : null}
            {revealAvailable ? (
              <div className={`media-slot__hint${revealVisible ? ' media-slot__hint--active' : ''}`}>
                {revealVisible ? 'Labels visible' : 'Hover or tap to reveal labels'}
              </div>
            ) : null}
          </>
        ) : (
          <div className="media-slot__placeholder">
            <span>{getViewLabel(viewId)}</span>
            <strong>{view.orientation}</strong>
            <p>{station.media.notes?.[0] ?? 'Media manifest is ready for this slot.'}</p>
          </div>
        )}
      </div>
      <p className="media-slot__caption">{view.caption}</p>
      {selectedVariant?.note ? <p className="media-slot__note">{selectedVariant.note}</p> : null}
    </article>
  );
}

export function StationDetail({
  station,
  isBookmarked,
  onToggleBookmark,
}: {
  station: CombinedStation;
  isBookmarked: boolean;
  onToggleBookmark: (stationId: string) => void;
}) {
  const theme = zoneThemes[station.zoneKey];
  const relatedImages = (['ct', 'bronchoscopy', 'ultrasound'] as const).flatMap((viewId) => {
    const primary = getStationPrimaryMedia(station.media, viewId);

    if (!primary || primary.kind !== 'image') {
      return [];
    }

    return [
      {
        id: `${station.id}-${viewId}`,
        label: `${station.id} ${getViewLabel(viewId)}`,
        src: primary.src,
      },
    ];
  });

  return (
    <section className="detail-card" style={{ ['--detail-accent' as string]: theme.border }}>
      <div className="detail-card__header">
        <div>
          <div className="detail-card__meta">
            <span className="chip chip--accent">{station.id}</span>
            <span className="chip">{theme.label}</span>
            <span className="chip">{station.laterality}</span>
            <span className="chip">{station.iaslcName}</span>
          </div>
          <h2>{station.displayName}</h2>
          <p>{station.description}</p>
        </div>
        <button
          aria-pressed={isBookmarked}
          className={`action-pill${isBookmarked ? ' action-pill--active' : ''}`}
          onClick={() => onToggleBookmark(station.id)}
          type="button"
        >
          {isBookmarked ? 'Bookmarked' : 'Bookmark'}
        </button>
      </div>

      <div className="detail-card__hero">
        <div className="media-grid media-grid--hero">
          <MediaSlot station={station} viewId="ct" />
          <MediaSlot station={station} viewId="bronchoscopy" />
        </div>
        <div className="detail-card__ebus-facts-row">
          <MediaSlot station={station} viewId="ultrasound" />
          <article className="stack-card reference-card detail-card__quick-facts">
            <div className="eyebrow">Quick facts</div>
            <h3>{station.id} at a glance</h3>
            <div className="tag-row">
              <span className="tag">{theme.label}</span>
              <span className="tag">{station.laterality}</span>
              <span className="tag">{station.iaslcName}</span>
              {station.aliases.map((alias) => (
                <span key={alias} className="tag">
                  {alias}
                </span>
              ))}
            </div>
            <p>
              <strong>Access:</strong> {station.accessProfile}
            </p>
            <p>
              <strong>Best EBUS window:</strong> {station.bestEbusWindow}
            </p>
          </article>
        </div>
        <RelatedImagesStrip items={relatedImages} />
      </div>

      <Accordion>
        <AccordionPanel defaultOpen id="glance" title="At a Glance">
          <div className="detail-card__panel-grid">
            <div className="stack-card reference-card">
              <div className="eyebrow">Access & EBUS window</div>
              <p>
                <strong>Access:</strong> {station.accessProfile}
              </p>
              <p>
                <strong>Best EBUS window:</strong> {station.bestEbusWindow}
              </p>
              <p>{station.accessNotes}</p>
            </div>
          </div>
        </AccordionPanel>

        <AccordionPanel id="boundaries" title="Anatomic Boundaries">
          <StationBoundaryCard boundary={station.boundaryDefinition} notes={station.boundaryNotes} />
        </AccordionPanel>

        <AccordionPanel id="what-you-see" title="What You Should See">
          <div className="detail-card__panel-grid">
            <div className="education-card reference-card">
              <div className="eyebrow">CT</div>
              <ul className="plain-list education-list">
                {station.whatYouSee.ct.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="education-card reference-card">
              <div className="eyebrow">Bronchoscopy</div>
              <ul className="plain-list education-list">
                {station.whatYouSee.bronchoscopy.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="education-card reference-card">
              <div className="eyebrow">EBUS</div>
              <ul className="plain-list education-list">
                {station.whatYouSee.ultrasound.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </AccordionPanel>

        <AccordionPanel id="staging" title="Staging & Clinical Impact">
          <div className="detail-card__panel-grid">
            <div className="education-card reference-card">
              <div className="eyebrow">Staging summary</div>
              <StationStagingSummary accessProfile={station.accessProfile} staging={station.nStageImplication} />
            </div>
            <div className="education-card reference-card">
              <div className="eyebrow">Why this station matters</div>
              <p>{station.clinicalImportance}</p>
              <p>
                <strong>Staging impact:</strong> {station.stagingChangeFinding}
              </p>
            </div>
          </div>
        </AccordionPanel>

        <AccordionPanel id="memory-aids" title="Memory Aids">
          <div className="detail-card__panel-grid">
            <div className="education-card reference-card">
              <div className="eyebrow">Memory cues</div>
              <ul className="plain-list education-list">
                {station.memoryCues.map((cue) => (
                  <li key={cue}>{cue}</li>
                ))}
              </ul>
            </div>
            <div className="education-card reference-card">
              <div className="eyebrow">Common confusion pairs</div>
              <p>
                <strong>Most common:</strong> {station.commonConfusionPair}
              </p>
              <div className="tag-row">
                {station.confusionPairs.map((pair) => (
                  <span key={pair} className="tag">
                    {pair}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </AccordionPanel>

        <AccordionPanel id="landmarks-safety" title="Landmarks & Safety">
          <div className="detail-card__panel-grid">
            <LandmarkChecklist items={station.landmarkChecklist} />
            <div className="education-card reference-card">
              <div className="eyebrow">Landmark vessels</div>
              <div className="tag-row">
                {station.landmarkVessels.map((vessel) => (
                  <span key={vessel} className="tag">
                    {vessel}
                  </span>
                ))}
              </div>
            </div>
            <div className="education-card reference-card">
              <div className="eyebrow">Safe puncture considerations</div>
              <ul className="plain-list education-list">
                {station.safePunctureConsiderations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </AccordionPanel>
      </Accordion>
    </section>
  );
}
