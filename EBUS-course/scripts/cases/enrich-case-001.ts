import { buildCase001Assets } from './build-case-assets';

export function enrichCase001(rootDir = process.cwd()) {
  return buildCase001Assets(rootDir);
}

if (require.main === module) {
  enrichCase001();
}
