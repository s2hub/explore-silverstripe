# Tutorials

A tutorial is a folder `tutorials/<slug>/` with a `tutorial.yml`. The start page lists it as a card; it opens with
`?tutorial=<slug>` in a fresh site and shows its steps next to the code and the site. The build
(`bin/tutorials-plugin.js`) reads the files and renders their Markdown; a change shows up after a reload of
`npm run dev`.

```yaml
title: Add a field                 # shown on the card and in the toolbar ("2 · Add a field")
description: One sentence for the card.
order: 2                           # position and number on the start page (default 100)
duration: 10 min                   # on the card
tags: [PHP]                        # on the card
image: image.webp                  # picture on the card, next to tutorial.yml (optional; about 800 × 394)

steps:
  - title: Find the model
    url: /admin/contacts           # the page the preview opens when the step starts (optional)
    create:                        # files the step starts with, written unless they exist (optional)
      - file: app/src/EventPage.php
        content: |
          <?php ...
    open:                          # the files shown as tabs in the editor; the first one is active
      - app/src/Contacts/Contact.php
    text: |                        # Markdown; `code` is highlighted
      The Contacts section in the CMS comes from one PHP class, `Contact`.
    tasks:                         # ticked off as the learner works; each has a label and one condition
      - label: Opened Contact.php
        opened: app/src/Contacts/Contact.php          # the file was opened in the editor
      - label: Added Birthday to $db
        contains:                                     # the saved file matches a regular expression
          file: app/src/Contacts/Contact.php
          pattern: "'Birthday'\\s*=>\\s*'Date'"
      - label: Ran dev/build
        built: true                                   # dev/build ran without an error
      - label: Opened a contact's page
        visited: "^/contact/\\d+"                     # the preview showed a matching path
    hint: |                        # Markdown, shown with "Show a hint" (optional)
      Put the new line after `'Company' => 'Varchar',`.
    solution:                      # what "Show solution" does (optional)
      files:                       # insert text after an anchor, unless the text is there already
        - file: app/src/Contacts/Contact.php
          after: "'Company' => 'Varchar',"
          insert: "\n        'Birthday' => 'Date',"
        # - file: app/templates/X.ss  # or replace a whole file
        #   content: ...
      build: true                  # then run dev/build (otherwise the caches are flushed)
```

Files can only be in `app/`. A step without `url` keeps the page the learner is on. A step builds on the ones before: opening a tutorial at a later step
(`?tutorial=<slug>&step=3`) or jumping ahead applies the solutions of the steps in between. **Reset step** puts the
step's files back to how they were when the step started (the database stays as it is).
