import { buildCase001Assets } from './cases/build-case-assets';

export function runCase001Enrichment(rootDir = process.cwd()) {
  return buildCase001Assets(rootDir);
}

if (require.main === module) {
  runCase001Enrichment();
}
