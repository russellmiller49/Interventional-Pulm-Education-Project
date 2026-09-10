import { validateCase001 } from '../case-001-enrichment';

export function runCase001Validation(rootDir = process.cwd()) {
  const summary = validateCase001(rootDir);

  process.stdout.write(
    [
      `Validated ${summary.caseId}`,
      `Stations: ${summary.stationCount}`,
      `Targets: ${summary.targetCount}`,
      `Parsed markups: ${summary.parsedMarkupCount}`,
      `Segmentation segments: ${summary.segmentationSegmentCount}`,
      summary.outsideCtTargetIds.length > 0
        ? `Outside CT bounds: ${summary.outsideCtTargetIds.join(', ')}`
        : 'All targets fall inside CT bounds.',
    ].join('\n') + '\n',
  );

  return summary;
}

if (require.main === module) {
  runCase001Validation();
}
