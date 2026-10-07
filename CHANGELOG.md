# Changelog

All notable changes to Rublox. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and versions follow [Semantic Versioning](https://semver.org/). The specification, in French,
is [`docs/SPEC.md`](docs/SPEC.md); its § 0 says what each milestone settled and why.

## [1.1.0] — 2026-10-07

Apps to take apart: for children who have done the first tutorials and want to understand how a
real app works, before building their own.

### Learn

- **Apps to take apart**, a new section of the Learn page: four real apps, each in **four
  levels** that build on one another. Two games, **Star Catcher** (catch falling stars, then
  a score, lives and a record) and **Brick Breaker** (a bouncing ball, a wall of bricks, lives,
  difficulty levels and a bonus), **The Big Quiz** (questions, a timer, a score, themes and
  shuffled questions) and **My Piggy Bank** (money in and out, a savings goal, a chart and a
  history the phone remembers). Every level works on its own, in French and English, and its
  blocks are grouped into functions with telling names and short comments.
- **Your own copy**: “Open a copy” puts the level among your projects (in the browser without
  an account): children can change anything, the original stays as it is.
- **A guided tour of the code** in each level: a bubble points at the blocks one stack at a
  time, says what they do and why, then starts slow motion so that the child watches the blocks
  light up while the app runs.
- **Challenges**: each level ends with three small changes to make (“make the stars fall
  faster”, “give 5 lives instead of 3”…), ticked on their own when done, with a hint and a
  button that shows the block to change.
- **“Show me what’s new”**: from level 2, one button lights the blocks the level added (green)
  or changed (yellow) since the level before, and lists them.
- Progress (tours done, challenges succeeded) joins the rest of the learning progress, and each
  app finished earns its badge.

### Fixed

- The bubble of tutorials no longer hides under the blocks’ toolbox.
- Block comments are readable in dark mode.

## [1.0.0] — 2026-10-07

The first release: everything the specification asks for, from the guest mode to the game
mode, audited for security, accessibility and performance.

### Build apps

- **Screen designer**: palette by categories with search, layers (reorder, rename, hide, lock,
  duplicate), canvas in a phone frame (presets, orientation, zoom, light or dark app),
  inspector generated from the catalog, Row, Column, Box and Grid layouts, app theme, stack,
  tab or drawer navigation, multi-selection, copy and paste between screens and projects, undo
  and redo everywhere.
- **54 components** (and the screen): layout, base, inputs, display, lists, media, maps (MapLibre and OpenFreeMap),
  charts, sensors, device features (camera, microphone, speech, vibration, notifications, QR
  codes…), web APIs, Google Sheets, AI, and a game scene with sprites, scene text and a
  joystick. Each one has its blocks, its help sheet with an example, in French and English.
- **Blocks** (Blockly 13): a workspace per screen plus an app-wide one, events, properties and
  methods of the components on the screen, control, logic, maths, text, lists, objects,
  colours, variables (app, stored on the device, shared through the server), functions,
  screens, interface, device, data and debugging. Asynchronous blocks need no callback.
  Renaming a component updates its blocks.
- **Live preview** next to the blocks, console with errors written for children, code view of
  the generated JavaScript, slow motion that lights each block, breakpoints, safe loops and a
  Stop button.
- **Data**: tables (local or shared, typed columns, CSV import and export), API connections
  with secrets kept on the server and a relay, tables bound to lists, grids, maps and charts.
- **Game mode**: free placement, costumes, speed, gravity, bounces, collisions, touch and drag,
  clones; the demo « Attrape les fruits » is built only with blocks.

### Share and publish

- **Test on a phone** with a QR code: the app follows each edit live, with the phone's console
  in the editor.
- **Publish** as an installable PWA (Android and iPhone) at a stable address, with generated
  icons, offline support, versions and unpublishing; export as a `.rublox` file or as a
  standalone website; import.
- **Gallery** inside the instance: try, see the blocks, remix (with credit and a tree of
  remixes), likes, filters.
- **Edit together** in real time: presence, others' selection, blocks synced stack by stack,
  conflicts announced, undo limited to one's own edits, offline edits merged back.

### Learn

- **Junior and Studio** modes, light and dark themes, French and English.
- Interactive tutorials with a guiding bubble, challenges with three stars, badges, a help
  panel with a sheet for every block and component, a glossary and the keyboard shortcuts, a
  mascot, guided tours and a welcome page.
- **12 templates**, and an optional **AI assistant** (create an app, explain a block, find
  why it does not work, an AI component), off until the administrator gives an Anthropic API
  key, with quotas and a usage journal that never keeps what was asked.

### Accounts and self-hosting

- Accounts **by invitation only**, sign-in by username or e-mail and password, or passkey;
  family, class and team spaces whose managers create child accounts without e-mail and decide
  what members may do; administration of accounts, invitations, spaces and settings; export
  and deletion of one's data.
- A guest mode that keeps projects in the browser, and moves them into an account at sign-in.
- One Docker image (`ghcr.io/guim31/rublox`), PostgreSQL in production, PGlite in
  development; two origins (studio and apps) so that an app never runs next to a session.

### Security (J8 audit)

- An account's open editing connections close when its sessions end: disabled, password
  reset, deleted, signed out, sessions revoked.
- A space's "members may publish" can no longer be bypassed through a co-editor; a transferred
  project loses the former owner's AI billing and gallery sharing; switching the gallery off
  closes gallery access; a project in the trash takes no edit; data tickets end with the
  sharing that gave them.
- The relay refuses connection-set `Host` and hop-by-hop headers, the machine's own interface
  addresses, IPv6 transition ranges that carry an IPv4 address, and encoded path separators;
  request bodies are capped while they arrive; the AI relay checks the origin and counts IPv6
  clients by /64; parallel AI requests can no longer exceed the daily quota.
- The studio sends `Cross-Origin-Opener-Policy: same-origin`; messages from the preview are
  checked field by field; a published app's service worker only reads its own cache; live
  test links are rate-limited and kept out of the logs.

### Accessibility (J8 audit)

- axe (WCAG 2.2 AA) passes on every page and dialog, in Junior and Studio, light and dark, on
  the apps origin, and on the apps of all 12 templates.
- Blocks can be built with the keyboard only (Blockly 13's navigation with all its shortcuts),
  listed in the help's new « Clavier » tab.
- Apps get readable colours by default: text on a coloured button is white or near black,
  whichever reads better, and the primary colour is adjusted where it is used as text.
- Reduced motion also stops endless animations (spinners, pulses).

### Performance (J8)

- The studio downloads less than 300 KB (gzip) before the editor; Blockly, CodeMirror, the
  catalog and the AI load on demand. The preview shows a change in less than 300 ms, a
  property edit reaches the canvas in less than 50 ms; all three are measured by
  `e2e/budget-perf.spec.ts`.

[1.1.0]: https://github.com/guim31/rublox/releases/tag/v1.1.0
[1.0.0]: https://github.com/guim31/rublox/releases/tag/v1.0.0
