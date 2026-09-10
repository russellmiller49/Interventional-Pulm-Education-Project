export function normalizeSimulatorStationId(stationId: string): string {
  const compact = stationId.trim().replace(/\s+/g, '');
  const upper = compact.toUpperCase();

  if (upper === '11RI') {
    return '11Ri';
  }

  if (upper === '11RS') {
    return '11Rs';
  }

  return upper;
}

export function formatSimulatorStation(stationId: string): string {
  return normalizeSimulatorStationId(stationId);
}
