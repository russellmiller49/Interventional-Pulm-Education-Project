import { useMemo, useReducer, useRef, useState } from 'react';

import { axisNameToIndex } from '../../../../../features/case3d/patient-space';
import type { CasePlane, RuntimeCaseManifest, SliceIndex } from '../../../../../features/case3d/types';
import { useCaseOverlay } from './useCaseOverlay';
import { useCasePlanes } from './useCasePlanes';
import { useCaseVolume } from './useCaseVolume';
import { VtkViewport } from './VtkViewport';
import { caseViewerReducer, createInitialViewerState } from './viewerState';
import { getCrosshairWorld } from './vtk/coordinateTransforms';
import type { LoadedCaseVolume } from './vtk/loadCaseVolume';
import type { LoadedSegmentation } from './vtk/loadSegmentation';
import type { CaseViewerState, OrthogonalClipMode } from './viewerState';

interface Case3DViewerProps {
  manifest: RuntimeCaseManifest;
}

const PLANE_LABELS: Record<CasePlane, string> = {
  axial: 'Axial',
  coronal: 'Coronal',
  sagittal: 'Sagittal',
};
const CASE_PLANES: CasePlane[] = ['axial', 'coronal', 'sagittal'];

const SEGMENT_GROUP_SORT_ORDER: Record<string, number> = {
  airway: 0,
  vessels: 1,
  cardiac: 2,
  gi: 3,
  other: 4,
  nodes: 5,
};
const EMPTY_SEGMENTS: RuntimeCaseManifest['segmentation']['segments'] = [];

function getPlaneAxisSize(manifest: RuntimeCaseManifest, plane: CasePlane) {
  return manifest.volumeGeometry.sizes[axisNameToIndex(manifest.volumeGeometry.axisMap[plane])];
}

function SliceCard({
  compact = false,
  manifest,
  plane,
  planeIndex,
  crosshairWorld,
  overlayOpacity,
  segmentationRef,
  selectedSegments,
  showSegmentationOverlay,
  visibleSegments,
  volumeReady,
  volumeRef,
  onPlaneIndexChange,
}: {
  compact?: boolean;
  manifest: RuntimeCaseManifest;
  plane: CasePlane;
  planeIndex: number;
  crosshairWorld: [number, number, number];
  overlayOpacity: number;
  segmentationRef: { current: LoadedSegmentation | null };
  selectedSegments: RuntimeCaseManifest['segmentation']['segments'];
  showSegmentationOverlay: boolean;
  visibleSegments: RuntimeCaseManifest['segmentation']['segments'];
  volumeReady: boolean;
  volumeRef: { current: LoadedCaseVolume | null };
  onPlaneIndexChange: (value: number) => void;
}) {
  const axisSize = getPlaneAxisSize(manifest, plane);

  return (
    <article className={`case3d-panel case3d-slice-card${compact ? ' case3d-slice-card--compact' : ''}`}>
      <div className="case3d-panel__header">
        <div>
          <div className="eyebrow">Orthogonal CT</div>
          <h3>{PLANE_LABELS[plane]}</h3>
        </div>
      </div>
      <div className="case3d-panel__viewport">
        {volumeReady ? (
          <>
            <VtkViewport
              className="case-vtk-viewport"
              crosshairWorld={crosshairWorld}
              hasSegmentation={showSegmentationOverlay}
              hasVolume={volumeReady}
              manifest={manifest}
              mode="slice"
              overlayOpacity={overlayOpacity}
              plane={plane}
              planeIndex={planeIndex}
              segmentationRef={segmentationRef}
              selectedSegments={showSegmentationOverlay ? selectedSegments : EMPTY_SEGMENTS}
              showSegmentationOverlay={showSegmentationOverlay}
              visible
              visibleSegments={showSegmentationOverlay ? visibleSegments : EMPTY_SEGMENTS}
              volumeRef={volumeRef}
            />
          </>
        ) : (
          <div className="case3d-panel__placeholder">Loading CT volume…</div>
        )}
      </div>
      <label className="case3d-slider">
        <span>
          Slice {planeIndex + 1} / {axisSize}
        </span>
        <input
          max={axisSize - 1}
          min={0}
          onChange={(event) => onPlaneIndexChange(Number(event.target.value))}
          type="range"
          value={planeIndex}
        />
      </label>
    </article>
  );
}

function OrthogonalPlaneControls({
  manifest,
  orthogonalClipMode,
  orthogonalClipPlane,
  orthogonalPlaneOpacity,
  planeIndices,
  planeVisibility,
  threeDOrthogonalPlanesVisible,
  onOrthogonalClipModeChange,
  onOrthogonalClipPlaneChange,
  onOrthogonalPlaneOpacityChange,
  onPlaneIndexChange,
  onPlaneVisibilityChange,
  onThreeDOrthogonalPlanesVisibilityChange,
}: {
  manifest: RuntimeCaseManifest;
  orthogonalClipMode: OrthogonalClipMode;
  orthogonalClipPlane: CasePlane;
  orthogonalPlaneOpacity: number;
  planeIndices: SliceIndex;
  planeVisibility: Record<CasePlane, boolean>;
  threeDOrthogonalPlanesVisible: boolean;
  onOrthogonalClipModeChange: (mode: OrthogonalClipMode) => void;
  onOrthogonalClipPlaneChange: (plane: CasePlane) => void;
  onOrthogonalPlaneOpacityChange: (value: number) => void;
  onPlaneIndexChange: (plane: CasePlane, value: number) => void;
  onPlaneVisibilityChange: (plane: CasePlane, visible: boolean) => void;
  onThreeDOrthogonalPlanesVisibilityChange: (visible: boolean) => void;
}) {
  return (
    <section className="case3d-hero__control-group">
      <div>
        <div className="eyebrow">3D CT</div>
        <h4 className="case3d-hero__control-title">Orthogonal planes</h4>
      </div>
      <label className="case3d-toggle">
        <input
          checked={threeDOrthogonalPlanesVisible}
          onChange={(event) => onThreeDOrthogonalPlanesVisibilityChange(event.target.checked)}
          type="checkbox"
        />
        <span>Show 3D CT planes</span>
      </label>
      <div className="case3d-toggle-list">
        <label className="case3d-toggle">
          <input
            checked={planeVisibility.axial}
            disabled={!threeDOrthogonalPlanesVisible}
            onChange={(event) => onPlaneVisibilityChange('axial', event.target.checked)}
            type="checkbox"
          />
          <span>Axial</span>
        </label>
        <label className="case3d-toggle">
          <input
            checked={planeVisibility.coronal}
            disabled={!threeDOrthogonalPlanesVisible}
            onChange={(event) => onPlaneVisibilityChange('coronal', event.target.checked)}
            type="checkbox"
          />
          <span>Coronal</span>
        </label>
        <label className="case3d-toggle">
          <input
            checked={planeVisibility.sagittal}
            disabled={!threeDOrthogonalPlanesVisible}
            onChange={(event) => onPlaneVisibilityChange('sagittal', event.target.checked)}
            type="checkbox"
          />
          <span>Sagittal</span>
        </label>
      </div>
      <div className="case3d-plane-slider-list">
        {CASE_PLANES.map((plane) => {
          const axisSize = getPlaneAxisSize(manifest, plane);

          return (
            <label className="case3d-slider" key={plane}>
              <span>
                {PLANE_LABELS[plane]} {planeIndices[plane] + 1} / {axisSize}
              </span>
              <input
                max={axisSize - 1}
                min={0}
                onChange={(event) => onPlaneIndexChange(plane, Number(event.target.value))}
                type="range"
                value={planeIndices[plane]}
              />
            </label>
          );
        })}
      </div>
      <label className="case3d-slider">
        <span>3D CT plane opacity</span>
        <input
          max={1}
          min={0}
          onChange={(event) => onOrthogonalPlaneOpacityChange(Number(event.target.value))}
          step={0.01}
          type="range"
          value={orthogonalPlaneOpacity}
        />
      </label>
      <label className="case3d-select">
        <span>3D anatomy clipping</span>
        <select
          onChange={(event) => onOrthogonalClipModeChange(event.target.value as OrthogonalClipMode)}
          value={orthogonalClipMode}>
          <option value="none">No clipping</option>
          <option value="hide-above">Hide above CT plane</option>
          <option value="hide-below">Hide below CT plane</option>
        </select>
      </label>
      <label className="case3d-select">
        <span>Clipping plane</span>
        <select
          disabled={orthogonalClipMode === 'none'}
          onChange={(event) => onOrthogonalClipPlaneChange(event.target.value as CasePlane)}
          value={orthogonalClipPlane}>
          <option value="axial">Axial</option>
          <option value="coronal">Coronal</option>
          <option value="sagittal">Sagittal</option>
        </select>
      </label>
    </section>
  );
}

function ThreeDSceneControls({
  manifest,
  onOrthogonalClipModeChange,
  onOrthogonalClipPlaneChange,
  onOrthogonalPlaneOpacityChange,
  onOverlayOpacityChange,
  onPlaneIndexChange,
  onPlaneVisibilityChange,
  onResetCamera,
  onThreeDOrthogonalPlanesVisibilityChange,
  orthogonalClipMode,
  orthogonalClipPlane,
  orthogonalPlaneOpacity,
  overlayOpacity,
  planeIndices,
  planeVisibility,
  threeDOrthogonalPlanesVisible,
}: {
  manifest: RuntimeCaseManifest;
  onOrthogonalClipModeChange: (mode: OrthogonalClipMode) => void;
  onOrthogonalClipPlaneChange: (plane: CasePlane) => void;
  onOrthogonalPlaneOpacityChange: (value: number) => void;
  onOverlayOpacityChange: (value: number) => void;
  onPlaneIndexChange: (plane: CasePlane, value: number) => void;
  onPlaneVisibilityChange: (plane: CasePlane, visible: boolean) => void;
  onResetCamera?: () => void;
  onThreeDOrthogonalPlanesVisibilityChange: (visible: boolean) => void;
  orthogonalClipMode: OrthogonalClipMode;
  orthogonalClipPlane: CasePlane;
  orthogonalPlaneOpacity: number;
  overlayOpacity: number;
  planeIndices: SliceIndex;
  planeVisibility: Record<CasePlane, boolean>;
  threeDOrthogonalPlanesVisible: boolean;
}) {
  return (
    <>
      <section className="case3d-hero__control-group">
        <div>
          <div className="eyebrow">3D Anatomy</div>
          <h4 className="case3d-hero__control-title">Surface opacity</h4>
        </div>
        <label className="case3d-slider">
          <span>Anatomy opacity</span>
          <input
            max={1}
            min={0.05}
            onChange={(event) => onOverlayOpacityChange(Number(event.target.value))}
            step={0.01}
            type="range"
            value={overlayOpacity}
          />
        </label>
      </section>

      <OrthogonalPlaneControls
        manifest={manifest}
        onOrthogonalClipModeChange={onOrthogonalClipModeChange}
        onOrthogonalClipPlaneChange={onOrthogonalClipPlaneChange}
        onOrthogonalPlaneOpacityChange={onOrthogonalPlaneOpacityChange}
        onPlaneIndexChange={onPlaneIndexChange}
        onPlaneVisibilityChange={onPlaneVisibilityChange}
        onThreeDOrthogonalPlanesVisibilityChange={onThreeDOrthogonalPlanesVisibilityChange}
        orthogonalClipMode={orthogonalClipMode}
        orthogonalClipPlane={orthogonalClipPlane}
        orthogonalPlaneOpacity={orthogonalPlaneOpacity}
        planeIndices={planeIndices}
        planeVisibility={planeVisibility}
        threeDOrthogonalPlanesVisible={threeDOrthogonalPlanesVisible}
      />

      {onResetCamera ? (
        <button className="case3d-button case3d-button--secondary" onClick={onResetCamera} type="button">
          Reset camera
        </button>
      ) : null}
    </>
  );
}

function StructureVisibilityControls({
  anatomySegments,
  hiddenSegmentIds,
  nodalSegments,
  nodalSegmentIds,
  overlayGroups,
  onNodalSegmentsVisibilityChange,
  onOverlayGroupChange,
  onSegmentVisibilityChange,
}: {
  anatomySegments: RuntimeCaseManifest['segmentation']['segments'];
  hiddenSegmentIds: string[];
  nodalSegments: RuntimeCaseManifest['segmentation']['segments'];
  nodalSegmentIds: string[];
  overlayGroups: CaseViewerState['overlayGroups'];
  onNodalSegmentsVisibilityChange: (segmentIds: string[], visible: boolean) => void;
  onOverlayGroupChange: (key: keyof CaseViewerState['overlayGroups'], value: boolean) => void;
  onSegmentVisibilityChange: (segmentId: string, visible: boolean) => void;
}) {
  return (
    <section className="case3d-hero__control-group">
      <div>
        <div className="eyebrow">Visibility</div>
        <h4 className="case3d-hero__control-title">Structures</h4>
      </div>
      <div className="case3d-toggle-list case3d-toggle-list--columns">
        <label className="case3d-toggle">
          <input
            checked={overlayGroups.allAnatomy}
            onChange={(event) => onOverlayGroupChange('allAnatomy', event.target.checked)}
            type="checkbox"
          />
          <span>All anatomy</span>
        </label>
        <label className="case3d-toggle">
          <input
            checked={overlayGroups.airway}
            onChange={(event) => onOverlayGroupChange('airway', event.target.checked)}
            type="checkbox"
          />
          <span>Airway</span>
        </label>
        <label className="case3d-toggle">
          <input
            checked={overlayGroups.vessels}
            onChange={(event) => onOverlayGroupChange('vessels', event.target.checked)}
            type="checkbox"
          />
          <span>Vessels</span>
        </label>
        <label className="case3d-toggle">
          <input
            checked={overlayGroups.nodes}
            onChange={(event) => onOverlayGroupChange('nodes', event.target.checked)}
            type="checkbox"
          />
          <span>Nodes</span>
        </label>
      </div>
      <div className="case3d-segment-section">
        <strong className="case3d-segment-section__title">Anatomy structures</strong>
        <div className="case3d-segment-list">
          {anatomySegments.map((segment) => (
            <label className="case3d-toggle" key={segment.id}>
              <input
                checked={!hiddenSegmentIds.includes(segment.id)}
                onChange={(event) => onSegmentVisibilityChange(segment.id, event.target.checked)}
                type="checkbox"
              />
              <span>{segment.name}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="case3d-segment-section">
        <div className="case3d-segment-section__heading">
          <strong className="case3d-segment-section__title">Lymph nodes</strong>
          <div className="case3d-button-row">
            <button
              className="case3d-button case3d-button--secondary"
              onClick={() => onNodalSegmentsVisibilityChange(nodalSegmentIds, false)}
              type="button">
              Hide all
            </button>
            <button
              className="case3d-button case3d-button--secondary"
              onClick={() => onNodalSegmentsVisibilityChange(nodalSegmentIds, true)}
              type="button">
              Show all
            </button>
          </div>
        </div>
        <div className="case3d-segment-list">
          {nodalSegments.map((segment) => (
            <label className="case3d-toggle" key={segment.id}>
              <input
                checked={!hiddenSegmentIds.includes(segment.id)}
                onChange={(event) => onNodalSegmentsVisibilityChange([segment.id], event.target.checked)}
                type="checkbox"
              />
              <span>{segment.name}</span>
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Case3DViewer({ manifest }: Case3DViewerProps) {
  const [state, dispatch] = useReducer(caseViewerReducer, manifest, createInitialViewerState);
  const [resetCameraToken, setResetCameraToken] = useState(0);
  const volumeState = useCaseVolume();
  const volumeRef = useRef<LoadedCaseVolume | null>(null);
  const segmentationRef = useRef<LoadedSegmentation | null>(null);

  volumeRef.current = volumeState.ct;
  segmentationRef.current = volumeState.segmentation;
  const crosshairWorld = useMemo(() => getCrosshairWorld(manifest, state.crosshairVoxel), [manifest, state.crosshairVoxel]);
  const { planeIndices } = useCasePlanes(manifest, state.crosshairVoxel, crosshairWorld);
  const { selectedSegmentIds, visibleSegments } = useCaseOverlay(
    manifest,
    state.overlayGroups,
    '',
    state.hiddenSegmentIds,
  );
  const selectedSegments = useMemo(
    () => visibleSegments.filter((segment) => selectedSegmentIds.has(segment.id)),
    [selectedSegmentIds, visibleSegments],
  );
  const stationOrder = useMemo(
    () => new Map(manifest.stations.map((station, index) => [station.id, index])),
    [manifest.stations],
  );
  const anatomySegments = useMemo(
    () =>
      manifest.segmentation.segments
        .filter((segment) => segment.groupId !== 'nodes')
        .sort((left, right) => {
          const groupWeight = SEGMENT_GROUP_SORT_ORDER[left.groupId] - SEGMENT_GROUP_SORT_ORDER[right.groupId];

          return groupWeight !== 0 ? groupWeight : left.name.localeCompare(right.name);
        }),
    [manifest.segmentation.segments],
  );
  const nodalSegments = useMemo(
    () =>
      manifest.segmentation.segments
        .filter((segment) => segment.groupId === 'nodes')
        .sort((left, right) => {
          const leftOrder = stationOrder.get(left.stationIds[0] ?? '') ?? Number.MAX_SAFE_INTEGER;
          const rightOrder = stationOrder.get(right.stationIds[0] ?? '') ?? Number.MAX_SAFE_INTEGER;
          return leftOrder !== rightOrder ? leftOrder - rightOrder : left.name.localeCompare(right.name);
        }),
    [manifest.segmentation.segments, stationOrder],
  );
  const nodalSegmentIds = useMemo(() => nodalSegments.map((segment) => segment.id), [nodalSegments]);
  const threeDPlaneVisibility = state.threeDOrthogonalPlanesVisible
    ? state.planeVisibility
    : {
        axial: false,
        coronal: false,
        sagittal: false,
      };

  const sceneControlProps = {
    manifest,
    onOrthogonalClipModeChange: (mode: OrthogonalClipMode) => dispatch({ type: 'set-orthogonal-clip-mode', mode }),
    onOrthogonalClipPlaneChange: (plane: CasePlane) => dispatch({ type: 'set-orthogonal-clip-plane', plane }),
    onOrthogonalPlaneOpacityChange: (value: number) => dispatch({ type: 'set-three-d-plane-opacity', value }),
    onOverlayOpacityChange: (value: number) => dispatch({ type: 'set-overlay-opacity', value }),
    onPlaneIndexChange: (plane: CasePlane, value: number) =>
      dispatch({ type: 'set-plane-axis-index', plane, axisIndex: value, manifest }),
    onPlaneVisibilityChange: (plane: CasePlane, visible: boolean) =>
      dispatch({ type: 'set-plane-visibility', plane, visible }),
    onThreeDOrthogonalPlanesVisibilityChange: (visible: boolean) =>
      dispatch({ type: 'set-three-d-plane-visibility', visible }),
    orthogonalClipMode: state.orthogonalClip.mode,
    orthogonalClipPlane: state.orthogonalClip.plane,
    orthogonalPlaneOpacity: state.orthogonalPlaneOpacity,
    overlayOpacity: state.overlayOpacity,
    planeIndices,
    planeVisibility: state.planeVisibility,
    threeDOrthogonalPlanesVisible: state.threeDOrthogonalPlanesVisible,
  } satisfies Parameters<typeof ThreeDSceneControls>[0];

  function setNodalSegmentsVisible(segmentIds: string[], visible: boolean) {
    dispatch({ type: 'set-overlay-group', key: 'nodes', value: true });
    dispatch({ type: 'set-segments-visibility', segmentIds, visible });
  }

  const module = (
    <div className="case3d-fullscreen-module">
      <aside className="case3d-control-panel" aria-label="Scene controls">
        <div className="case3d-panel__header">
          <div>
            <div className="eyebrow">Scene Controls</div>
            <h3>Anatomy workspace</h3>
          </div>
        </div>
        <ThreeDSceneControls
          {...sceneControlProps}
          onResetCamera={() => setResetCameraToken((value) => value + 1)}
        />
        <StructureVisibilityControls
          anatomySegments={anatomySegments}
          hiddenSegmentIds={state.hiddenSegmentIds}
          nodalSegmentIds={nodalSegmentIds}
          nodalSegments={nodalSegments}
          onNodalSegmentsVisibilityChange={setNodalSegmentsVisible}
          onOverlayGroupChange={(key, value) => dispatch({ type: 'set-overlay-group', key, value })}
          onSegmentVisibilityChange={(segmentId, visible) =>
            dispatch({ type: 'set-segment-visibility', segmentId, visible })
          }
          overlayGroups={state.overlayGroups}
        />
      </aside>

      <main className="case3d-scene-panel">
        <div className="case3d-scene-panel__header">
          <div>
            <div className="eyebrow">Shared Scene</div>
            <h2>3D patient-space view</h2>
          </div>
          <button className="case3d-button case3d-button--secondary" onClick={() => setResetCameraToken((value) => value + 1)} type="button">
            Reset camera
          </button>
        </div>
        <div className="case3d-panel__viewport case3d-panel__viewport--hero">
          <div className="case3d-scene-hint">Shift + drag moves the model. Drag rotates.</div>
          {volumeState.loading ? (
            <div className="case3d-panel__placeholder">Loading case geometry…</div>
          ) : volumeState.error ? (
            <div className="case3d-panel__placeholder">{volumeState.error}</div>
          ) : (
            <VtkViewport
              className="case-vtk-viewport"
              cutPlaneNormal={state.cutPlane.normal}
              cutPlaneOpacity={state.cutPlane.opacity}
              cutPlaneOrigin={state.cutPlane.origin}
              cutPlaneVisible={state.cutPlane.visible}
              crosshairWorld={crosshairWorld}
              hasSegmentation={Boolean(volumeState.segmentation)}
              hasVolume={Boolean(volumeState.ct)}
              manifest={manifest}
              mode="three-d"
              onCutPlaneChange={(origin, normal) => dispatch({ type: 'set-cut-plane', origin, normal })}
              onScenePointPick={(world) => dispatch({ type: 'set-crosshair-world', world, manifest })}
              orthogonalClipMode={state.orthogonalClip.mode}
              orthogonalClipPlane={state.orthogonalClip.plane}
              orthogonalPlaneOpacity={state.orthogonalPlaneOpacity}
              overlayOpacity={state.overlayOpacity}
              planeIndices={planeIndices}
              planeVisibility={threeDPlaneVisibility}
              resetCameraToken={resetCameraToken}
              selectedSegments={selectedSegments}
              segmentationRef={segmentationRef}
              showGlb
              visibleSegments={visibleSegments}
              volumeRef={volumeRef}
            />
          )}
        </div>
      </main>

      <aside className="case3d-ct-strip" aria-label="Orthogonal CT slices">
        <div className="case3d-ct-strip__header">
          <div>
            <div className="eyebrow">Orthogonal CT</div>
            <h3>Synced slices</h3>
          </div>
          <label className="case3d-toggle case3d-ct-overlay-toggle">
            <input
              checked={state.sliceSegmentationVisible}
              onChange={(event) => dispatch({ type: 'set-slice-segmentation-visibility', visible: event.target.checked })}
              type="checkbox"
            />
            <span>Show 2D overlay</span>
          </label>
        </div>
        <SliceCard
          compact
          crosshairWorld={crosshairWorld}
          manifest={manifest}
          overlayOpacity={state.overlayOpacity}
          onPlaneIndexChange={(value) => dispatch({ type: 'set-plane-axis-index', plane: 'axial', axisIndex: value, manifest })}
          plane="axial"
          planeIndex={planeIndices.axial}
          segmentationRef={segmentationRef}
          selectedSegments={selectedSegments}
          showSegmentationOverlay={state.sliceSegmentationVisible}
          visibleSegments={visibleSegments}
          volumeReady={Boolean(volumeState.ct)}
          volumeRef={volumeRef}
        />
        <SliceCard
          compact
          crosshairWorld={crosshairWorld}
          manifest={manifest}
          overlayOpacity={state.overlayOpacity}
          onPlaneIndexChange={(value) =>
            dispatch({ type: 'set-plane-axis-index', plane: 'coronal', axisIndex: value, manifest })
          }
          plane="coronal"
          planeIndex={planeIndices.coronal}
          segmentationRef={segmentationRef}
          selectedSegments={selectedSegments}
          showSegmentationOverlay={state.sliceSegmentationVisible}
          visibleSegments={visibleSegments}
          volumeReady={Boolean(volumeState.ct)}
          volumeRef={volumeRef}
        />
        <SliceCard
          compact
          crosshairWorld={crosshairWorld}
          manifest={manifest}
          overlayOpacity={state.overlayOpacity}
          onPlaneIndexChange={(value) =>
            dispatch({ type: 'set-plane-axis-index', plane: 'sagittal', axisIndex: value, manifest })
          }
          plane="sagittal"
          planeIndex={planeIndices.sagittal}
          segmentationRef={segmentationRef}
          selectedSegments={selectedSegments}
          showSegmentationOverlay={state.sliceSegmentationVisible}
          visibleSegments={visibleSegments}
          volumeReady={Boolean(volumeState.ct)}
          volumeRef={volumeRef}
        />
      </aside>
    </div>
  );

  return module;
}
