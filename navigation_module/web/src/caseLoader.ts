import type { AirwayCandidateLabel, AirwayCandidatePayload, LoadedCase, LoadedNoduleAsset, NoduleAssetMetadata, WebCase } from "./types";
import { ENABLE_SCOPE_DEBUG } from "./runtimeFlags";
import { candidateDisplayLabel, getMessages, localizeCaseMetadata, type Locale } from "./i18n";

declare const __APP_BASE_PATH__: string;

const ENABLE_AUTHORING_TOOLS = ENABLE_SCOPE_DEBUG;

export async function loadCase(locale: Locale = "en", caseUrl = appAssetUrl("cases/default/case.json")): Promise<LoadedCase> {
  const messages = getMessages(locale).loader;
  const metadata = (await fetch(caseUrl).then((response) => {
    if (!response.ok) {
      throw new Error(messages.failedCaseMetadata(response.status));
    }
    return response.json();
  })) as WebCase;
  if (ENABLE_AUTHORING_TOOLS) {
    const candidatePayload = await fetchCandidateSidecar(metadata, caseUrl, locale);
    if (candidatePayload) {
      mergeCandidateLabels(metadata, candidatePayload, locale);
    }
  }
  const scopeCalibrationPayload = await fetchScopeCalibrationSidecar(metadata, caseUrl, locale);
  if (scopeCalibrationPayload) {
    metadata.scopeCalibration = scopeCalibrationPayload;
  }

  const rawUrl = new URL(metadata.ct.raw, new URL(caseUrl, window.location.origin)).toString();
  const buffer = await fetch(rawUrl).then((response) => {
    if (!response.ok) {
      throw new Error(messages.failedCtPreview(response.status));
    }
    return response.arrayBuffer();
  });

  const localizedMetadata = localizeCaseMetadata(metadata, locale);
  const noduleAsset = localizedMetadata.noduleAsset ? await loadNoduleAsset(localizedMetadata.noduleAsset, caseUrl, locale) : null;
  const noduleAssets: Record<string, LoadedNoduleAsset> = {};
  for (const target of localizedMetadata.noduleTargets ?? []) {
    noduleAssets[target.id] = await loadNoduleAsset(target.noduleAsset, caseUrl, locale);
  }

  return { metadata: localizedMetadata, volume: new Uint8Array(buffer), noduleAsset, noduleAssets };
}

function appAssetUrl(path: string) {
  return new URL(path, new URL(__APP_BASE_PATH__, window.location.origin)).toString();
}

async function fetchScopeCalibrationSidecar(metadata: WebCase, caseUrl: string, locale: Locale) {
  const messages = getMessages(locale).loader;
  const sidecarPath = metadata.scopeCalibrationJson ?? "scope_calibration.json";
  const url = new URL(sidecarPath, new URL(caseUrl, window.location.origin)).toString();
  return fetch(url).then(async (response) => {
    if (await isMissingOptionalSidecar(response)) {
      return null;
    }
    if (!response.ok) {
      throw new Error(messages.failedScopeCalibration(response.status));
    }
    const payload = await response.json();
    const hasAdjustments = payload && typeof payload.adjustments === "object";
    const hasProfiles = payload && typeof payload.profiles === "object";
    if (!payload || payload.schema !== "bronchoedu_scope_calibration/v1" || (!hasAdjustments && !hasProfiles)) {
      throw new Error(messages.unsupportedScopeCalibration);
    }
    return payload;
  });
}

async function fetchCandidateSidecar(metadata: WebCase, caseUrl: string, locale: Locale): Promise<AirwayCandidatePayload | null> {
  const messages = getMessages(locale).loader;
  const sidecarPath = metadata.airway.candidatesJson ?? "book_candidates.json";
  const url = new URL(sidecarPath, new URL(caseUrl, window.location.origin)).toString();
  return fetch(url).then(async (response) => {
    if (await isMissingOptionalSidecar(response)) {
      return null;
    }
    if (!response.ok) {
      throw new Error(messages.failedCandidateLabels(response.status));
    }
    const payload = (await response.json()) as AirwayCandidatePayload;
    if (payload.schema !== "airway_labeling_candidate_results/v1" || !payload.edges) {
      throw new Error(messages.unsupportedCandidateLabels);
    }
    return payload;
  });
}

function mergeCandidateLabels(metadata: WebCase, payload: AirwayCandidatePayload, locale: Locale) {
  metadata.airway.candidateSource = payload.source;
  metadata.airway.edges = metadata.airway.edges.map((edge) => {
    const raw = payload.edges[String(edge.id)];
    const candidates = normalizeCandidateLabels(raw, locale);
    return candidates.length ? { ...edge, candidateLabels: candidates } : edge;
  });
}

function normalizeCandidateLabels(raw: AirwayCandidatePayload["edges"][string] | undefined, locale: Locale): AirwayCandidateLabel[] {
  const items = Array.isArray(raw) ? raw : (raw?.candidateLabels ?? raw?.candidates ?? []);
  return items
    .filter((item) => typeof item.candidateLabel === "string" && Number.isFinite(Number(item.score)))
    .map((item) => ({
      ...item,
      score: Number(item.score),
      displayLabel: typeof item.displayLabel === "string" ? item.displayLabel : candidateDisplayLabel(locale, item.candidateLabel),
      warnings: Array.isArray(item.warnings) ? item.warnings : [],
      explanation: typeof item.explanation === "string" ? item.explanation : "",
      source: typeof item.source === "string" ? item.source : "book_directional_rules"
    }))
    .sort((a, b) => b.score - a.score || a.candidateLabel.localeCompare(b.candidateLabel));
}

async function isMissingOptionalSidecar(response: Response) {
  if (response.status === 404) {
    return true;
  }
  if (response.status !== 400) {
    return false;
  }

  try {
    const payload: unknown = await response.clone().json();
    if (!payload || typeof payload !== "object") {
      return false;
    }
    const record = payload as Record<string, unknown>;
    return (
      record.statusCode === "404" &&
      (record.error === "not_found" || record.message === "Object not found")
    );
  } catch {
    return false;
  }
}

async function fetchCaseArrayBuffer(path: string, caseUrl: string, label: string, locale: Locale) {
  const messages = getMessages(locale).loader;
  const url = new URL(path, new URL(caseUrl, window.location.origin)).toString();
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(messages.failedAsset(label, response.status));
    }
    return response.arrayBuffer();
  });
}

async function loadNoduleAsset(metadata: NoduleAssetMetadata, caseUrl: string, locale: Locale): Promise<LoadedNoduleAsset> {
  const messages = getMessages(locale).loader;
  return {
    metadata,
    residual: new Int16Array(await fetchCaseArrayBuffer(metadata.residualRaw, caseUrl, messages.residualVolume(metadata.assetId), locale)),
    alpha: new Uint8Array(await fetchCaseArrayBuffer(metadata.alphaRaw, caseUrl, messages.alphaVolume(metadata.assetId), locale))
  };
}
