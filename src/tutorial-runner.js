// Runs a tutorial (from tutorials/<slug>/tutorial.yml, see tutorials/README.md): shows its steps, opens their files
// in the code editor and their pages in the preview, ticks off the tasks as the learner works, and applies
// solutions.

/**
 * @param {object} options
 * @param {object} options.elements  The panel's and the toolbar's elements (see main.js)
 * @param {object} options.editor    The engine's code editor
 * @param {object} options.preview   The engine's preview
 * @param {(message: string, isError?: boolean) => void} options.setStatus
 * @param {() => void} options.onFinish Called by "Next" on the last step
 */
export function createTutorialRunner({ elements, editor, preview, setStatus, onFinish }) {
  let tutorial = null;
  let index = 0;

  /** For each step, the indexes of its tasks that are done. */
  let done = [];

  /** The content of the step's files when it started (null: the file did not exist), for "Reset step". */
  let startContents = new Map();

  const step = () => tutorial.steps[index];

  /** The files a step works on: the ones it opens and the ones its solution changes. */
  const stepFiles = (s) => [...new Set([...s.open, ...s.create.map(({ file }) => file), ...s.solution.files.map((change) => change.file)])];

  async function read(path) {
    try {
      return await editor.read(path);
    } catch {
      return null;
    }
  }

  function render() {
    const current = step();

    elements.title.textContent = `${tutorial.order} · ${tutorial.title}`;
    elements.steps.replaceChildren(
      ...tutorial.steps.map((s, i) => {
        const item = document.createElement('li');
        const button = Object.assign(document.createElement('button'), { type: 'button', textContent: String(i + 1), title: s.title });

        if (i === index) {
          button.setAttribute('aria-current', 'step');
        }

        button.classList.toggle('done', isStepDone(i));
        button.onclick = () => goTo(i).catch(fail);
        item.append(button);

        return item;
      })
    );

    elements.count.textContent = `Step ${index + 1} of ${tutorial.steps.length}`;
    elements.stepTitle.textContent = current.title;
    elements.text.innerHTML = current.text;
    elements.hint.innerHTML = current.hint;
    elements.hintToggle.hidden = !current.hint;
    elements.solution.hidden = current.solution.files.length === 0 && !current.solution.build;
    elements.back.disabled = index === 0;
    elements.next.textContent = index === tutorial.steps.length - 1 ? 'Finish' : 'Next';
    renderTasks();
  }

  function renderTasks() {
    elements.tasks.replaceChildren(
      ...step().tasks.map((task, i) => {
        const item = Object.assign(document.createElement('li'), { textContent: task.label });

        item.classList.toggle('done', done[index].has(i));

        return item;
      })
    );

    for (const [i, button] of [...elements.steps.querySelectorAll('button')].entries()) {
      button.classList.toggle('done', isStepDone(i));
    }
  }

  function isStepDone(i) {
    return tutorial.steps[i].tasks.length > 0 && done[i].size === tutorial.steps[i].tasks.length;
  }

  function fail(error) {
    console.error(error);
    setStatus(error.message, true);
  }

  function showHint(show) {
    elements.hint.hidden = !show;
    elements.hintToggle.setAttribute('aria-expanded', String(show));
  }

  /** Ticks off the tasks of the current step that an event completes. */
  async function handle(event) {
    if (!tutorial) {
      return;
    }

    const tasks = step().tasks;
    let changed = false;

    for (const [i, task] of tasks.entries()) {
      if (done[index].has(i)) {
        continue;
      }

      let met = false;

      if ('opened' in task) {
        met = event.type === 'opened' && event.path === task.opened;
      } else if ('built' in task) {
        met = event.type === 'built' && event.ok;
      } else if ('visited' in task) {
        met = event.type === 'visited' && new RegExp(task.visited).test(event.path);
      } else if ('contains' in task && (event.type === 'saved' || event.type === 'check') && (event.path ?? task.contains.file) === task.contains.file) {
        met = new RegExp(task.contains.pattern).test((await read(task.contains.file)) ?? '');
      }

      if (met) {
        done[index].add(i);
        changed = true;
      }
    }

    if (changed) {
      renderTasks();
    }
  }

  /**
   * Applies a step's solution to the files. Changes that are there already are skipped, so it also works after the
   * learner did part of the step.
   *
   * @returns {Promise<boolean>} Whether a file changed
   */
  async function applyChanges(s) {
    let changed = false;

    for (const change of s.solution.files) {
      const content = await read(change.file);
      let next;

      if ('content' in change) {
        next = change.content;
      } else if (content === null) {
        throw new Error(`${change.file} does not exist: reset the step or the tutorial`);
      } else if (content.includes(change.insert.trim())) {
        next = content;
      } else {
        const at = content.indexOf(change.after);

        if (at < 0) {
          throw new Error(`Cannot find the place for the solution in ${change.file}: reset the step and try again`);
        }

        next = content.slice(0, at + change.after.length) + change.insert + content.slice(at + change.after.length);
      }

      if (next !== content) {
        await editor.write(change.file, next);
        changed = true;
      }
    }

    return changed;
  }

  /** Applies the solutions of several steps, then flushes the caches or runs dev/build once. */
  async function applySolutions(steps, message) {
    let changed = false;

    for (const s of steps) {
      changed = (await applyChanges(s)) || changed;
    }

    if (steps.some((s) => s.solution.build)) {
      await editor.build();
    } else if (changed) {
      await editor.flushAndReload(message);
    }
  }

  async function enter(i) {
    index = i;
    showHint(false);
    render();

    const url = new URL(location.href);

    url.searchParams.set('step', String(i + 1));
    history.replaceState(history.state, '', url.href);

    const current = step();
    let created = false;

    // Files the step starts with, unless they are there already.
    for (const { file, content } of current.create) {
      if ((await read(file)) === null) {
        await editor.write(file, content);
        created = true;
      }
    }

    if (created) {
      await editor.flushAndReload('Created the files of this step');
    }

    startContents = new Map();

    for (const path of stepFiles(current)) {
      startContents.set(path, await read(path));
    }

    // A step without files (e.g. in the CMS only) gives the site the whole width.
    document.body.classList.toggle('without-code', current.open.length === 0);
    await editor.showOnly(current.open);

    if (current.url) {
      preview.go(current.url);
    }

    await handle({ type: 'check' });

    // A step without a page of its own goes on where the learner is.
    if (!current.url) {
      await handle({ type: 'visited', path: preview.path });
    }

    elements.resetStep.disabled = false;
    setStatus('');
  }

  /** Goes to another step; going ahead applies the solutions of the steps in between. */
  async function goTo(i) {
    if (i === index) {
      return;
    }

    if (i > index) {
      setStatus(`Catching up to step ${i + 1}`);
      await applySolutions(tutorial.steps.slice(index, i), 'Applied the steps in between');
    }

    await enter(i);
  }

  async function resetStep() {
    elements.resetStep.disabled = true;

    try {
      for (const [path, content] of startContents) {
        if (content !== null && (await read(path)) !== content) {
          await editor.write(path, content);
        }
      }

      done[index] = new Set();
      await editor.flushAndReload(`Reset step ${index + 1}`);
      await enter(index);
    } finally {
      elements.resetStep.disabled = false;
    }
  }

  async function showSolution() {
    elements.solution.disabled = true;

    try {
      await applySolutions([step()], 'Applied the solution');
      await editor.showOnly(step().open);
      await handle({ type: 'check' });
    } finally {
      elements.solution.disabled = false;
    }
  }

  elements.hintToggle.onclick = () => showHint(elements.hint.hidden);
  elements.back.onclick = () => index > 0 && goTo(index - 1).catch(fail);
  elements.next.onclick = () => (index < tutorial.steps.length - 1 ? goTo(index + 1).catch(fail) : onFinish());
  elements.solution.onclick = () => showSolution().catch(fail);
  elements.resetStep.onclick = () => resetStep().catch(fail);

  return {
    /** Starts a tutorial in a fresh site, at a step (1-based); the steps before it are applied. */
    async start(newTutorial, stepNumber = 1) {
      tutorial = newTutorial;
      done = tutorial.steps.map(() => new Set());
      index = 0;

      const target = Math.min(Math.max(1, stepNumber), tutorial.steps.length) - 1;

      render();

      if (target > 0) {
        setStatus(`Catching up to step ${target + 1}`);
        await applySolutions(tutorial.steps.slice(0, target), 'Applied the steps before');
      }

      await enter(target);
    },
    stop() {
      tutorial = null;
    },
    handle: (event) => handle(event).catch(fail),
  };
}
