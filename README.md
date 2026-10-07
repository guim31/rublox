# Rublox

Build real phone apps with blocks. Rublox is a free, self-hosted take on
[Thunkable](https://thunkable.com), for kids learning to code and for adults who want to build
useful apps without writing code. Version **1.0.0** — see the [changelog](CHANGELOG.md).

![The editor in Junior mode: blocks next to the live preview](docs/screenshots/j8/junior-light-template.png)

## What it does

- **Design screens** by drag and drop (or with the keyboard): 54 components, from buttons and
  text fields to lists, maps, charts, camera, sensors, speech, QR codes and a game scene.
- **Program them with blocks** ([Blockly](https://developers.google.com/blockly)): events,
  properties and methods of the components, control, maths, text, lists, objects, variables
  (in memory, stored on the device, shared through the server), functions, screens, data.
- **See it run instantly** in a phone frame next to the blocks, with a console whose errors are
  written for children, slow motion that lights up each block, breakpoints, and the generated
  JavaScript in the code view.
- **Test on your own phone** by scanning a QR code: the app follows every edit live.
- **Publish** as an installable PWA (Android and iPhone) with its own address, offline support
  and versions; export a `.rublox` file or a standalone website.
- **Two modes**: _Junior_ (playful, guided, simple blocks, a mascot) and _Studio_ (dense,
  complete, with the code view). Light and dark, French and English.
- **Learn**: interactive tutorials, challenges with stars, badges, a help sheet for every block
  and component, a glossary, guided tours, and 12 templates to start from.
- **Data and services**: tables (local or shared, CSV), web API connections whose secrets stay
  on the server, maps (OpenFreeMap) and charts bound to tables.
- **Game mode**: free placement, costumes, gravity, bounces, collisions, clones, a joystick.
- **Together**: accounts by invitation, family, class and team spaces where a parent or a teacher
  manages child accounts without e-mail, real-time co-editing, version history, sharing, a
  gallery with remixes.
- **Optional AI assistant**: create an app from a sentence, explain a block, find why it does not
  work, an AI component in apps. Off until the administrator gives an Anthropic API key.

| Studio, dark | Junior, keyboard and help | Game mode |
|---|---|---|
| ![Studio in dark mode](docs/screenshots/j8/studio-dark-template.png) | ![Keyboard shortcuts in the help](docs/screenshots/j8/junior-light-keys.png) | ![The game designer](docs/screenshots/j7/studio-light-design.png) |

The user guide explains everything, in [French](docs/guide/fr.md) and in
[English](docs/guide/en.md). The specification, in French, is [`docs/SPEC.md`](docs/SPEC.md).

## Try it locally

Node 22 or later and pnpm 12. No Docker and no database needed for development.

```sh
pnpm install
# studio on http://localhost:5173, player (apps) on http://127.0.0.1:5174, API on :3000
RUBLOX_ADMIN_USERNAME=admin RUBLOX_ADMIN_PASSWORD=change-me pnpm dev
```

The administrator account is created on first start, when the database has no account (the
development database is PGlite, in `apps/server/data/`). Everyone else joins with an
invitation link, or gets an account from a parent or a teacher. "Try without an account" keeps
projects in the browser.

## Self-hosting

Rublox ships as one Docker image, `ghcr.io/guim31/rublox` (`:1.0.0`, `:latest`, or `:edge` for
`main`), that serves the studio, the API, the WebSockets and the published apps. An example
with PostgreSQL is in [`docker/compose.yaml`](docker/compose.yaml):

```sh
docker compose -f docker/compose.yaml up -d
```

**Two host names.** The studio and the apps are two origins, so that an app's code never runs
next to a session: for example `https://rublox.example.com` (studio) and
`https://apps.rublox.example.com` (apps). Put a reverse proxy with TLS in front of the
container (port 3000) for both names, forward WebSockets (`/ws/*` on the studio, `/_rx/*` on
the apps), and set `X-Real-IP` if you enable `TRUST_PROXY`. Back up the PostgreSQL database and
the `/data` volume (uploaded files).

| Variable | Required | Default | What it does |
|---|---|---|---|
| `STUDIO_URL` | yes | — | Public address of the studio, e.g. `https://rublox.example.com`. |
| `APPS_URL` | yes | — | Public address of the apps, another host name, e.g. `https://apps.rublox.example.com`. |
| `RUBLOX_SECRET` | yes | — | 32 bytes or more, random (`openssl rand -base64 48`). Signs invitations, links and tickets, encrypts the projects' secrets. The server refuses to start without it, or with the example value. |
| `DATABASE_URL` | no | PGlite in `DATA_DIR` | `postgres://user:password@host:5432/rublox`. PostgreSQL is recommended in production. Migrations run at start. |
| `DATA_DIR` | no | `/data` (image) | Uploaded files (and the PGlite database without `DATABASE_URL`). |
| `RUBLOX_ADMIN_USERNAME`, `RUBLOX_ADMIN_PASSWORD` | first start | — | The first administrator, created only when the database has no account. Remove them afterwards. |
| `TRUST_PROXY` | no | `false` | `true` behind a reverse proxy that sets `X-Real-IP`: the client address used against brute force (5 failures in 15 minutes). `X-Forwarded-For` is never read. |
| `MAX_UPLOAD_MB` | no | `20` | Default largest upload; the administration page can change it, and the storage quota per account. |
| `RUBLOX_RELAY_DENY` | no | — | What the API relay must never call, on top of private addresses and the instance's own addresses (always refused): comma-separated name suffixes (`example.com` also refuses `*.example.com`) and IPv4 or IPv6 ranges (`203.0.113.0/24`, `2001:db8::/32`). Behind a home router, list your other services and your public address range. An invalid entry stops the start. |
| `ANTHROPIC_API_KEY` | no | — | Turns the AI assistant on (it costs per use). Without it, the studio shows no AI at all. Then enable it, and set daily quotas, in Administration › Settings. |
| `RUBLOX_AI_MODEL` | no | `claude-opus-5-5` | Model that builds apps ("Create with AI"). |
| `RUBLOX_AI_FAST_MODEL` | no | `claude-haiku-4-5` | Model that explains, debugs, and answers the AI component. |
| `PORT`, `HOST` | no | `3000`, `0.0.0.0` | Where the server listens. |
| `LOG_LEVEL` | no | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`. Logs never hold a password, a secret, a token or what was asked to the AI. |

The container runs as a non-root user and has a health check on `/healthz`. Nothing is sent to a
third party without an explicit action: no telemetry, no CDN; maps load tiles from OpenFreeMap
only when an app shows a map.

## Development

```sh
pnpm check       # Biome, types, unit tests, build: run before every push
pnpm test:e2e    # Playwright against the production build (accessibility, budgets…)
pnpm screenshots # the screenshots of docs/screenshots/
```

[`CLAUDE.md`](CLAUDE.md) gathers the commands, where to add a component, a block, a string or a
route, and the pitfalls already met. TypeScript, React 19, Vite, Tailwind CSS, Blockly, Yjs and
Hocuspocus, Hono, Better Auth, Drizzle with PostgreSQL or PGlite, MapLibre.

## License

[MIT](LICENSE).

Rublox is an independent project. It is not affiliated with, endorsed by or connected to
Thunkable, Inc. or Roblox Corporation.
