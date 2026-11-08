// Explore Silverstripe: a start page with the tutorials and a tutorial view, in one page, so the Silverstripe site
// that starts in the background on the start page is ready when a tutorial opens.
//
// ?tutorial=<slug>&step=<n> opens a tutorial (at a step); without it, the start page shows.

import { createPlayground, createPreview, createSplitter, freeSlug } from 'silverstripe-playground';
import { createSitesMenu } from 'silverstripe-playground/sites-menu';
import tutorials from 'virtual:tutorials';
import { createTutorialRunner } from './tutorial-runner.js';
import 'silverstripe-playground/ui.css';
import 'silverstripe-playground/app.css';
import './scss/main.scss';

const $ = (selector) => document.querySelector(selector);

const elements = {
  progressBar: $('#progress-bar'),
  progressLabel: $('#progress-label'),
  cards: $('#tutorial-cards'),
  status: $('#status'),
  leave: $('#leave-tutorial'),
  code: $('#tutorial-code'),
  panel: {
    title: $('#tutorial-title'),
    steps: $('#tutorial-steps'),
    count: $('#step-count'),
    stepTitle: $('#step-title'),
    text: $('#step-text'),
    tasks: $('#step-tasks'),
    hintToggle: $('#hint-toggle'),
    hint: $('#step-hint'),
    back: $('#step-back'),
    solution: $('#step-solution'),
    next: $('#step-next'),
    resetStep: $('#reset-step'),
  },
};

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.title = message;
  elements.status.classList.toggle('ssp-status--error', isError);
}

function setProgress(message, fraction) {
  if (fraction !== undefined) {
    elements.progressBar.style.width = `${Math.round(fraction * 100)}%`;
    elements.progressLabel.textContent = `Preparing the site… ${Math.round(fraction * 100)} %`;
  }

  setStatus(message);
}

const playground = createPlayground({ onProgress: setProgress });
let runner = null;
let editor = null;
const preview = createPreview($('#tutorial-preview'), {
  onNavigate: (path) => runner?.handle({ type: 'visited', path }),
});

createSplitter($('#splitter'), elements.code, { storageKey: 'explore-silverstripe:code-width' });
createSitesMenu($('#sites-menu'), { link: (slug) => `./playground.html?site=${encodeURIComponent(slug)}` });

/**
 * The running site. A tutorial starts from a fresh one: once a tutorial changed it, the next one boots a new one.
 */
let booting = null;
let fresh = false;

function boot() {
  fresh = true;
  elements.progressBar.parentElement.parentElement.classList.remove('progress--done');
  booting = playground.boot({ login: true }).then((info) => {
    preview.setSiteUrl(info.siteUrl);
    preview.setMeta(`${info.username} / ${info.password}`, `Silverstripe ${info.manifest.silverstripe} · PHP ${info.phpVersion}`);
    elements.progressBar.style.width = '100%';
    elements.progressLabel.textContent = `The site is ready (Silverstripe ${info.manifest.silverstripe})`;
    elements.progressBar.parentElement.parentElement.classList.add('progress--done');
    setStatus(`Ready in ${(info.timings.ready / 1000).toFixed(1)} s`);

    // For tests and debugging.
    window.silverstripePlayground = info;

    return info;
  });
  booting.catch((error) => {
    console.error(error);
    elements.progressLabel.textContent = error.message;
    setStatus(error.message, true);
  });

  return booting;
}

/** The code editor and the tutorial runner: Monaco is large, so they load with the first tutorial. */
async function ensureRunner() {
  if (!runner) {
    const { createCodeEditor } = await import('silverstripe-playground/code-editor');

    editor = createCodeEditor(elements.code, {
      call: playground.call,
      setStatus,
      reloadSite: () => preview.reload(),
      onEvent: (event) => runner?.handle(event),
      tree: false,
      output: 'dark',
    });
    runner = createTutorialRunner({ elements: elements.panel, editor, preview, setStatus, onFinish: () => navigate('') });
  }

  return runner;
}

function renderCards() {
  const playgroundCard = elements.cards.querySelector('.card--playground');

  for (const tutorial of tutorials) {
    const item = Object.assign(document.createElement('li'), { className: 'card' });
    const link = Object.assign(document.createElement('a'), { className: 'card__link', href: `?tutorial=${tutorial.slug}` });

    link.innerHTML = `
      <img class="card__image" width="800" height="394" alt="">
      <div class="card__body">
        <h2 class="card__title"></h2>
        <p class="card__text"></p>
        <ul class="card__tags"></ul>
      </div>`;
    if (tutorial.image) {
      link.querySelector('.card__image').src = tutorial.image;
    } else {
      link.querySelector('.card__image').remove();
      link.prepend(Object.assign(document.createElement('div'), { className: 'card__image' }));
    }

    link.querySelector('.card__title').textContent = `${tutorial.order} · ${tutorial.title}`;
    link.querySelector('.card__text').textContent = tutorial.description;
    link.querySelector('.card__tags').append(
      ...[tutorial.duration, ...tutorial.tags].filter(Boolean).map((tag) => Object.assign(document.createElement('li'), { textContent: tag }))
    );
    link.onclick = (event) => {
      event.preventDefault();
      navigate(`?tutorial=${tutorial.slug}`);
    };
    item.append(link);
    elements.cards.insertBefore(item, playgroundCard);
  }
}

async function showTutorial(tutorial, step) {
  document.body.dataset.view = 'tutorial';
  document.title = `${tutorial.title} · Explore Silverstripe`;
  elements.leave.disabled = true;
  elements.panel.resetStep.disabled = true;

  const tutorialRunner = await ensureRunner();

  tutorialRunner.stop();

  // A tutorial starts from a fresh site.
  if (!fresh) {
    preview.setSiteUrl(null);
    boot();
  }

  await booting;
  fresh = false;
  await editor.reset();
  await tutorialRunner.start(tutorial, step);
  elements.leave.disabled = false;
}

function showHome() {
  document.body.dataset.view = 'home';
  document.title = 'Explore Silverstripe';
  runner?.stop();
}

/** Shows the view of the current URL. */
function route() {
  const params = new URLSearchParams(location.search);
  const tutorial = tutorials.find(({ slug }) => slug === params.get('tutorial'));

  if (tutorial) {
    showTutorial(tutorial, Number(params.get('step')) || 1).catch((error) => {
      console.error(error);
      setStatus(error.message, true);
    });
  } else {
    showHome();
  }
}

function navigate(search) {
  history.pushState(null, '', search || location.pathname);
  route();
}

/**
 * Saves the site in this browser and opens it in the full playground, on the page the preview shows.
 */
async function leaveTutorial() {
  if (editor.hasUnsavedChanges() && !confirm('Some files have unsaved changes, which the playground will not have. Continue?')) {
    return;
  }

  elements.leave.disabled = true;

  try {
    const title = `${tutorials.find(({ slug }) => slug === new URLSearchParams(location.search).get('tutorial'))?.title ?? 'Tutorial'} (tutorial)`;
    const site = await freeSlug(title);

    setStatus('Saving the site in this browser');
    await playground.save(site, title);
    location.href = `./playground.html?site=${encodeURIComponent(site)}&url=${encodeURIComponent(preview.path)}`;
  } catch (error) {
    setStatus(error.message, true);
    elements.leave.disabled = false;
  }
}

for (const link of document.querySelectorAll('[data-link="home"]')) {
  link.onclick = (event) => {
    event.preventDefault();
    navigate('');
  };
}

elements.leave.onclick = leaveTutorial;
addEventListener('popstate', route);
renderCards();
boot();
route();
