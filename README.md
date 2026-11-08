# Explore Silverstripe

Try Silverstripe CMS in the browser, with tutorials: a real Silverstripe 6 site runs in the tab (PHP in
WebAssembly), next to its code and the tutorial's steps. No server, no installation.

- **Start page** (`index.html`): the tutorials as cards; the site starts in the background meanwhile.
- **Tutorial** (`?tutorial=<slug>&step=<n>`, same page): the step on the left, the code (the step's files as tabs,
  dev/build) and the site (CMS or front end) side by side. Tasks are ticked off as you work; **Show solution**,
  **Reset step**, jumping to a step (the steps before it are applied). **Continue in full playground** saves the
  site in the browser and opens it in the full playground.
- **Full playground** (`playground.html`): the whole site and its code, saving in the browser, download as a ddev
  project.

The engine (PHP worker, service worker, code editor, preview, full playground) comes from
[silverstripe-cms-playground](https://github.com/s2hub/silverstripe-cms-playground) as the npm package
`silverstripe-playground`; the site that runs is
[silverstripe-playground-site](https://github.com/s2hub/silverstripe-playground-site), as the bundle the playground
builds.

## Tutorials

One folder per tutorial in `tutorials/`, with a `tutorial.yml`: steps with Markdown text, files to open, tasks,
hints and solutions. See [tutorials/README.md](tutorials/README.md).

## Development

Node 22 or newer.

```sh
npm install
npm run bundle   # downloads the site bundle into bundle/
npm run dev      # http://localhost:5420
```

With a checkout of the playground next to this one, work on both at once:

```sh
npm install --no-save ../silverstripe-playground    # the engine from the checkout
PLAYGROUND_BUNDLE=../silverstripe-playground/build/bundle npm run dev
```

`npm run build` writes the site to `dist/` (static files: any web server with HTTPS, or localhost); `npm run
preview` serves it on port 5421.

**Deploy:** `.github/workflows/pages.yml` publishes to GitHub Pages on every push to main, at
https://exploresilverstripe.com (custom domain in Settings > Pages; DNS: the GitHub Pages A/AAAA records for the
apex, `www` as CNAME to `s2hub.github.io`).

**Develop instance:** the `develop` branch is published to https://develop.exploresilverstripe.com by
`.github/workflows/develop.yml`, through the `gh-pages` branch of
[explore-silverstripe-develop](https://github.com/s2hub/explore-silverstripe-develop) (Pages serves one site per
repository). It is kept out of search engines. Try changes there, then merge `develop` into `main`.

There is no lock file
(`.npmrc`): the engine and the bundle are always the latest of the playground's main branch, so they match. After a
change of the playground, run the workflow again (Actions > Deploy Explore Silverstripe > Run workflow).

## Code

- `src/main.js`: start page, routing, the site starting in the background, the tutorial view.
- `src/tutorial-runner.js`: runs a tutorial's steps (tasks, hints, solutions, reset).
- `src/scss/`: styles; the toolbar, menus, editor and preview are styled by the engine (`ui.css`, `app.css`).
- `bin/tutorials-plugin.js`: reads the tutorials and renders their Markdown at build time (`virtual:tutorials`).
- `bin/fetch-bundle.mjs`: downloads the site bundle.

## License

BSD-3-Clause
