// Downloads the site bundle (site.zip, manifest.json, _resources/) that the Silverstripe Playground publishes with
// each build of its main branch, into bundle/.
//
// Usage: node bin/fetch-bundle.mjs
// For a bundle built locally, skip this and point PLAYGROUND_BUNDLE at it, e.g.
//   PLAYGROUND_BUNDLE=../silverstripe-playground/build/bundle npm run dev

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = 'https://github.com/s2hub/silverstripe-cms-playground/releases/download/bundle/silverstripe-bundle.zip';
const TARGET = 'bundle';

const response = await fetch(URL);

if (!response.ok) {
  throw new Error(`Cannot download ${URL}: HTTP ${response.status}`);
}

const temp = mkdtempSync(join(tmpdir(), 'explore-bundle-'));
const zip = join(temp, 'bundle.zip');

writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
rmSync(TARGET, { recursive: true, force: true });
mkdirSync(TARGET);
execFileSync('unzip', ['-q', zip, '-d', TARGET]);
rmSync(temp, { recursive: true });
console.log(`Site bundle in ${TARGET}/`);
