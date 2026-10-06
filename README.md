# Rublox

Build real phone apps with blocks. Rublox is a free, self-hosted take on
[Thunkable](https://thunkable.com), for kids learning to code and for adults who want
to build useful apps without writing code.

> **Status: early development.** Nothing is usable yet. The full specification (in
> French) lives in [`docs/SPEC.md`](docs/SPEC.md).

## What it will do

- **Design screens** by drag and drop: buttons, text, inputs, images, lists, maps,
  charts, camera, sensors, and more.
- **Program them with blocks** ([Blockly](https://developers.google.com/blockly)),
  and read the JavaScript those blocks generate.
- **See it run instantly** in a phone frame next to the editor, or on your own phone
  by scanning a QR code.
- **Publish** your app as an installable PWA (Android and iPhone), with its own
  address and offline support.
- **Two modes**: _Junior_ (playful, guided, simplified blocks) and _Studio_ (dense,
  complete, with the code view).
- **Learn**: interactive tutorials, challenges, badges, and a slow-motion mode that
  lights up each block as it runs.
- **Accounts by invitation**: family and class spaces, where a parent or a teacher
  manages child accounts that need no e-mail address.
- **Work together** in real time, keep a version history, share and remix projects.
- **Data and services**: tables, stored and shared variables, web APIs, maps.
- **Optional AI assistant**: bring your own Anthropic API key, or leave it off.
- Interface in **French and English**.

## Tech

TypeScript, React 19, Vite, Tailwind CSS, Blockly, Yjs, Hono, Better Auth, Drizzle
and PostgreSQL. Self-hosting through a Docker image (coming soon).

## License

[MIT](LICENSE).

Rublox is an independent project. It is not affiliated with, endorsed by or connected
to Thunkable, Inc. or Roblox Corporation.
