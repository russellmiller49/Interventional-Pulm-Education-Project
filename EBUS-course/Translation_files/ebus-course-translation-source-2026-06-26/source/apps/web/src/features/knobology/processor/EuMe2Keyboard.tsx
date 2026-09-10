import type { PointerEvent as ReactPointerEvent } from 'react';
import { useRef, useState } from 'react';

import type { KnobologyMenuMode, KnobologyProcessorActionId } from '@/features/knobology/logic';
import type { EuMe2Hotspot, EuMe2Layout } from '@/features/knobology/processor/types';

function getHotspotStyle(hotspot: EuMe2Hotspot) {
  if (hotspot.shape === 'rect') {
    return {
      left: `${hotspot.x * 100}%`,
      top: `${hotspot.y * 100}%`,
      width: `${hotspot.w * 100}%`,
      height: `${hotspot.h * 100}%`,
    };
  }

  if (hotspot.shape === 'ellipse') {
    return {
      left: `${(hotspot.cx - hotspot.rx) * 100}%`,
      top: `${(hotspot.cy - hotspot.ry) * 100}%`,
      width: `${hotspot.rx * 200}%`,
      height: `${hotspot.ry * 200}%`,
      borderRadius: '999px',
    };
  }

  return {
    left: `${(hotspot.cx - hotspot.r) * 100}%`,
    top: `${(hotspot.cy - hotspot.r) * 100}%`,
    width: `${hotspot.r * 200}%`,
    height: `${hotspot.r * 200}%`,
    borderRadius: '999px',
  };
}

function getRegionStyle(region: { x: number; y: number; w: number; h: number }) {
  return {
    left: `${region.x * 100}%`,
    top: `${region.y * 100}%`,
    width: `${region.w * 100}%`,
    height: `${region.h * 100}%`,
  };
}

function getPanelCropStyle(region: { x: number; y: number; w: number; h: number }) {
  return {
    left: `${-(region.x / region.w) * 100}%`,
    top: `${-(region.y / region.h) * 100}%`,
    width: `${(1 / region.w) * 100}%`,
    height: `${(1 / region.h) * 100}%`,
  };
}

export function EuMe2Keyboard({
  activeActionId,
  debug = false,
  layout,
  menuMode = 'none',
  onAction,
  onHotspotPointerDown,
  onHotspotSelect,
  onTrackballMove,
  selectedHotspotId = null,
  showHotspotHints = false,
  trackballActive = false,
}: {
  activeActionId?: KnobologyProcessorActionId | null;
  debug?: boolean;
  layout: EuMe2Layout;
  menuMode?: KnobologyMenuMode;
  onAction?: (actionId: KnobologyProcessorActionId) => void;
  onHotspotPointerDown?: (hotspotId: string, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onHotspotSelect?: (hotspotId: string) => void;
  onTrackballMove?: (delta: { x: number; y: number }) => void;
  selectedHotspotId?: string | null;
  showHotspotHints?: boolean;
  trackballActive?: boolean;
}) {
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);
  const [pressedHotspotId, setPressedHotspotId] = useState<string | null>(null);
  const [trackballDragging, setTrackballDragging] = useState(false);
  const lastTrackballPointRef = useRef<{ x: number; y: number } | null>(null);
  const editorMode = Boolean(onHotspotSelect || onHotspotPointerDown);
  const showHotspotLabels = debug || editorMode;
  const touchPanelRegion = layout.regions.touchPanel;
  const imageAdjustPanel = menuMode === 'image-adjust' ? layout.imageAdjustPanel : undefined;
  const panelCropRegion = imageAdjustPanel?.sourceRegion ?? touchPanelRegion;
  const caption = imageAdjustPanel?.image.notes ?? layout.image.notes;
  const figureClassName = [
    'eu-me2',
    debug ? 'eu-me2--debug' : '',
    showHotspotHints ? 'eu-me2--hinted' : '',
    editorMode ? 'eu-me2--editor' : '',
    imageAdjustPanel ? 'eu-me2--image-adjust' : '',
  ]
    .filter(Boolean)
    .join(' ');

  function handleTrackballDelta(delta: { x: number; y: number }) {
    if (delta.x === 0 && delta.y === 0) {
      return;
    }

    onTrackballMove?.(delta);
  }

  return (
    <figure className={figureClassName}>
      <div className="eu-me2__frame" style={{ aspectRatio: `${layout.image.width} / ${layout.image.height}` }}>
        <img alt="Olympus EU-ME2 processor keyboard" className="eu-me2__image" src={layout.image.src} />
        {imageAdjustPanel && touchPanelRegion ? (
          <div
            aria-hidden="true"
            className="eu-me2__panel-viewport"
            style={getRegionStyle(touchPanelRegion)}
          >
            <img
              alt=""
              className="eu-me2__panel-image"
              src={imageAdjustPanel.image.src}
              style={getPanelCropStyle(panelCropRegion)}
            />
          </div>
        ) : null}
        <div className="eu-me2__overlay">
          {onTrackballMove ? (
            <button
              aria-label="Trackball"
              className={`eu-me2__trackball-control${trackballActive ? ' eu-me2__trackball-control--active' : ''}${trackballDragging ? ' eu-me2__trackball-control--dragging' : ''}`}
              onBlur={() => {
                setTrackballDragging(false);
                lastTrackballPointRef.current = null;
              }}
              onLostPointerCapture={() => {
                setTrackballDragging(false);
                lastTrackballPointRef.current = null;
              }}
              onPointerCancel={() => {
                setTrackballDragging(false);
                lastTrackballPointRef.current = null;
              }}
              onPointerDown={(event) => {
                setTrackballDragging(true);
                lastTrackballPointRef.current = {
                  x: event.clientX,
                  y: event.clientY,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (!trackballDragging || !lastTrackballPointRef.current) {
                  return;
                }

                const delta = {
                  x: event.clientX - lastTrackballPointRef.current.x,
                  y: event.clientY - lastTrackballPointRef.current.y,
                };

                lastTrackballPointRef.current = {
                  x: event.clientX,
                  y: event.clientY,
                };
                handleTrackballDelta(delta);
              }}
              onPointerUp={() => {
                setTrackballDragging(false);
                lastTrackballPointRef.current = null;
              }}
              onWheel={(event) => {
                event.preventDefault();
                handleTrackballDelta({
                  x: event.shiftKey ? event.deltaY : event.deltaX,
                  y: event.deltaY,
                });
              }}
              style={getHotspotStyle({
                action: 'CURSOR_MODE',
                cx: layout.trackball.cx,
                cy: layout.trackball.cy,
                id: 'trackball-control',
                label: 'Trackball',
                r: layout.trackball.r,
                shape: 'circle',
              })}
              type="button"
            >
              <span className="sr-only">Trackball</span>
            </button>
          ) : null}

          {debug ? (
            <>
              <div
                className="eu-me2__trackball"
                style={getHotspotStyle({
                  action: 'B_MODE',
                  cx: layout.trackball.cx,
                  cy: layout.trackball.cy,
                  id: 'trackball',
                  label: 'Trackball',
                  r: layout.trackball.r,
                  shape: 'circle',
                })}
              >
                <span>Trackball</span>
              </div>
              {Object.entries(layout.regions).map(([regionId, region]) => (
                <div
                  key={regionId}
                  className="eu-me2__region"
                  style={getRegionStyle(region)}
                >
                  <span>{regionId}</span>
                </div>
              ))}
            </>
          ) : null}

          {layout.hotspots.map((hotspot) => {
            const isActive =
              hoveredHotspotId === hotspot.id ||
              pressedHotspotId === hotspot.id ||
              activeActionId === hotspot.action ||
              selectedHotspotId === hotspot.id;

            return (
              <button
                key={hotspot.id}
                aria-label={`${hotspot.label} (${hotspot.action})`}
                aria-pressed={editorMode ? selectedHotspotId === hotspot.id : activeActionId === hotspot.action}
                className={`eu-me2__hotspot eu-me2__hotspot--${hotspot.shape}${isActive ? ' eu-me2__hotspot--active' : ''}${selectedHotspotId === hotspot.id ? ' eu-me2__hotspot--selected' : ''}`}
                onBlur={() => setHoveredHotspotId((current) => (current === hotspot.id ? null : current))}
                onClick={() => {
                  if (editorMode) {
                    onHotspotSelect?.(hotspot.id);
                    return;
                  }

                  onAction?.(hotspot.action);
                }}
                onFocus={() => setHoveredHotspotId(hotspot.id)}
                onMouseEnter={() => setHoveredHotspotId(hotspot.id)}
                onMouseLeave={() => {
                  setHoveredHotspotId((current) => (current === hotspot.id ? null : current));
                  setPressedHotspotId((current) => (current === hotspot.id ? null : current));
                }}
                onPointerDown={(event) => {
                  setPressedHotspotId(hotspot.id);
                  onHotspotPointerDown?.(hotspot.id, event);
                }}
                onPointerUp={() => setPressedHotspotId((current) => (current === hotspot.id ? null : current))}
                style={getHotspotStyle(hotspot)}
                type="button"
              >
                <span className="sr-only">{hotspot.label}</span>
                {showHotspotLabels ? (
                  <span className="eu-me2__hotspot-label">
                    {hotspot.label}
                    <small>{hotspot.action}</small>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <figcaption className="eu-me2__caption">{caption}</figcaption>
    </figure>
  );
}
