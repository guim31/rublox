// Bundles the server into a single ESM file. npm packages stay external (they are installed
// next to the bundle); workspace packages (`@rublox/*`, shipped as TypeScript sources) are bundled.
import { resolve } from 'node:path'
import { build } from 'esbuild'

await build({
  absWorkingDir: resolve(import.meta.dirname, '..'),
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
  plugins: [
    {
      name: 'externalize-npm-packages',
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) =>
          args.path.startsWith('@rublox/') ? undefined : { path: args.path, external: true },
        )
      },
    },
  ],
})
