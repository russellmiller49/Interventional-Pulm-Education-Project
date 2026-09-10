#!/usr/bin/env node
/**
 * Builds a single markdown digest (gitingest-style) of the Vite web app and
 * repo-root content it imports, for pasting into external LLM tools.
 *
 * Usage (from repo root): npm run gitingest --prefix apps/web
 * Options: --out <path>  --max-bytes <n>  --no-shared-content
 */

import {
  readdir,
  readFile,
  stat,
  writeFile,
  mkdir,
} from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(__dirname, '..');
const REPO_ROOT = join(WEB_ROOT, '..', '..');

const DEFAULT_OUT = join(WEB_ROOT, 'gitingest-webapp.md');
const DEFAULT_MAX_BYTES = 600_000;

const WEB_SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.git',
  '.vite',
]);

const WEB_TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.html',
  '.md',
]);

const WEB_SKIP_FILES = new Set(['package-lock.json']);

/** Repo-root JSON the web app imports (see src/content/*.ts and case3d). */
const SHARED_CONTENT_FILES = [
  'content/course/course-info.json',
  'content/modules/modules.json',
  'content/modules/knobology.json',
  'content/modules/knobology-advanced.json',
  'content/modules/mediastinal-anatomy.json',
  'content/modules/procedural-technique.json',
  'content/modules/sonographic-interpretation.json',
  'content/modules/staging-strategy.json',
  'content/modules/station-map.json',
  'content/modules/station-explorer.json',
  'content/stations/core-stations.json',
  'content/stations/station-correlations.json',
  'content/cases/generated/case_001.enriched.json',
  'content/cases/case_001.runtime.json',
];

function parseArgs(argv) {
  let out = DEFAULT_OUT;
  let maxBytes = DEFAULT_MAX_BYTES;
  let includeShared = true;
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1]) {
      out = argv[i + 1];
      i += 1;
    } else if (a === '--max-bytes' && argv[i + 1]) {
      maxBytes = Number(argv[i + 1]);
      i += 1;
    } else if (a === '--no-shared-content') {
      includeShared = false;
    } else if (a === '--help' || a === '-h') {
      console.log(`Usage: node generate-gitingest.mjs [--out <file>] [--max-bytes <n>] [--no-shared-content]`);
      process.exit(0);
    }
  }
  return { out, maxBytes, includeShared };
}

async function collectWebFiles(dir, base = dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (WEB_SKIP_DIR_NAMES.has(ent.name)) continue;
      await collectWebFiles(full, base, acc);
    } else if (ent.isFile()) {
      const rel = relative(base, full).replace(/\\/g, '/');
      if (rel.startsWith('scripts/generate-gitingest.mjs')) continue;
      if (WEB_SKIP_FILES.has(ent.name)) continue;
      const ext = ent.name.slice(ent.name.lastIndexOf('.'));
      if (!WEB_TEXT_EXTENSIONS.has(ext)) continue;
      acc.push(full);
    }
  }
  return acc;
}

async function listQuizFiles() {
  const quizDir = join(REPO_ROOT, 'content/quizzes');
  try {
    const names = await readdir(quizDir);
    return names
      .filter((n) => n.endsWith('.json'))
      .map((n) => join(quizDir, n));
  } catch {
    return [];
  }
}

function fenceLang(path) {
  if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.md')) return 'markdown';
  return '';
}

async function readFileBounded(absPath, relDisplay, maxBytes) {
  const st = await stat(absPath);
  if (st.size > maxBytes) {
    return {
      omitted: true,
      note: `Omitted: ${relDisplay} is ${st.size} bytes (max ${maxBytes}). Open this path locally or raise --max-bytes.`,
    };
  }
  const text = await readFile(absPath, 'utf8');
  return { omitted: false, text };
}

function buildTreeLines(paths) {
  const root = { children: new Map(), file: false };
  for (const p of paths.sort()) {
    const parts = p.split('/');
    let node = root;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      if (!node.children.has(part)) {
        node.children.set(part, { children: new Map(), file: i === parts.length - 1 });
      }
      node = node.children.get(part);
    }
  }
  const lines = [];
  function walk(node, prefix) {
    const names = [...node.children.keys()].sort((a, b) => {
      const da = node.children.get(a);
      const db = node.children.get(b);
      if (da.file !== db.file) return da.file ? 1 : -1;
      return a.localeCompare(b);
    });
    for (const name of names) {
      const child = node.children.get(name);
      const isLast = name === names[names.length - 1];
      const branch = isLast ? '└── ' : '├── ';
      lines.push(`${prefix}${branch}${name}`);
      if (!child.file && child.children.size) {
        const nextPrefix = prefix + (isLast ? '    ' : '│   ');
        walk(child, nextPrefix);
      }
    }
  }
  walk(root, '');
  return lines;
}

async function main() {
  const { out, maxBytes, includeShared } = parseArgs(process.argv);

  const webAbsFiles = await collectWebFiles(WEB_ROOT);

  const sharedAbs = [];
  if (includeShared) {
    for (const rel of SHARED_CONTENT_FILES) {
      sharedAbs.push(join(REPO_ROOT, rel));
    }
    sharedAbs.push(...(await listQuizFiles()));
  }

  const allDisplayPaths = [];
  const fileSections = [];

  for (const abs of webAbsFiles.sort((a, b) => a.localeCompare(b))) {
    const display = `apps/web/${relative(WEB_ROOT, abs).replace(/\\/g, '/')}`;
    allDisplayPaths.push(display);
    const { omitted, note, text } = await readFileBounded(abs, display, maxBytes);
    const lang = fenceLang(display);
    if (omitted) {
      fileSections.push(`## File: \`${display}\`\n\n> ${note}\n`);
    } else {
      fileSections.push(`## File: \`${display}\`\n\n\`\`\`${lang}\n${text.replace(/\r\n/g, '\n')}\n\`\`\`\n`);
    }
  }

  if (includeShared) {
    const seen = new Set();
    for (const abs of sharedAbs.sort((a, b) => a.localeCompare(b))) {
      const display = relative(REPO_ROOT, abs).replace(/\\/g, '/');
      if (seen.has(display)) continue;
      seen.add(display);
      try {
        await stat(abs);
      } catch {
        fileSections.push(`## File: \`${display}\`\n\n> Missing on disk (skipped).\n`);
        continue;
      }
      allDisplayPaths.push(display);
      const { omitted, note, text } = await readFileBounded(abs, display, maxBytes);
      const lang = fenceLang(display);
      if (omitted) {
        fileSections.push(`## File: \`${display}\`\n\n> ${note}\n`);
      } else {
        fileSections.push(`## File: \`${display}\`\n\n\`\`\`${lang}\n${text.replace(/\r\n/g, '\n')}\n\`\`\`\n`);
      }
    }
  }

  const uniqueTreePaths = [...new Set(allDisplayPaths)].sort();
  const tree = buildTreeLines(uniqueTreePaths);

  const header = `# SoCal EBUS Prep — web app gitingest

Generated for external NLP / code review. Includes \`apps/web\` source and config${
    includeShared ? ', plus repo-root JSON consumed by the Vite app' : ''
}.

- Monorepo layout: repository root contains \`apps/web/\` (Vite app) and \`content/\` (shared JSON).
- Max bytes per file: ${maxBytes} (large files are summarized, not inlined)

## How this app relates to the monorepo

- Vite \`server.fs.allow\` includes the repo root so imports like \`../../../../content/...\` work at dev time.
- Binary media under \`apps/web/public/media\` is not included here.

## Directory tree (included files only)

\`\`\`text
${tree.join('\n')}
\`\`\`

---

`;

  const body = fileSections.join('\n');
  const full = `${header}${body}`;

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, full, 'utf8');
  console.log(`Wrote ${full.length} characters to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
