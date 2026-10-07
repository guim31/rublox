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
  Premier lancement avec un administrateur :
  `RUBLOX_ADMIN_USERNAME=admin RUBLOX_ADMIN_PASSWORD=admin-password pnpm dev` (créé seulement si la
  base n'a aucun compte ; repartir de zéro : supprimer `apps/server/data/`).
- `pnpm check` : Biome (avertissements bloquants), types, tests unitaires, construction. À passer
  avant chaque push.
- `pnpm test:e2e` : construit puis lance Playwright contre le serveur de production (les deux
  origines sur un port : `localhost:4310` et `127.0.0.1:4310`, base en mémoire, administrateur
  `admin` / `admin-password` créé au démarrage). En session cloud :
  `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm test:e2e`.
  Contre les serveurs de dev : `E2E_BASE_URL=http://localhost:5173 npx playwright test --project=e2e`.
- `pnpm screenshots` : captures de PR (Junior, Studio, clair, sombre), une spec par jalon
  (`e2e/screenshots*.spec.ts` → `docs/screenshots/j0/`, `j1/`, `j2/`, `j3/`, `j4/`). Lancer seulement celle du jalon :
  `npx playwright test --project=screenshots e2e/screenshots-j1.spec.ts` après `pnpm build`.
- `cd packages/blocks && npx vitest run -u` : régénérer les instantanés du générateur, puis
  relire le diff du code produit (`pnpm --filter … test -- -u` n'écrit que les nouveaux). En CI
  (`CI=true`), Vitest échoue aussi sur un instantané **obsolète** : après une fusion, lancer
  `CI=true npx vitest run` dans le paquet, le cache de turbo masquant l'échec en local.
- Mode jeu : `npx playwright test --project=e2e e2e/game.spec.ts` (la démo jouée, le designer) et
  `npx playwright test --project=perf --no-deps` (50 lutins : débit d'images et JavaScript par
  image, processeur ralenti ×4 ; les chiffres s'affichent dans la sortie). Le projet `perf`
  attend la fin des autres tests (`dependencies`) : mesurer sous charge ne veut rien dire. Captures :
  `npx playwright test --project=screenshots e2e/screenshots-j7.spec.ts` → `docs/screenshots/j7/`.
- Données et services (J5) : `npx playwright test --project=e2e e2e/data.spec.ts` (tutoriel Météo
  de bout en bout, Tchat familial entre deux navigateurs) et `e2e/a11y-j5.spec.ts` ; le relais et
  les adresses privées : `cd apps/server && npx vitest run test/relay.test.ts test/shared.test.ts`.
  Captures : `npx playwright test --project=screenshots e2e/screenshots-j5.spec.ts` →
  `docs/screenshots/j5/`.
- IA (J6) : `pnpm test:e2e` lance aussi un second serveur avec l'IA (`localhost:4320`, base en
  mémoire) branché sur un faux Claude (`e2e/fake-anthropic.mjs`, port 4329, réponses dans
  `e2e/fixtures/`) : `npx playwright test --project=e2e e2e/ai.spec.ts`. En développement :
  `ANTHROPIC_API_KEY=… pnpm dev` (vraie clé, jamais commitée), puis activer l'IA dans
  Administration › Réglages. Modèles : `RUBLOX_AI_MODEL`, `RUBLOX_AI_FAST_MODEL`.
- Modèles de projets : `cd packages/templates && npx vitest run` (chaque modèle construit en FR
  et EN, chargé dans Blockly, code généré). Captures : `e2e/screenshots-j6.spec.ts` →
  `docs/screenshots/j6/`.
- `pnpm --filter @rublox/server db:generate` : migration Drizzle après un changement de
  `apps/server/src/db/schema.ts`.
- `docker build -f docker/Dockerfile .` et `docker compose -f docker/compose.yaml up`.

## Où ajouter quoi

- Un composant : `packages/catalog/src/components/<type>.ts` (déclaration et textes FR/EN),
  `registry.ts`, rendu dans `packages/runtime/src/components/` + `RENDERERS`, comportement
  (méthodes, minuteurs, capteurs) dans `packages/runtime/src/behaviors/` + `BEHAVIORS`, icône dans
  `apps/studio/src/editor/component-icon.tsx`, et une place dans l'appli de démonstration
  (`packages/catalog/src/demo/demo.ts`). Ses blocs et son générateur en découlent ; les tests
  de complétude disent ce qui manque. Voir `docs/SPEC.md` § 0.1 et § 0.4 pour les contrats.
- Une fonction du navigateur (caméra, capteur…) : `availableProp()` et `errorEvent()` dans la
  déclaration, `available` et `ctx.fail(...)` dans le comportement (messages de
  `behaviors/device.ts`), une ligne dans `docs/compatibilite.md`.
- Une chaîne d'interface : `packages/i18n/src/fr/*.ts` puis `en/*.ts` (TypeScript refuse une clé
  manquante ; `t('…')` est typé). Celles des comptes, espaces et administration sont dans
  `accounts.ts`, celles du catalogue (J2) dans `catalog.ts` (espace `catalog` :
  `useTranslation('catalog')`).
- Un tutoriel ou un défi : un dossier `content/tutorials/<id>/` (`tutorial.json`, `fr.json`,
  `en.json`) ou `content/challenges/<id>/`, puis une ligne dans `packages/learn/src/content.ts`.
  Les vérifications et les cibles sont décrites dans `packages/learn/src/{conditions,model}.ts` ;
  `pnpm --filter @rublox/learn test` vérifie les deux langues et les types cités. Un élément
  d'interface que la bulle doit montrer porte `data-tour="…"` (`apps/studio/src/learn/targets.ts`).
- Les chaînes du J3 (apprentissage, accueil, aide, ralenti) sont dans `learn.ts`, les fiches des
  blocs et le glossaire dans `help.ts` (tout nouveau bloc général demande sa fiche).
- Une écriture du serveur dans un projet : `services.collab.edit(id, userId, fn)` (jamais
  directement dans `project_docs`, que Hocuspocus réécrirait).
- Un composant de jeu : comme ci-dessus, avec `parents: ['GameScene']` (et l'ajouter aux
  `accepts` de la scène) ; son dessin à l'exécution va dans `World` (`runtime/src/game/`), pas
  dans React. Une démo : `packages/catalog/src/demos/` (blocs écrits en JSON avec
  `blocks-json.ts`), puis une entrée dans `apps/studio/src/storage/demos.ts`.
- Un bloc de données (table, API, objet) : `packages/blocks/src/data-blocks.ts` (définition,
  générateur, boîte à outils) et son type dans `data-types.ts`, ce qu'il appelle dans
  `packages/runtime/src/data/api.ts` (`data`, `web`, `rx.get`), sa fiche dans
  `packages/i18n/src/{fr,en}/data.ts` (`blockSheets`).
- Ce qu'une appli demande au serveur (relais, données partagées) : le protocole dans
  `packages/schema/src/services.ts`, le serveur dans `apps/server/src/data/`, le client dans
  `apps/player/src/data.ts` ; toute nouvelle façon d'entrer passe par `resolveCredential`.
- Un modèle de projet : un dossier `content/templates/<id>/` (`template.json` : la recette
  `AppSpec`, `fr.json`, `en.json`), puis une ligne dans `packages/templates/src/content.ts`. Dans
  les blocs d'une recette, composants, écrans et variables se nomment par leur `key` (ou leur
  nom) ; le constructeur met les identifiants.
- Tout ce qui touche l'IA côté studio se montre seulement si `useFeatures().ai` (ou `aiAllowed()`
  hors React) ; un composant qui a besoin de l'IA va dans `AI_TYPES` (`lib/features.ts`).
- Une route d'API : `apps/server/src/routes/<domaine>.ts`, corps validé par `jsonBody(zod)`,
  droits par `access.ts`, test sur PGlite avec `test/server.ts` (`createTestServer`, un `Client`
  par navigateur). Côté studio : `call(api.<route>.$get(…))`.

## Pièges

- **TS2589 (« Type instantiation is excessively deep »)** : quand les chaînes grossissent, un
  paramètre typé `ReturnType<typeof useTranslation>['t']` devient trop profond ; le typer
  `TFunction` (`i18next`).
- **pnpm add** écrit parfois `^x.y.z` malgré `save-exact` : vérifier `package.json` après un ajout.
- **WebSockets** : tout passe par `Upgrades` (`apps/server/src/upgrades.ts`), un seul écouteur
  `upgrade`. L'authentification d'une socket est asynchrone : un client est « entré » à son
  premier message (`phones` pour l'éditeur du test en direct), pas à `open`.
- **Service worker** : `navigator.serviceWorker.ready` répond dès l'état `activating` ; attendre
  `activated` avant de couper le réseau (`context.setOffline`). Le service worker d'une appli ne
  s'enregistre qu'en production (`import.meta.env.PROD`) : en développement, `/a/<slug>/` vient
  de Vite et `/_app/` n'existe pas.
- **Playwright et deux pages** : `Escape` n'atteint pas toujours un dialogue Radix quand une autre
  page (le téléphone émulé) a été ouverte entre-temps ; cliquer « Fermer ». `devices['iPhone 13']`
  donne l'agent utilisateur d'un iPhone même dans Chromium.
- **Captures avec un compte** : le profil l'emporte sur les préférences du navigateur
  (`useProfileSync`) ; un compte par capture, son profil réglé par `PATCH /api/me`.

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
- **Doubles copies de Blockly** : `better-auth` amène `@noble/hashes`, pair facultatif de `jsdom`,
  donc pnpm installe deux variantes de `blockly` (studio et `@rublox/blocks`). Deux copies = deux
  registres d'espaces de travail (`getWorkspaceById` rend `null`, le glisser casse) : le studio
  force une copie avec `resolve.dedupe` (`apps/studio/vite.config.ts`). Vérifier
  `ls node_modules/.pnpm | grep ^blockly` après un ajout de dépendance.
- **Better Auth 1.7** : `auth.api.*` côté serveur ignore la liste blanche (`AUTH_ROUTES`), qui ne
  filtre que les requêtes HTTP. Un mauvais mot de passe répond 401, un compte désactivé 403.
  Le plugin passkey est un paquet à part (`@better-auth/passkey`, client dans `/client`). Sans
  `logger`, `createAuth` est silencieux (tests). L'adresse IP vient de l'en-tête interne
  `x-rublox-client-ip`, posé par `handleAuth` (`app.ts`).
- **Hono + hc** : un `validator` donne au client le type de **sortie** du schéma (un champ avec
  `.default()` devient obligatoire) : passer par `jsonBody`, qui expose le type d'entrée.
  `c.header('Set-Cookie', …, { append: true })` pour recopier plusieurs cookies.
- **`setMeta` (schema)** efface les clés passées à `undefined` (dont `updatedAt`, obligatoire) :
  ne passer que les champs voulus (`writeMeta` côté serveur).
- **turbo** ne transmet aux tâches que les variables listées : celles du serveur pour `pnpm dev`
  sont dans `turbo.json` (`passThroughEnv`).
- **Proxy Vite du lecteur** : `/assets` est relayé vers le serveur avec `Host: 127.0.0.1:5174`,
  sinon le serveur croit parler au studio.
- **Routes TanStack** : un fichier de `routes/` n'exporte que `Route` (découpage du code) ; ce
  qui est partagé va ailleurs (`spaces/shared.ts`). Deux routes ne partagent pas un nom de
  paramètre de recherche de types différents (`tab` de l'éditeur, `section` de l'admin).
- **Types de `t()`** : avec beaucoup de chaînes, `ReturnType<typeof useTranslation>['t']` en
  paramètre fait « Type instantiation is excessively deep » (TS2589) : typer avec `TFunction`
  d'`i18next`. Les clés dynamiques (`learn.badges.${id}`) se lisent avec `returnObjects` ou
  directement dans `messages[locale]`.
- **Messages du lecteur** : `rx:state` arrive à chaque changement de l'appli (des centaines par
  seconde dans une boucle). Un `set` de zustand crée un nouvel état même à valeur égale, et tout
  composant qui lit `useEditor()` sans sélecteur se redessine : ne stocker que ce qui change,
  sinon l'éditeur se fige (test « an endless loop freezes nothing »).
- **Playwright et J3** : par défaut un test démarre en invité qui a déjà vu l'accueil et les
  visites guidées (`storageState` de `playwright.config.ts`). Pour une première visite :
  `test.use({ storageState: EMPTY_STATE })` (`e2e/helpers.ts`), ou `usePrefs(page, { welcomed:
  false })`. Le glisser au doigt se teste en envoyant des `PointerEvent` `pointerType: 'touch'`
  (`e2e/learn.spec.ts`).
- **Glisser-déposer tactile** : le repli (`touch-drag.ts`) rejoue des `DragEvent` construits ;
  leur `dataTransfer` peut manquer (vieux Safari) : ne jamais le lire sans test.
- **Rendus et effets** : `p.emit` et `p.setValue` d'un rendu sont recréés à chaque rendu ; un
  `useEffect` qui en dépend tourne à chaque fois. Les lire par une `ref`. Le moteur ignore une
  écriture identique, mais un effet qui écrit une valeur différente à chaque fois figerait l'aperçu.
- **Tailwind dans le canevas** : le preflight du studio s'applique aux composants dessinés dans le
  canevas (titres, listes, marges) ; `styles.css` du moteur redonne explicitement ce qu'il faut
  (`.rx-rich h1`, `ul`…), sinon le canevas diffère de l'aperçu.
- **Composants invisibles** : ils vont dans `screen.nonVisual`, jamais dans l'arbre ; le canevas
  les montre sous le téléphone (`non-visual-tray`).
- **Hocuspocus 4** : `Hocuspocus` (sans son `Server`) se branche sur le serveur HTTP de
  `@hono/node-server` par `ws` en `noServer`, comme route du routeur des WebSockets (`Collab.route()` dans
  `upgrades.ts`, à côté du test sur téléphone) ; `handleConnection(ws, Request)`
  puis `handleMessage` / `handleClose` à la main. `onAuthenticate` est appelé par document ;
  `connectionConfig.readOnly` donne une connexion en lecture seule. Le provider prend un
  `HocuspocusProviderWebsocket` (avec `WebSocketPolyfill` en Node pour poser les cookies, voir
  `test/server.ts`) et `provider.attach()`. Une socket ouverte ne voit une coupure qu'au bout de
  30 s : suivre `online` / `offline`. `flushPendingStores` ne rend pas de promesse :
  `Collab.flush()` attend les écritures (tests, arrêt).
- **TanStack Query** écoute `visibilitychange` sur `window`, pas sur `document` (à simuler ainsi
  dans Playwright).
- **Aucun 401** : une route protégée répond `fail(403, 'signed_out')` (`requireUser`) ; le studio
  réagit au code `signed_out`, pas au statut. `markSignedOut` retire les requêtes au lieu de les
  invalider (sinon elles redemandent des routes protégées).
- **Mesurer le jeu** : le Chromium du conteneur n'a pas de GPU ; dès qu'un seul pixel bouge,
  l'aperçu plafonne vers 45 à 50 images par seconde, jeu ou pas (même un `<canvas>`). Comparer au
  plafond mesuré à côté, et juger le jeu sur son temps JavaScript par image (profileur CDP sur
  l'iframe, `newCDPSession(frame)`), comme `e2e/game-perf.spec.ts`.
- **Tests du moteur de jeu** : passer `clock: new FrameClock(() => () => {})` à `Engine` et
  avancer avec `clock.step(1 / 60)` puis `await flush()` ; sans horloge manuelle, le moteur
  tourne sur `requestAnimationFrame` (ou `setTimeout` sous Node).
- **Playwright** : importer une spec depuis une autre y enregistre ses tests ; ce qui est partagé
  va dans `e2e/helpers.ts`. Le canevas de l'aperçu n'existe que dans la vue Blocs.
- **Shell** : `pkill -f <motif>` ou `pgrep -f vite | xargs kill` tue aussi le shell qui le lance ;
  arrêter les serveurs par PID ou par port.
- **`.gitignore` et `data/`** : seuls `/data/` et `apps/*/data/` (base PGlite) sont ignorés. Un
  `data/` plus large cachait des dossiers de sources (`apps/server/src/data/`…) : vérifier
  `git status` après avoir créé un dossier, Biome ne lit pas non plus les fichiers ignorés.
- **Relais et tests** : il refuse 127.0.0.1, donc un serveur de test local ; `Relay` prend
  `resolve` (faux DNS) et `allowAddress` pour les tests (`test/relay.test.ts`), jamais par une
  variable d'environnement. En e2e, `context.route('**/_rx/proxy')` intercepte aussi les appels
  de l'aperçu (iframe d'une autre origine) : pas de dépendance au réseau.
- **Session cloud** : `tiles.openfreemap.org` et `api.open-meteo.com` sont refusés par le proxy ;
  la carte affiche alors « ne peut pas s'afficher ici » (attendu), le canevas montre une esquisse.
- **MapLibre 6** cherche son worker à côté de son module : le bundle le déplace, d'où
  `setWorkerUrl` avec un import `?url` (`runtime/src/components/map-loader.ts`, types dans
  `runtime/src/assets.d.ts`).
- **Blockly en e2e** : un bloc créé par le code (« Essayer » de l'onglet Données) peut être très
  large et l'espace de travail défile à chaque dépôt ; saisir un bloc par **son propre** champ
  (`locator(':scope > .blocklyEditableField')`), sinon on attrape un bloc imbriqué, et mesurer
  sa position avant `mouse.down()` (pendant le glisser, il quitte l'espace de travail).
- **Variables de Blockly** : `variables_set` sur une variable partagée génère `shared.x = …`,
  envoyé au serveur ; `data.onShared` ne se déclenche que si la valeur change (pas d'écho).
- **Claude (J6)** : SDK `@anthropic-ai/sdk` 0.131, côté serveur seulement (`apps/server/src/ai/`).
  Structured outputs par `client.beta.messages.parse` + `betaZodOutputFormat` ; pas de schéma
  récursif (d'où la réponse « à plat » de `prompts.ts`). Opus 5.5 : ni `thinking` désactivé ni
  `tool_choice` forcé (400) ; `fallbacks: "default"` demande l'en-tête
  `server-side-fallback-2026-07-01`. Haiku 4.5 ne prend pas `effort`. Le SDK lit
  `ANTHROPIC_BASE_URL` (tests de bout en bout). Toujours vérifier `stop_reason` (`refusal`,
  `max_tokens`) avant de lire la réponse.
- **Galerie** : `requireProject(…, 'read')` refuse l'accès `gallery` ; une route qu'un visiteur
  de la galerie doit atteindre (ouvrir, remixer) prend `'view'`.
- **hc et types profonds** : renvoyer un `ProjectDoc` entier d'une route fait TS2589 dans le
  studio ; le typer `Record<string, unknown>` côté serveur et le relire en `ProjectDoc`.
- **Playwright** : un `<input type="search">` a le rôle `searchbox`, pas `textbox`.
