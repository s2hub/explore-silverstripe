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

const RELEASE = 'https://api.github.com/repos/s2hub/silverstripe-cms-playground/releases/tags/bundle';
const ASSET = 'silverstripe-bundle.zip';
const TARGET = 'bundle';

// With a token (GITHUB_TOKEN in GitHub Actions), the requests are authenticated: GitHub serves those more reliably
// than anonymous downloads. The playground also replaces the asset on each build of its main branch, so a download
// can fail for a moment: retry for a few minutes before giving up.
const headers = process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};

async function get(url, accept, attempts = 6) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { headers: { ...headers, accept } }).catch((error) => ({ ok: false, status: error.message }));

    if (response.ok) {
      return response;
    }

    if (attempt === attempts) {
      throw new Error(`Cannot download ${url}: HTTP ${response.status}`);
    }

    console.log(`Download failed (HTTP ${response.status}), retrying in 30 s`);
    await new Promise((resolve) => setTimeout(resolve, 30000));
  }
}

const release = await (await get(RELEASE, 'application/vnd.github+json')).json();
const asset = release.assets.find(({ name }) => name === ASSET);

if (!asset) {
  throw new Error(`The release "bundle" of the playground has no ${ASSET}`);
}

const response = await get(asset.url, 'application/octet-stream');

const temp = mkdtempSync(join(tmpdir(), 'explore-bundle-'));
const zip = join(temp, 'bundle.zip');

writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
rmSync(TARGET, { recursive: true, force: true });
mkdirSync(TARGET);
execFileSync('unzip', ['-q', zip, '-d', TARGET]);
rmSync(temp, { recursive: true });
console.log(`Site bundle in ${TARGET}/`);
