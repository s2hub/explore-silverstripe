// Vite plugin: the tutorials in tutorials/<slug>/tutorial.yml as the module "virtual:tutorials". The YAML is read and
// its Markdown (a step's text and hint) rendered at build time, so the playground ships plain data and HTML.
//
// See tutorials/README.md for the format.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { marked } from 'marked';

const ID = 'virtual:tutorials';
const RESOLVED = `\0${ID}`;

const TASK_TYPES = ['opened', 'contains', 'built', 'visited'];

function load(directory) {
  const slugs = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(directory, entry.name, 'tutorial.yml')))
    .map((entry) => entry.name);

  return slugs
    .map((slug) => {
      const file = join(directory, slug, 'tutorial.yml');
      const tutorial = parse(readFileSync(file, 'utf8'));

      if (!tutorial?.title || !Array.isArray(tutorial.steps) || tutorial.steps.length === 0) {
        throw new Error(`${file}: a tutorial needs a title and steps`);
      }

      return {
        slug,
        order: tutorial.order ?? 100,
        title: tutorial.title,
        description: tutorial.description ?? '',
        duration: tutorial.duration ?? '',
        // A picture for the card, next to tutorial.yml: imported below, so Vite copies it with a hashed name.
        image: tutorial.image ? join(directory, slug, tutorial.image) : null,
        tags: tutorial.tags ?? [],
        steps: tutorial.steps.map((step, index) => {
          const where = `${file}, step ${index + 1}`;

          if (!step.title) {
            throw new Error(`${where}: a step needs a title`);
          }

          for (const task of step.tasks ?? []) {
            if (!task.label || !TASK_TYPES.some((type) => type in task)) {
              throw new Error(`${where}: a task needs a label and one of ${TASK_TYPES.join(', ')}`);
            }
          }

          for (const change of step.solution?.files ?? []) {
            if (!change.file || !('content' in change || ('after' in change && 'insert' in change))) {
              throw new Error(`${where}: a solution file needs a file and either content, or after and insert`);
            }
          }

          return {
            title: step.title,
            url: step.url ?? null,
            open: step.open ?? [],
            create: step.create ?? [],
            text: marked.parse(step.text ?? ''),
            hint: step.hint ? marked.parse(step.hint) : '',
            tasks: step.tasks ?? [],
            solution: { files: step.solution?.files ?? [], build: Boolean(step.solution?.build) },
          };
        }),
      };
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/**
 * @param {string} directory The folder with the tutorials
 */
export default function tutorials(directory) {
  return {
    name: 'silverstripe-playground-tutorials',
    resolveId: (id) => (id === ID ? RESOLVED : null),
    load(id) {
      if (id !== RESOLVED) {
        return null;
      }

      for (const slug of readdirSync(directory)) {
        const file = join(directory, slug, 'tutorial.yml');

        if (existsSync(file)) {
          this.addWatchFile(file);
        }
      }

      const list = load(directory);
      const imports = list
        .filter((tutorial) => tutorial.image)
        .map((tutorial, index) => {
          const name = `image${index}`;
          const path = tutorial.image;

          tutorial.image = name;

          return `import ${name} from ${JSON.stringify(path)};`;
        });
      // The images are variables in the module, not strings.
      const data = JSON.stringify(list).replace(/"image":"(image\d+)"/g, '"image":$1');

      return `${imports.join('\n')}\nexport default ${data};`;
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(directory) && file.endsWith('.yml')) {
        server.moduleGraph.invalidateModule(server.moduleGraph.getModuleById(RESOLVED));
        server.ws.send({ type: 'full-reload' });
      }
    },
  };
}
