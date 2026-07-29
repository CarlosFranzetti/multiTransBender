/**
 * Packaging script.
 *
 * Produces two archives:
 *
 *   public/downloads/MultiTransBend-plugin-source.zip
 *       The plugin and local standalone, ready to build with CMake. This is
 *       what the deployed site serves from /plugin, so it has to live under
 *       public/ to be part of the deployment.
 *
 *   dist/MultiTransBend-<version>-source.zip
 *       The whole project. Committed to the repository as a single-file
 *       snapshot alongside the unpacked tree.
 *
 * Uses the system `zip` rather than a dependency, because adding an npm package
 * to the production tree just to build an archive at authoring time is a poor
 * trade.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };

const EXCLUDES = [
  'node_modules/*',
  '.next/*',
  '.git/*',
  'dist/*',
  'public/downloads/*',
  '.vercel/*',
  '*.tsbuildinfo',
  '.DS_Store',
];

function zip(output: string, inputs: string[], excludes: string[] = []): void {
  mkdirSync(dirname(output), { recursive: true });
  rmSync(output, { force: true });

  const args = ['-r', '-q', '-9', output, ...inputs];
  for (const pattern of excludes) args.push('-x', pattern);

  execFileSync('zip', args, { cwd: root, stdio: 'inherit' });
}

function sizeOf(path: string): string {
  if (!existsSync(path)) return 'missing';
  const { size } = require('node:fs').statSync(path) as { size: number };
  return `${(size / 1024).toFixed(0)} KB`;
}

const pluginArchive = 'public/downloads/MultiTransBend-plugin-source.zip';
zip(pluginArchive, ['plugin', 'docs/BUILDING.md', 'LICENSE', 'src/dsp', 'design']);
console.log(`plugin bundle  ${pluginArchive}  ${sizeOf(join(root, pluginArchive))}`);

const sourceArchive = `dist/MultiTransBend-${pkg.version}-source.zip`;
zip(sourceArchive, ['.'], EXCLUDES);
console.log(`source bundle  ${sourceArchive}  ${sizeOf(join(root, sourceArchive))}`);
