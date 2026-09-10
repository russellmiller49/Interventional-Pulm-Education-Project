import { useEffect, useMemo, useRef } from 'react';

// Side-effect import required for vtk.js rendering backends.
import '@kitware/vtk.js/Rendering/Profiles/All';
import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
import vtkInteractorStyleImage from '@kitware/vtk.js/Interaction/Style/InteractorStyleImage';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import vtkCellPicker from '@kitware/vtk.js/Rendering/Core/CellPicker';
import vtkWidgetManager from '@kitware/vtk.js/Widgets/Core/WidgetManager';
import { ViewTypes } from '@kitware/vtk.js/Widgets/Core/WidgetManager/Constants';
import vtkImplicitPlaneWidget from '@kitware/vtk.js/Widgets/Widgets3D/ImplicitPlaneWidget';

import { case001AssetUrls } from './case001';
import { createCrosshairActors, updateCrosshairActors } from './vtk/buildCrosshair';
import { loadGlbOverlay } from './vtk/buildGlbOverlay';
import { createCutPlaneSlice } from './vtk/buildCutPlane';
import { createOrthogonalPlaneActor } from './vtk/buildOrthogonalPlanes';
import { createSegmentationSliceOverlay } from './vtk/buildSegmentationSliceOverlay';
import { createSegmentationSurfaceActor } from './vtk/buildSegmentationSurface';
import { createSliceCrosshairActors, updateSliceCrosshairActors } from './vtk/buildSliceCrosshair';
import {
  boundsToExtent,
  getBoundsCenter,
  getBoundsRadius,
  getPlaneCameraDistanceSign,
  getPlaneCameraPosition,
  getPlaneCenterWorld,
  getPlaneNormalWorld,
  getPlaneViewUp,
} from './vtk/coordinateTransforms';
import { normalizeStructureKey } from './structureKeys';

import { crossVectors, normalizeVector } from '../../../../../features/case3d/patient-space';
import type { LoadedCaseVolume } from './vtk/loadCaseVolume';
import type { LoadedSegmentation } from './vtk/loadSegmentation';
import type { OrthogonalClipMode } from './viewerState';
import type { vtkPlane as VtkPlane } from '@kitware/vtk.js/Common/DataModel/Plane';
import type {
  CasePlane,
  RuntimeCaseManifest,
  SegmentationSegment,
  SliceIndex,
  Vector3Tuple,
} from '../../../../../features/case3d/types';

interface CommonViewportProps {
  className?: string;
}

interface SliceViewportProps extends CommonViewportProps {
  mode: 'slice';
  manifest: RuntimeCaseManifest;
  hasSegmentation: boolean;
  hasVolume: boolean;
  plane: CasePlane;
  planeIndex: number;
  crosshairWorld: Vector3Tuple;
  overlayOpacity: number;
  showSegmentationOverlay: boolean;
  visibleSegments: SegmentationSegment[];
  selectedSegments: SegmentationSegment[];
  visible: boolean;
  segmentationRef: { current: LoadedSegmentation | null };
  volumeRef: { current: LoadedCaseVolume | null };
}

interface CutViewportProps extends CommonViewportProps {
  mode: 'cut';
  hasSegmentation?: boolean;
  hasVolume: boolean;
  manifest: RuntimeCaseManifest;
  origin: Vector3Tuple;
  normal: Vector3Tuple;
  opacity: number;
  visible: boolean;
  segmentationRef?: { current: LoadedSegmentation | null };
  volumeRef: { current: LoadedCaseVolume | null };
}

interface ThreeDViewportProps extends CommonViewportProps {
  mode: 'three-d';
  hasSegmentation: boolean;
  hasVolume: boolean;
  manifest: RuntimeCaseManifest;
  planeIndices: SliceIndex;
  planeVisibility: Record<CasePlane, boolean>;
  orthogonalClipMode: OrthogonalClipMode;
  orthogonalClipPlane: CasePlane;
  crosshairWorld: Vector3Tuple;
  orthogonalPlaneOpacity: number;
  overlayOpacity: number;
  visibleSegments: SegmentationSegment[];
  selectedSegments: SegmentationSegment[];
  cutPlaneOrigin: Vector3Tuple;
  cutPlaneNormal: Vector3Tuple;
  cutPlaneOpacity: number;
  cutPlaneVisible: boolean;
  showGlb: boolean;
  resetCameraToken: number;
  onCutPlaneChange: (origin: Vector3Tuple, normal: Vector3Tuple) => void;
  onScenePointPick?: (world: Vector3Tuple) => void;
  segmentationRef: { current: LoadedSegmentation | null };
  volumeRef: { current: LoadedCaseVolume | null };
}

type VtkViewportProps = SliceViewportProps | CutViewportProps | ThreeDViewportProps;

type SliceOverlayBundle = Exclude<ReturnType<typeof createSegmentationSliceOverlay>, null> & {
  signature: string;
};

type SegmentationSurfaceBundle = Exclude<ReturnType<typeof createSegmentationSurfaceActor>, null> & {
  signature: string;
};

type SlicePipeline = {
  actor: ReturnType<typeof createOrthogonalPlaneActor>['actor'];
  crosshair: ReturnType<typeof createSliceCrosshairActors>;
  mapper: ReturnType<typeof createOrthogonalPlaneActor>['mapper'];
  overlayActors: Map<string, SliceOverlayBundle>;
};

type CutPipeline = ReturnType<typeof createCutPlaneSlice>;

type ThreeDPipeline = {
  planeActors: Record<CasePlane, ReturnType<typeof createOrthogonalPlaneActor>>;
  crosshair: ReturnType<typeof createCrosshairActors>;
  cutSlice: ReturnType<typeof createCutPlaneSlice>;
  orthogonalClipPlane: VtkPlane;
  widgetFactory: any;
  widgetManager: vtkWidgetManager;
  widgetSubscription: { unsubscribe: () => void } | null;
  interactionSubscriptions: Array<{ unsubscribe: () => void }>;
  segmentationActors: Map<string, SegmentationSurfaceBundle>;
  selectedActor: Exclude<ReturnType<typeof createSegmentationSurfaceActor>, null> | null;
  glbImporter: Awaited<ReturnType<typeof loadGlbOverlay>> | null;
  glbHighlightImporter: Awaited<ReturnType<typeof loadGlbOverlay>> | null;
};

const EMPTY_SEGMENTS: SegmentationSegment[] = [];

const SEGMENT_GROUP_COLORS: Record<string, [number, number, number]> = {
  airway: [0.55, 0.93, 0.95],
  vessels: [0.91, 0.45, 0.43],
  nodes: [0.43, 0.91, 0.62],
  cardiac: [0.92, 0.75, 0.45],
  gi: [0.86, 0.75, 0.59],
  selected: [0.99, 0.92, 0.34],
};

function vectorsClose(left: readonly number[], right: readonly number[], epsilon = 1e-3) {
  return left.every((value, index) => Math.abs(value - right[index]) <= epsilon);
}

function getOverlayGroupKey(groupId: SegmentationSegment['groupId']) {
  return groupId === 'other' ? 'vessels' : groupId;
}

function buildSegmentSignature(segments: SegmentationSegment[]) {
  return segments
    .map((segment) => segment.id)
    .sort()
    .join('|');
}

function syncMapperClipping(
  mapper: {
    addClippingPlane: (plane: any) => void;
    getClippingPlanes: () => any[];
    modified?: () => void;
    removeAllClippingPlanes: () => void;
  },
  planes: VtkPlane[],
) {
  const currentPlanes = mapper.getClippingPlanes();
  const unchanged = currentPlanes.length === planes.length && currentPlanes.every((plane, index) => plane === planes[index]);

  if (unchanged) {
    mapper.modified?.();
    return;
  }

  mapper.removeAllClippingPlanes();
  planes.forEach((plane) => mapper.addClippingPlane(plane));
}

function getOrthogonalClipPlaneDefinition(
  manifest: RuntimeCaseManifest,
  plane: CasePlane,
  planeIndices: SliceIndex,
  mode: OrthogonalClipMode,
) {
  const origin = getPlaneCenterWorld(manifest.volumeGeometry, plane, planeIndices[plane]);
  const normal = getPlaneNormalWorld(manifest.volumeGeometry, plane);

  return {
    origin,
    normal: mode === 'hide-above' ? ([-normal[0], -normal[1], -normal[2]] as Vector3Tuple) : normal,
  };
}

function styleGlbActor(actor: any, opacity: number) {
  const property = actor.getProperty?.();

  if (!property) {
    return;
  }

  const diffuseColor = property.getDiffuseColor?.() ?? property.getColor?.() ?? [1, 1, 1];
  const hasVisibleColor = diffuseColor.some((channel: number) => channel > 0.02);
  const color = hasVisibleColor ? diffuseColor : [0.82, 0.84, 0.88];

  actor.setForceOpaque?.(opacity >= 0.999);
  actor.setForceTranslucent?.(opacity < 0.999);
  property.setLighting?.(true);
  property.setColor?.(color);
  property.setOpacity(opacity);
  property.setAmbient?.(0.32);
  property.setDiffuse?.(0.9);
  property.setSpecular?.(0.08);
  property.setSpecularPower?.(16);
  property.setMetallic?.(0);
  property.setRoughness?.(1);
  property.setInterpolationToPhong?.();
}

function configureSliceCamera(
  genericRenderWindow: vtkGenericRenderWindow,
  manifest: RuntimeCaseManifest,
  plane: CasePlane,
  planeIndex: number,
) {
  const renderer = genericRenderWindow.getRenderer();
  const camera = renderer.getActiveCamera();
  const center = getPlaneCenterWorld(manifest.volumeGeometry, plane, planeIndex);
  const normal = getPlaneNormalWorld(manifest.volumeGeometry, plane);
  const viewUp = getPlaneViewUp(manifest.volumeGeometry, plane);
  const radius = getBoundsRadius(manifest.bounds.ct);
  const bounds = boundsToExtent(manifest.bounds.ct);

  camera.setParallelProjection(true);
  camera.setFocalPoint(center[0], center[1], center[2]);
  camera.setPosition(...getPlaneCameraPosition(center, normal, radius * 1.7 * getPlaneCameraDistanceSign(plane)));
  camera.setViewUp(viewUp[0], viewUp[1], viewUp[2]);
  camera.setParallelScale(radius * 0.78);
  renderer.resetCameraClippingRange(bounds);
}

function configureCutCamera(
  genericRenderWindow: vtkGenericRenderWindow,
  manifest: RuntimeCaseManifest,
  origin: Vector3Tuple,
  normal: Vector3Tuple,
) {
  const renderer = genericRenderWindow.getRenderer();
  const camera = renderer.getActiveCamera();
  const normalized = normalizeVector(normal);
  const fallbackUp: Vector3Tuple = Math.abs(normalized[2]) > 0.92 ? [0, 1, 0] : [0, 0, 1];
  const right = normalizeVector(crossVectors(normalized, fallbackUp));
  const viewUp = normalizeVector(crossVectors(right, normalized));
  const radius = getBoundsRadius(manifest.bounds.ct);

  camera.setParallelProjection(true);
  camera.setFocalPoint(origin[0], origin[1], origin[2]);
  camera.setPosition(...getPlaneCameraPosition(origin, normalized, radius * 1.35));
  camera.setViewUp(viewUp[0], viewUp[1], viewUp[2]);
  camera.setParallelScale(radius * 0.52);
  renderer.resetCameraClippingRange(boundsToExtent(manifest.bounds.ct));
}

function resetThreeDCamera(genericRenderWindow: vtkGenericRenderWindow, manifest: RuntimeCaseManifest) {
  const renderer = genericRenderWindow.getRenderer();
  const camera = renderer.getActiveCamera();
  const center = getBoundsCenter(manifest.bounds.ct);
  const radius = getBoundsRadius(manifest.bounds.ct);

  camera.setFocalPoint(center[0], center[1], center[2]);
  camera.setPosition(center[0] + radius * 1.08, center[1] - radius * 1.02, center[2] + radius * 0.78);
  camera.setViewUp(0, 0, 1);
  renderer.resetCameraClippingRange(boundsToExtent(manifest.bounds.union));
}

export function VtkViewport(props: VtkViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const genericRenderWindowRef = useRef<vtkGenericRenderWindow | null>(null);
  const pipelineRef = useRef<SlicePipeline | CutPipeline | ThreeDPipeline | null>(null);
  const lastResetCameraTokenRef = useRef(0);
  const scenePickStartRef = useRef<{ x: number; y: number } | null>(null);
  const onScenePointPickRef = useRef<((world: Vector3Tuple) => void) | null>(
    props.mode === 'three-d' ? props.onScenePointPick ?? null : null,
  );
  const planeVisibilityRef = useRef<Record<CasePlane, boolean>>(
    props.mode === 'three-d'
      ? props.planeVisibility
      : {
          axial: false,
          coronal: false,
          sagittal: false,
        },
  );
  const showGlbRef = useRef(props.mode === 'three-d' ? props.showGlb : false);
  const baseVisibleStructureKeysRef = useRef<Set<string>>(new Set());
  const selectedNodeStructureKeysRef = useRef<Set<string>>(new Set());
  const activeClippingPlanesRef = useRef<VtkPlane[]>([]);
  const cutPlaneRef = useRef<{ normal: Vector3Tuple; origin: Vector3Tuple }>(
    props.mode === 'three-d'
      ? { origin: props.cutPlaneOrigin, normal: props.cutPlaneNormal }
      : { origin: [0, 0, 0], normal: [0, 0, 1] },
  );
  const threeDVisibleSegments = props.mode === 'three-d' ? props.visibleSegments : EMPTY_SEGMENTS;
  const visibleGroupMap = useMemo(() => {
    if (props.mode !== 'three-d') {
      return new Map<string, SegmentationSegment[]>();
    }

    const groups = new Map<string, SegmentationSegment[]>();

    props.visibleSegments.forEach((segment) => {
      const key = getOverlayGroupKey(segment.groupId);
      const existing = groups.get(key) ?? [];
      existing.push(segment);
      groups.set(key, existing);
    });

    return groups;
  }, [props.mode, threeDVisibleSegments]);
  const visibleStructureKeys = useMemo(() => {
    if (props.mode !== 'three-d') {
      return new Set<string>();
    }

    return new Set(
      props.visibleSegments.map((segment) =>
        normalizeStructureKey(segment.meshNameResolved ?? segment.name),
      ),
    );
  }, [props.mode, threeDVisibleSegments]);
  const threeDSelectedSegments = props.mode === 'three-d' ? props.selectedSegments : EMPTY_SEGMENTS;
  const selectedNodeStructureKeys = useMemo(() => {
    if (props.mode !== 'three-d') {
      return new Set<string>();
    }

    return new Set(
      threeDSelectedSegments
        .filter((segment) => segment.groupId === 'nodes')
        .map((segment) => normalizeStructureKey(segment.meshNameResolved ?? segment.name)),
    );
  }, [props.mode, threeDSelectedSegments]);
  const baseVisibleStructureKeys = useMemo(() => {
    if (props.mode !== 'three-d') {
      return new Set<string>();
    }

    const next = new Set(visibleStructureKeys);
    selectedNodeStructureKeys.forEach((key) => next.delete(key));
    return next;
  }, [props.mode, selectedNodeStructureKeys, visibleStructureKeys]);
  const baseVisibleStructureSignature = useMemo(
    () => [...baseVisibleStructureKeys].sort().join('|'),
    [baseVisibleStructureKeys],
  );
  const selectedNodeStructureSignature = useMemo(
    () => [...selectedNodeStructureKeys].sort().join('|'),
    [selectedNodeStructureKeys],
  );

  useEffect(() => {
    if (props.mode !== 'three-d') {
      return;
    }

    showGlbRef.current = props.showGlb;
    onScenePointPickRef.current = props.onScenePointPick ?? null;
    planeVisibilityRef.current = props.planeVisibility;
    baseVisibleStructureKeysRef.current = new Set(baseVisibleStructureKeys);
    selectedNodeStructureKeysRef.current = new Set(selectedNodeStructureKeys);
    cutPlaneRef.current = {
      origin: props.cutPlaneOrigin,
      normal: props.cutPlaneNormal,
    };
  }, [
    props.mode,
    props.mode === 'three-d' ? props.showGlb : null,
    props.mode === 'three-d' ? props.onScenePointPick : null,
    props.mode === 'three-d' ? props.planeVisibility.axial : null,
    props.mode === 'three-d' ? props.planeVisibility.coronal : null,
    props.mode === 'three-d' ? props.planeVisibility.sagittal : null,
    props.mode === 'three-d' ? baseVisibleStructureSignature : null,
    props.mode === 'three-d' ? selectedNodeStructureSignature : null,
    props.mode === 'three-d' ? props.cutPlaneOrigin : null,
    props.mode === 'three-d' ? props.cutPlaneNormal : null,
  ]);

  useEffect(() => {
    if (!containerRef.current || genericRenderWindowRef.current) {
      return;
    }

    const genericRenderWindow = vtkGenericRenderWindow.newInstance({
      background: [0.02, 0.04, 0.08],
      container: containerRef.current,
    });
    genericRenderWindow.setContainer(containerRef.current);
    genericRenderWindow.resize();
    genericRenderWindowRef.current = genericRenderWindow;

    return () => {
      if (pipelineRef.current && 'widgetSubscription' in pipelineRef.current) {
        pipelineRef.current.widgetSubscription?.unsubscribe();
        pipelineRef.current.interactionSubscriptions.forEach((subscription) => subscription.unsubscribe());
      }

      pipelineRef.current = null;
      genericRenderWindow.delete();
      genericRenderWindowRef.current = null;
    };
  }, []);

  useEffect(() => {
    function handleResize() {
      genericRenderWindowRef.current?.resize();
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const genericRenderWindow = genericRenderWindowRef.current;
    const volume = props.volumeRef.current;
    const segmentation = props.mode === 'cut' ? null : props.segmentationRef.current;

    if (!genericRenderWindow) {
      return;
    }

    if (props.mode === 'slice' && volume && !pipelineRef.current) {
      try {
        const renderer = genericRenderWindow.getRenderer();
        const interactor = genericRenderWindow.getInteractor();
        interactor.setInteractorStyle(vtkInteractorStyleImage.newInstance());
        const planeActor = createOrthogonalPlaneActor(
          volume.image,
          props.manifest,
          props.plane,
          volume.scalarRange,
        );
        const crosshair = createSliceCrosshairActors(
          props.manifest,
          props.plane,
          props.planeIndex,
          props.crosshairWorld,
        );

        renderer.addActor(planeActor.actor);
        crosshair.forEach(({ actor }) => renderer.addActor(actor));
        pipelineRef.current = {
          ...planeActor,
          crosshair,
          overlayActors: new Map(),
        };
        configureSliceCamera(genericRenderWindow, props.manifest, props.plane, props.planeIndex);
        genericRenderWindow.getRenderWindow().render();
      } catch (error) {
        console.error(
          `[case3d] slice viewport init failed for ${props.plane}`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    if (props.mode === 'cut' && volume && !pipelineRef.current) {
      const renderer = genericRenderWindow.getRenderer();
      const interactor = genericRenderWindow.getInteractor();
      interactor.setInteractorStyle(vtkInteractorStyleImage.newInstance());
      const cutSlice = createCutPlaneSlice(
        volume.image,
        volume.scalarRange,
        props.origin,
        props.normal,
      );
      renderer.addActor(cutSlice.actor);
      pipelineRef.current = cutSlice;
      configureCutCamera(genericRenderWindow, props.manifest, props.origin, props.normal);
      genericRenderWindow.getRenderWindow().render();
    }

    if (props.mode === 'three-d' && volume && segmentation && !pipelineRef.current) {
      const renderer = genericRenderWindow.getRenderer();
      const interactor = genericRenderWindow.getInteractor();
      const planeActors = {
        axial: createOrthogonalPlaneActor(volume.image, props.manifest, 'axial', volume.scalarRange),
        coronal: createOrthogonalPlaneActor(volume.image, props.manifest, 'coronal', volume.scalarRange),
        sagittal: createOrthogonalPlaneActor(volume.image, props.manifest, 'sagittal', volume.scalarRange),
      } as const;
      const cutSlice = createCutPlaneSlice(
        volume.image,
        volume.scalarRange,
        props.cutPlaneOrigin,
        props.cutPlaneNormal,
      );
      const orthogonalClipPlane = vtkPlane.newInstance({
        origin: props.crosshairWorld,
        normal: getPlaneNormalWorld(props.manifest.volumeGeometry, props.orthogonalClipPlane),
      });
      const crosshair = createCrosshairActors(props.crosshairWorld, 18);
      const widgetManager = vtkWidgetManager.newInstance();
      widgetManager.setRenderer(renderer);
      const widgetFactory = vtkImplicitPlaneWidget.newInstance();
      widgetFactory.placeWidget(boundsToExtent(props.manifest.bounds.ct));
      widgetFactory.setVisibility(props.cutPlaneVisible);
      widgetFactory.setPickable(props.cutPlaneVisible);
      const widgetState = widgetFactory.getWidgetState();
      widgetState.setOrigin(props.cutPlaneOrigin);
      widgetState.setNormal(props.cutPlaneNormal);
      const scenePicker = vtkCellPicker.newInstance({ tolerance: 0.001 });
      const widgetSubscription = widgetFactory.onWidgetChange(() => {
        const state = widgetFactory.getWidgetState();
        const nextOrigin = state.getOrigin();
        const nextNormal = state.getNormal();

        if (
          vectorsClose(nextOrigin, cutPlaneRef.current.origin) &&
          vectorsClose(nextNormal, cutPlaneRef.current.normal)
        ) {
          return;
        }

        props.onCutPlaneChange(nextOrigin, nextNormal);
      });
      widgetManager.addWidget(widgetFactory, ViewTypes.GEOMETRY);
      const interactionSubscriptions = [
        interactor.onLeftButtonPress((eventData: any) => {
          scenePickStartRef.current = {
            x: eventData.position.x,
            y: eventData.position.y,
          };
        }),
        interactor.onLeftButtonRelease((eventData: any) => {
          const start = scenePickStartRef.current;
          scenePickStartRef.current = null;

          if (!start || eventData.shiftKey || eventData.controlKey || eventData.altKey) {
            return;
          }

          const movement = Math.hypot(eventData.position.x - start.x, eventData.position.y - start.y);
          const visibility = planeVisibilityRef.current;
          const planesHidden = !visibility.axial && !visibility.coronal && !visibility.sagittal;
          const onPick = onScenePointPickRef.current;

          if (!planesHidden || !onPick || movement > 5) {
            return;
          }

          const pickRenderer = eventData.pokedRenderer ?? renderer;
          scenePicker.pick([eventData.position.x, eventData.position.y, 0], pickRenderer);
          const pickedPosition = scenePicker.getPickedPositions()[0] ?? scenePicker.getPickPosition();

          if (!pickedPosition?.every((value: number) => Number.isFinite(value))) {
            return;
          }

          onPick([pickedPosition[0], pickedPosition[1], pickedPosition[2]]);
        }),
        interactor.onAnimation(() => renderer.resetCameraClippingRange(boundsToExtent(props.manifest.bounds.union))),
        interactor.onEndAnimation(() => renderer.resetCameraClippingRange(boundsToExtent(props.manifest.bounds.union))),
      ];

      Object.values(planeActors).forEach(({ actor }) => {
        actor.getProperty().setOpacity(props.orthogonalPlaneOpacity);
        renderer.addActor(actor);
      });
      cutSlice.actor.getProperty().setOpacity(props.cutPlaneOpacity);
      renderer.addActor(cutSlice.actor);
      crosshair.forEach(({ actor }) => renderer.addActor(actor));
      pipelineRef.current = {
        planeActors: {
          axial: planeActors.axial,
          coronal: planeActors.coronal,
          sagittal: planeActors.sagittal,
        },
        crosshair,
        cutSlice,
        orthogonalClipPlane,
        widgetFactory,
        widgetManager,
        widgetSubscription,
        interactionSubscriptions,
        segmentationActors: new Map(),
        selectedActor: null,
        glbImporter: null,
        glbHighlightImporter: null,
      };
      resetThreeDCamera(genericRenderWindow, props.manifest);
      genericRenderWindow.getRenderWindow().render();
    }
    // The volume / segmentation objects are large and stable for the life of the viewer.
    // Keep them out of the dependency array so React dev logging does not recurse through
    // the entire vtk image graph if an imperative VTK call throws.
  }, [props.mode, props.hasVolume, props.mode === 'three-d' ? props.hasSegmentation : false]);

  useEffect(() => {
    const genericRenderWindow = genericRenderWindowRef.current;
    const pipeline = pipelineRef.current;
    const segmentation = props.mode === 'cut' ? null : props.segmentationRef.current;

    if (!genericRenderWindow || !pipeline) {
      return;
    }

    if (props.mode === 'slice' && 'overlayActors' in pipeline) {
      try {
        const renderer = genericRenderWindow.getRenderer();
        pipeline.mapper.setSlice(props.planeIndex);
        pipeline.actor.setVisibility(props.visible);
        updateSliceCrosshairActors(
          pipeline.crosshair,
          props.manifest,
          props.plane,
          props.planeIndex,
          props.crosshairWorld,
        );
        pipeline.crosshair.forEach(({ actor }) => actor.setVisibility(props.visible));
        const sliceOrigin = getPlaneCenterWorld(props.manifest.volumeGeometry, props.plane, props.planeIndex);
        const sliceNormal = getPlaneNormalWorld(props.manifest.volumeGeometry, props.plane);
        const overlayEntries = [
          {
            key: 'airway',
            opacity: props.overlayOpacity,
            segments: props.visibleSegments.filter((segment) => getOverlayGroupKey(segment.groupId) === 'airway'),
          },
          {
            key: 'vessels',
            opacity: props.overlayOpacity,
            segments: props.visibleSegments.filter((segment) => getOverlayGroupKey(segment.groupId) === 'vessels'),
          },
          {
            key: 'nodes',
            opacity: props.overlayOpacity,
            segments: props.visibleSegments.filter((segment) => getOverlayGroupKey(segment.groupId) === 'nodes'),
          },
          {
            key: 'cardiac',
            opacity: props.overlayOpacity,
            segments: props.visibleSegments.filter((segment) => getOverlayGroupKey(segment.groupId) === 'cardiac'),
          },
          {
            key: 'gi',
            opacity: props.overlayOpacity,
            segments: props.visibleSegments.filter((segment) => getOverlayGroupKey(segment.groupId) === 'gi'),
          },
          {
            key: 'selected',
            opacity: Math.min(1, props.overlayOpacity + 0.24),
            segments: props.selectedSegments,
          },
        ];
        const overlayKeys = new Set(overlayEntries.map((entry) => entry.key));

        pipeline.overlayActors.forEach((bundle, key) => {
          if (!overlayKeys.has(key)) {
            renderer.removeActor(bundle.actor);
            pipeline.overlayActors.delete(key);
          }
        });

        if (!props.showSegmentationOverlay || !segmentation || !props.visible) {
          pipeline.overlayActors.forEach((bundle) => renderer.removeActor(bundle.actor));
          pipeline.overlayActors.clear();
        } else {
          overlayEntries.forEach((entry) => {
            const signature = buildSegmentSignature(entry.segments);
            const existing = pipeline.overlayActors.get(entry.key);

            if (!entry.segments.length) {
              if (existing) {
                renderer.removeActor(existing.actor);
                pipeline.overlayActors.delete(entry.key);
              }
              return;
            }

            if (!existing || existing.signature !== signature) {
              if (existing) {
                renderer.removeActor(existing.actor);
                pipeline.overlayActors.delete(entry.key);
              }

              const overlayBundle = createSegmentationSliceOverlay(
                segmentation,
                entry.segments,
                SEGMENT_GROUP_COLORS[entry.key],
                entry.opacity,
                sliceOrigin,
                sliceNormal,
              );

              if (!overlayBundle) {
                return;
              }

              renderer.addActor(overlayBundle.actor);
              pipeline.overlayActors.set(entry.key, {
                ...overlayBundle,
                signature,
              });
            }

            const bundle = pipeline.overlayActors.get(entry.key);

            if (!bundle) {
              return;
            }

            bundle.plane.setOrigin(sliceOrigin);
            bundle.plane.setNormal(sliceNormal);
            bundle.opacityTransfer.removeAllPoints();
            bundle.opacityTransfer.addPoint(0, 0);
            bundle.opacityTransfer.addPoint(255, entry.opacity);
            bundle.actor.setVisibility(true);
          });
        }

        configureSliceCamera(genericRenderWindow, props.manifest, props.plane, props.planeIndex);
        genericRenderWindow.getRenderWindow().render();
      } catch (error) {
        console.error(
          `[case3d] slice viewport update failed for ${props.plane}`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    if (props.mode === 'cut' && 'plane' in pipeline && !('planeActors' in pipeline)) {
      pipeline.plane.setOrigin(props.origin);
      pipeline.plane.setNormal(props.normal);
      pipeline.actor.getProperty().setOpacity(props.opacity);
      pipeline.actor.setVisibility(props.visible);
      configureCutCamera(genericRenderWindow, props.manifest, props.origin, props.normal);
      genericRenderWindow.getRenderWindow().render();
    }

    if (props.mode !== 'three-d' || !('planeActors' in pipeline)) {
      return;
    }

    const renderer = genericRenderWindow.getRenderer();
    if (props.orthogonalClipMode !== 'none') {
      const clipDefinition = getOrthogonalClipPlaneDefinition(
        props.manifest,
        props.orthogonalClipPlane,
        props.planeIndices,
        props.orthogonalClipMode,
      );
      pipeline.orthogonalClipPlane.setOrigin(clipDefinition.origin);
      pipeline.orthogonalClipPlane.setNormal(clipDefinition.normal);
    }

    const activeClippingPlanes = [
      ...(props.cutPlaneVisible ? [pipeline.cutSlice.plane] : []),
      ...(props.orthogonalClipMode !== 'none' ? [pipeline.orthogonalClipPlane] : []),
    ];
    activeClippingPlanesRef.current = activeClippingPlanes;
    const glbReady = Boolean(pipeline.glbImporter?.importer.getActors?.().size);
    const useGlbAsPrimary = props.showGlb && glbReady;
    const syncGlbActors = (
      loaded: NonNullable<ThreeDPipeline['glbImporter']>,
      visible: boolean,
      allowedKeys: Set<string>,
    ) => {
      const allActors = Array.from(loaded.importer.getActors().values());

      if (!visible) {
        allActors.forEach((actor) => {
          const mapper = actor.getMapper?.();
          actor.setVisibility(false);

          if (mapper) {
            syncMapperClipping(mapper, []);
          }
        });
        return;
      }

      if (loaded.namedActors.size > 0) {
        const namedVisibleActors = new Set<any>();
        const clippingPlanes = activeClippingPlanesRef.current;

        allActors.forEach((actor) => actor.setVisibility(false));
        loaded.namedActors.forEach((actors, key) => {
          const actorVisible = allowedKeys.has(key);

          actors.forEach((actor) => {
            const mapper = actor.getMapper?.();
            namedVisibleActors.add(actor);
            actor.setVisibility(actorVisible);
            styleGlbActor(actor, props.overlayOpacity);

            if (mapper) {
              syncMapperClipping(mapper, actorVisible ? clippingPlanes : []);
            }
          });
        });

        allActors.forEach((actor) => {
          if (namedVisibleActors.has(actor)) {
            return;
          }

          const mapper = actor.getMapper?.();
          actor.setVisibility(false);

          if (mapper) {
            syncMapperClipping(mapper, []);
          }
        });

        return;
      }

      allActors.forEach((actor) => {
        const mapper = actor.getMapper?.();
        const clippingPlanes = activeClippingPlanesRef.current;
        actor.setVisibility(allowedKeys.size > 0);
        styleGlbActor(actor, props.overlayOpacity);

        if (mapper) {
          syncMapperClipping(mapper, allowedKeys.size > 0 ? clippingPlanes : []);
        }
      });
    };

    pipeline.planeActors.axial.mapper.setSlice(props.planeIndices.axial);
    pipeline.planeActors.coronal.mapper.setSlice(props.planeIndices.coronal);
    pipeline.planeActors.sagittal.mapper.setSlice(props.planeIndices.sagittal);
    pipeline.planeActors.axial.actor.setVisibility(props.planeVisibility.axial);
    pipeline.planeActors.coronal.actor.setVisibility(props.planeVisibility.coronal);
    pipeline.planeActors.sagittal.actor.setVisibility(props.planeVisibility.sagittal);
    pipeline.planeActors.axial.actor.getProperty().setOpacity(props.orthogonalPlaneOpacity);
    pipeline.planeActors.coronal.actor.getProperty().setOpacity(props.orthogonalPlaneOpacity);
    pipeline.planeActors.sagittal.actor.getProperty().setOpacity(props.orthogonalPlaneOpacity);
    updateCrosshairActors(pipeline.crosshair, props.crosshairWorld, 18);
    pipeline.cutSlice.plane.setOrigin(props.cutPlaneOrigin);
    pipeline.cutSlice.plane.setNormal(props.cutPlaneNormal);
    pipeline.cutSlice.actor.getProperty().setOpacity(props.cutPlaneOpacity);
    pipeline.cutSlice.actor.setVisibility(props.cutPlaneVisible);
    const widgetState = pipeline.widgetFactory.getWidgetState();

    if (!vectorsClose(widgetState.getOrigin(), props.cutPlaneOrigin)) {
      widgetState.setOrigin(props.cutPlaneOrigin);
    }

    if (!vectorsClose(widgetState.getNormal(), props.cutPlaneNormal)) {
      widgetState.setNormal(props.cutPlaneNormal);
    }

    pipeline.widgetFactory.setVisibility(props.cutPlaneVisible);
    pipeline.widgetFactory.setPickable(props.cutPlaneVisible);

    (['airway', 'vessels', 'nodes', 'cardiac', 'gi'] as const).forEach((groupKey) => {
      const segments = visibleGroupMap.get(groupKey) ?? [];
      const signature = buildSegmentSignature(segments);
      const existing = pipeline.segmentationActors.get(groupKey);

      if (useGlbAsPrimary) {
        if (existing) {
          existing.actor.setVisibility(false);
        }
        return;
      }

      if (!segments.length) {
        if (existing) {
          renderer.removeActor(existing.actor);
          pipeline.segmentationActors.delete(groupKey);
        }
        return;
      }

      if (!existing || existing.signature !== signature) {
        if (existing) {
          renderer.removeActor(existing.actor);
          pipeline.segmentationActors.delete(groupKey);
        }

        if (!segmentation) {
          return;
        }

        const actorBundle = createSegmentationSurfaceActor(
          props.manifest,
          segmentation,
          segments,
          SEGMENT_GROUP_COLORS[groupKey],
          props.overlayOpacity,
          activeClippingPlanes,
        );

        if (!actorBundle) {
          return;
        }

        renderer.addActor(actorBundle.actor);
        pipeline.segmentationActors.set(groupKey, {
          ...actorBundle,
          signature,
        });
      }

      const bundle = pipeline.segmentationActors.get(groupKey);

      if (!bundle) {
        return;
      }

      syncMapperClipping(bundle.mapper, activeClippingPlanes);
      bundle.actor.setVisibility(true);
      bundle.actor.getProperty().setOpacity(props.overlayOpacity);
    });

    if (pipeline.selectedActor && (useGlbAsPrimary || !props.selectedSegments.length || !segmentation)) {
      renderer.removeActor(pipeline.selectedActor.actor);
      pipeline.selectedActor = null;
    }

    if (!useGlbAsPrimary && props.selectedSegments.length > 0 && segmentation) {
      if (pipeline.selectedActor) {
        renderer.removeActor(pipeline.selectedActor.actor);
        pipeline.selectedActor = null;
      }

      pipeline.selectedActor = createSegmentationSurfaceActor(
        props.manifest,
        segmentation,
        props.selectedSegments,
        SEGMENT_GROUP_COLORS.selected,
        Math.min(1, props.overlayOpacity + 0.24),
        activeClippingPlanes,
      );

      if (pipeline.selectedActor) {
        renderer.addActor(pipeline.selectedActor.actor);
      }
    }

    if (pipeline.selectedActor) {
      syncMapperClipping(pipeline.selectedActor.mapper, activeClippingPlanes);
    }

    if (props.showGlb && !pipeline.glbImporter) {
      loadGlbOverlay(renderer, props.manifest, case001AssetUrls.glb)
        .then((importer) => {
          pipeline.glbImporter = importer;

          if (showGlbRef.current) {
            pipeline.segmentationActors.forEach((bundle) => bundle.actor.setVisibility(false));

            if (pipeline.selectedActor) {
              renderer.removeActor(pipeline.selectedActor.actor);
              pipeline.selectedActor = null;
            }
          }

          syncGlbActors(importer, showGlbRef.current, baseVisibleStructureKeysRef.current);
          genericRenderWindow.getRenderWindow().render();
        })
        .catch(() => {
          pipeline.glbImporter = null;
        });
    }

    if (props.showGlb && selectedNodeStructureKeys.size > 0 && !pipeline.glbHighlightImporter) {
      loadGlbOverlay(renderer, props.manifest, case001AssetUrls.glbHighlight)
        .then((importer) => {
          pipeline.glbHighlightImporter = importer;
          syncGlbActors(importer, showGlbRef.current, selectedNodeStructureKeysRef.current);
          genericRenderWindow.getRenderWindow().render();
        })
        .catch(() => {
          pipeline.glbHighlightImporter = null;
        });
    }

    if (pipeline.glbImporter) {
      syncGlbActors(pipeline.glbImporter, props.showGlb, baseVisibleStructureKeys);
    }

    if (pipeline.glbHighlightImporter) {
      syncGlbActors(
        pipeline.glbHighlightImporter,
        props.showGlb && selectedNodeStructureKeys.size > 0,
        selectedNodeStructureKeys,
      );
    }

    if (props.resetCameraToken > lastResetCameraTokenRef.current) {
      lastResetCameraTokenRef.current = props.resetCameraToken;
      resetThreeDCamera(genericRenderWindow, props.manifest);
    }

    genericRenderWindow.getRenderWindow().render();
  }, [
    props.mode,
    visibleGroupMap,
    props.mode === 'slice' ? props.plane : null,
    props.mode === 'slice' ? props.planeIndex : null,
    props.mode === 'slice' ? props.crosshairWorld : null,
    props.mode === 'slice' ? props.overlayOpacity : null,
    props.mode === 'slice' ? props.showSegmentationOverlay : null,
    props.mode === 'slice' ? props.visibleSegments : null,
    props.mode === 'slice' ? props.selectedSegments : null,
    props.mode === 'slice' ? props.hasSegmentation : null,
    props.mode === 'slice' ? props.visible : null,
    props.mode === 'cut' ? props.origin : null,
    props.mode === 'cut' ? props.normal : null,
    props.mode === 'cut' ? props.opacity : null,
    props.mode === 'cut' ? props.visible : null,
    props.mode === 'three-d' ? props.crosshairWorld : null,
    props.mode === 'three-d' ? props.orthogonalPlaneOpacity : null,
    props.mode === 'three-d' ? props.overlayOpacity : null,
    props.mode === 'three-d' ? props.selectedSegments : null,
    props.mode === 'three-d' ? props.visibleSegments : null,
    props.mode === 'three-d' ? baseVisibleStructureSignature : null,
    props.mode === 'three-d' ? selectedNodeStructureSignature : null,
    props.mode === 'three-d' ? props.cutPlaneOrigin : null,
    props.mode === 'three-d' ? props.cutPlaneNormal : null,
    props.mode === 'three-d' ? props.cutPlaneOpacity : null,
    props.mode === 'three-d' ? props.cutPlaneVisible : null,
    props.mode === 'three-d' ? props.orthogonalClipMode : null,
    props.mode === 'three-d' ? props.orthogonalClipPlane : null,
    props.mode === 'three-d' ? props.showGlb : null,
    props.mode === 'three-d' ? props.resetCameraToken : null,
    props.mode === 'three-d' ? props.planeIndices.axial : null,
    props.mode === 'three-d' ? props.planeIndices.coronal : null,
    props.mode === 'three-d' ? props.planeIndices.sagittal : null,
    props.mode === 'three-d' ? props.planeVisibility.axial : null,
    props.mode === 'three-d' ? props.planeVisibility.coronal : null,
    props.mode === 'three-d' ? props.planeVisibility.sagittal : null,
  ]);

  return <div className={props.className ?? 'case-vtk-viewport'} ref={containerRef} />;
}
