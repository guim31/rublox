# CLAUDE.md — Rublox

Clone libre de Thunkable : on fabrique des applis pour téléphone avec des blocs, pour apprendre à
programmer, enfants comme adultes. Mainteneur : Guilhem (`guim31`).

`docs/SPEC.md` fait foi sur **ce que** Rublox doit faire et **comment** il est construit. Ce
fichier dit comment y travailler, et rassemble ce qui ne se lit pas dans le code : pièges déjà
payés, choix non évidents. Le compléter dès qu'un piège est découvert.

## Avant de commencer

- Lire `docs/SPEC.md` en entier. Le jalon demandé y est décrit au § 8, avec ses critères
  d'acceptation.
- Les versions des bibliothèques sont **postérieures à tes connaissances** (Blockly 13, Vite 8,
  TypeScript 7, pnpm 12, Better Auth 1.7, Hocuspocus 4, Vitest 5…). Ne pas écrire leur API de
  mémoire : lire les types et le README dans `node_modules`, ou leur documentation en ligne si
  l'environnement y a accès. Une API qui a changé se note ci-dessous, dans « Pièges ».

## Règles

- Un jalon = une branche `feat/j<N>-<sujet>` = une PR vers `main`. Ne jamais pousser sur `main`.
- Avant chaque push : `pnpm check` vert en local (Biome, types, tests, construction), et
  Playwright pour ce qui touche l'interface. Après chaque push, lire la CI de la PR et corriger
  jusqu'au vert : en session cloud, les outils GitHub du serveur MCP (`mcp__github__actions_list`
  pour les exécutions et leurs tâches, `mcp__github__get_job_logs` pour les journaux,
  `mcp__github__pull_request_read` pour l'état de la PR) ne passent pas par le proxy.
- Code, identifiants, commentaires et commits en anglais ; commits conventionnels (`feat:`,
  `fix:`, `chore:`…). Interface en français, au tutoiement, et en anglais, sans aucune chaîne
  en dur.
- **Dépôt public** : aucun secret, aucune adresse, nom d'hôte ou détail d'infrastructure privée.
  Les exemples utilisent `localhost` et `example.com`.
- Ne rien reprendre de Thunkable ni de Roblox : logo, illustrations, textes, sons.
- Nouvelle dépendance : maintenue, licence compatible MIT (pas de GPL ni d'AGPL dans ce qui est
  livré), poids justifié pour le studio et le lecteur.
- Une décision qui s'écarte du cahier des charges s'écrit dans `docs/SPEC.md`, avec sa raison.
- Fin de jalon : mettre à jour `docs/SPEC.md` § 0 et ce fichier (commandes, pièges), et joindre à
  la PR des captures d'écran en Junior et en Studio, en clair et en sombre.

## Environnement des sessions cloud

- Node 22 est installé ; l'image Docker vise Node 24. Déclarer `engines.node` à `>=22`.
- Le proxy refuse `api.github.com` et `codeload.github.com` : pas de `gh` (passer par les outils
  `mcp__github__*`), et aucune dépendance tirée d'une archive GitHub. Le registre npm passe.
- La PR brouillon ne s'ouvre pas toute seule : la créer avec `mcp__github__create_pull_request`
  (`draft: true`) après le premier push.
- Docker n'est pas supposé disponible : PGlite remplace PostgreSQL en développement et en test.
- Si Playwright ne peut pas télécharger son navigateur, chercher le Chromium préinstallé
  (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`).

## Commandes

- `pnpm install` puis `pnpm dev` : studio sur `localhost:5173`, lecteur sur `127.0.0.1:5174`,
  serveur sur `localhost:3000` (PGlite dans `apps/server/data/`, ni Docker ni base externe).
- `pnpm check` : Biome (avertissements bloquants), types, tests unitaires, construction. À passer
  avant chaque push.
- `pnpm test:e2e` : construit puis lance Playwright contre le serveur de production (les deux
  origines sur un port : `localhost:4310` et `127.0.0.1:4310`). En session cloud :
  `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm test:e2e`.
  Contre les serveurs de dev : `E2E_BASE_URL=http://localhost:5173 npx playwright test --project=e2e`.
- `pnpm screenshots` : captures de PR dans `docs/screenshots/j0/` (Junior, Studio, clair, sombre).
- `pnpm --filter @rublox/blocks test -- -u` : régénérer les instantanés du générateur, puis
  relire le diff du code produit.
- `pnpm --filter @rublox/server db:generate` : migration Drizzle après un changement de
  `apps/server/src/db/schema.ts`.
- `docker build -f docker/Dockerfile .` et `docker compose -f docker/compose.yaml up`.

## Où ajouter quoi

- Un composant : `packages/catalog/src/components/<type>.ts` (déclaration et textes FR/EN),
  `registry.ts`, rendu dans `packages/runtime/src/components/` + `RENDERERS`, icône dans
  `apps/studio/src/editor/component-icon.tsx`. Ses blocs et son générateur en découlent ; les tests
  de complétude disent ce qui manque. Voir `docs/SPEC.md` § 0.1 pour les contrats.
- Une chaîne d'interface : `packages/i18n/src/fr/*.ts` puis `en/*.ts` (TypeScript refuse une clé
  manquante ; `t('…')` est typé).

## Pièges

- **TypeScript 7** (`tsc` natif) fonctionne avec tout l'outillage du dépôt ; aucun outil n'a
  besoin de l'API JavaScript de TypeScript.
- **pnpm 12** est une réécriture : les scripts d'installation sont bloqués sauf ceux listés dans
  `allowBuilds` (`pnpm-workspace.yaml`), et les paquets trop récents sont ajoutés tout seuls à
  `minimumReleaseAgeExclude`. `save-exact=true` est dans `.npmrc`. `pnpm deploy --prod` copie les
  `files` du paquet.
- **Biome** : `files.includes` veut `!!dossier` pour ignorer un dossier ; un fichier de config
  partagé avec `"root": false` ne doit jamais devenir la racine (sinon tout est reformaté en
  tabulations). Les directives Tailwind demandent `css.parser.tailwindDirectives`.
- **Vite 8 + React Compiler** : `@vitejs/plugin-react` 6 n'a plus d'option Babel ; le compilateur
  passe par `@rolldown/plugin-babel` et `reactCompilerPreset()`.
- **Blockly 13** : en Node il faut un DOM (`vitest` en environnement `jsdom` pour
  `packages/blocks` et `packages/runtime`), le champ couleur en a besoin même en espace de
  travail sans rendu. Le constructeur de `FieldDropdown` appelle le générateur d'options avant que
  les champs de la sous-classe existent. Les espaces sont rendus par des espaces insécables dans
  le SVG (`\s` dans les sélecteurs de test). La classe du `g` d'un bloc contient son type.
- **Tailwind + Blockly** : le preflight donne `display: block` à tout `svg`, ce qui annule
  l'attribut `display="none"` de Blockly (barre de défilement du menu restée visible) : corrigé
  dans `app.css`. Les médias de Blockly sont servis par un petit plugin Vite (`/blockly-media/`).
- **tailwind-merge** confond les tailles `text-ui…` avec des couleurs : `lib/cn.ts` les déclare.
- **Origines** : le serveur choisit le lecteur seulement si `Host` vaut l'hôte d'`APPS_URL` ;
  toute autre valeur sert le studio. Le build range ses fichiers sous `/_app/` car `/assets/` est
  réservé aux ressources des projets sur l'origine des applis. La CSP du studio interdit les
  scripts en ligne (d'où `public/prefs.js`).
- **Playwright** : un clic à la souris dans l'iframe de l'aperçu, qui est réduit par
  `transform: scale`, tombe à côté de la cible ; utiliser `dispatchEvent('click')`. L'aperçu reçoit
  le nouveau code ~150 ms après la dernière modification : réessayer avec `expect(…).toPass()`.
- **Docker en session cloud** : `dockerd` se lance à la main ; les conteneurs de build ne font pas
  confiance au proxy (`SELF_SIGNED_CERT_IN_CHAIN`) : tester avec une copie jetable du Dockerfile
  qui ajoute `/root/.ccr/ca-bundle.crt`, ne jamais la commiter. Le premier démarrage de PGlite sur
  disque prend 5 à 9 s.
- **Shell** : `pkill -f <motif>` ou `pgrep -f vite | xargs kill` tue aussi le shell qui le lance ;
  arrêter les serveurs par PID ou par port.
