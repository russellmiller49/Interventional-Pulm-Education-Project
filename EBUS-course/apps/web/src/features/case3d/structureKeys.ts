export function normalizeStructureKey(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, '_').toLowerCase();
}
