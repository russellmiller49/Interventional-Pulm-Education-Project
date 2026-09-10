import path from 'node:path';

import { writeCaseOutputs } from '../case-001-enrichment';

export function buildCase001Assets(rootDir = process.cwd()) {
  const outputs = writeCaseOutputs(rootDir);

  process.stdout.write(
    [
      `Wrote ${path.relative(rootDir, outputs.runtimeManifestPath)}`,
      `Wrote ${path.relative(rootDir, outputs.enrichedManifestPath)}`,
      ...outputs.runtimeManifest.warnings.map((warning) => `Warning: ${warning}`),
    ].join('\n') + '\n',
  );

  return outputs;
}

if (require.main === module) {
  buildCase001Assets();
}
