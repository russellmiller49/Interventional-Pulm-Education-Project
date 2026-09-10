const MEDIASTINAL_WINDOW = 360;
const MEDIASTINAL_LEVEL = 40;

export function resolveMediastinalWindowing(scalarRange: readonly [number, number]) {
  const [minimum, maximum] = scalarRange;
  const dynamicRange = Math.max(1, maximum - minimum);
  const colorWindow = Math.min(MEDIASTINAL_WINDOW, dynamicRange);
  const halfWindow = colorWindow / 2;
  const lowestLevel = minimum + halfWindow;
  const highestLevel = maximum - halfWindow;

  return {
    colorWindow,
    colorLevel:
      lowestLevel <= highestLevel
        ? Math.min(highestLevel, Math.max(lowestLevel, MEDIASTINAL_LEVEL))
        : (minimum + maximum) / 2,
  };
}
