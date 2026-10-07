# Rublox — cahier des charges

Ce document fait foi. Il décrit ce que Rublox doit faire, comment il est construit, et dans quel
ordre. Chaque session de code le lit en entier avant de commencer, et met à jour la section
« État » (§ 0) à la fin de son jalon. Une décision qui s'en écarte s'écrit ici, avec sa raison.

## 0. État

| Jalon | Contenu | État |
|---|---|---|
| J0 | Socle et tranche verticale (mode invité) | fait (PR #1), voir § 0.1 |
| J1 | Comptes, espaces, invitations, projets côté serveur | fait (PR #2, complément PR #3), voir § 0.2 |
| J2 | Catalogue complet des composants et de leurs blocs | fait (PR #4), voir § 0.4 ; essai sur téléphones à faire (`docs/compatibilite.md`) |
| J3 | Expérience Junior et Studio, apprentissage, accueil | fait (PR #7), voir § 0.3 |
| J4 | Collaboration, test sur téléphone, publication PWA, export | fait (PR #6, édition à plusieurs : PR #9), voir § 0.5 et § 0.9 |
| J5 | Données et services : tables, variables, API web, cartes, graphiques | fait (PR #8), voir § 0.8 ; essai sur téléphones à faire (`docs/compatibilite.md`) |
| J6 | Galerie, remix, modèles, assistant IA | fait (PR #10), voir § 0.7 |
| J7 | Mode jeu : scène, lutins, physique | fait (PR #5), voir § 0.6 |
| J8 | Finitions : accessibilité, performances, sécurité, mise en production | à faire |

### 0.1 Ce que le J0 a fixé (06/10/2026)

Les jalons suivants s'appuient sur ces contrats ; les changer demande une migration ou une
mise à jour de ce paragraphe.

**Écarts au cahier des charges, et pourquoi**

- `ProjectDoc.meta.locale` (`fr` ou `en`) s'ajoute à l'esquisse du § 6.4 : c'est la langue de
  l'appli fabriquée. Les valeurs par défaut traduites (texte d'un bouton…) sont écrites dans le
  projet à la création du composant, dans cette langue, pour que le projet ne change pas de langue
  avec l'interface.
- Les textes des composants (libellé, préfixe de nom, aide, exemple, propriétés, événements,
  méthodes, valeurs d'énumération) vivent **dans leur déclaration** (`packages/catalog`), en FR et
  en EN : « une déclaration + un rendu + une fiche d'aide » reste vrai. `packages/i18n` porte les
  chaînes du studio, des blocs et du lecteur ; le français fait référence et TypeScript exige les
  mêmes clés en anglais.
- Glisser-déposer : l'API native HTML5 (palette → canevas ou calques, calques entre eux) plus des
  déplacements au clavier écrits pour Rublox (Espace pour saisir, flèches, Entrée, Échap ; Alt +
  flèches), au lieu de dnd-kit : les cibles d'insertion se calculent dans un arbre flex, ce que
  dnd-kit ne simplifie pas, et le clavier suit l'arbre plutôt que des coordonnées.
- `packages/ui` n'existe pas encore : les primitives d'interface (Radix + Tailwind, façon
  shadcn/ui) sont dans `apps/studio/src/components/ui`, le lecteur n'en ayant pas besoin. Les
  extraire quand un second consommateur apparaît.
- Miniatures du tableau de bord : l'écran de démarrage rendu en direct (petit `ScreenView`), pas
  une capture d'image.
- Motion n'est pas utilisé : animations CSS courtes, désactivées par `prefers-reduced-motion`.
- L'extension de navigation au clavier de Blockly n'est pas installée (P1) ; Blockly 13 en
  intègre déjà une partie.
- Les fonctions (blocs Fonctions) sont propres à un espace de travail ; les fonctions partagées
  par l'espace « Appli » restent à faire. Les variables stockées et partagées existent dans le
  format et le code généré (`stored`, `shared`) mais vivent en mémoire jusqu'au J5.
  *(J2 : fonctions partagées et variables stockées faites, voir § 0.4.)*

**Contrats pour J1, J2 et J3**

- Format : `packages/schema` (types et Zod `projectDocSchema`, `projectToYDoc` / `yDocToProject`,
  opérations Yjs dans `ops.ts`, migrations dans `migrations.ts`, `PROJECT_FORMAT_VERSION = 1`).
  Toute modification passe par une opération de `ops.ts`, en une transaction (une étape
  d'annulation).
- Composant : `defineComponent` dans `packages/catalog/src/components/<type>.ts`, enregistré dans
  `registry.ts` (`COMPONENTS`), rendu dans `packages/runtime/src/components/` et enregistré dans
  `RENDERERS`, icône dans `apps/studio/src/editor/component-icon.tsx`. Les tests de complétude
  (catalogue, blocs, rendu) échouent tant qu'il manque une pièce.
- Blocs : types stables, enregistrés dans les projets (ne jamais renommer) :
  `rx_<Type>_on_<événement>`, `rx_<Type>_get` et `rx_<Type>_set` (propriété choisie dans une
  liste), `rx_<Type>_call_<méthode>`, et `rx_app_start`, `rx_forever`, `rx_wait`, `rx_log`,
  `rx_screen_open`, `rx_screen_back`, `rx_ui_alert`, `rx_ui_toast`, `rx_ui_confirm`,
  `rx_ui_prompt`. Les champs de composant et d'écran gardent l'**identifiant** (le libellé est le
  nom courant) : renommer met les blocs à jour, supprimer les signale sans les effacer.
- Code généré (§ 6.5) : un module par écran plus `app`, paramètres
  `{ components, app, stored, shared, screens, ui, device, rx }` ; `Bouton1.onClick(async () => …)`,
  `Texte1.text = …`, `screens.open('Ecran2')`, `screens.back()`, `await rx.wait(1)`,
  `rx.log(…)`, `await ui.alert(…)`, `await rx.tick()` en tête de chaque boucle. Les variables de
  l'appli sont `app.<nom>`. Le générateur produit aussi `lineMap` (bloc de chaque ligne), dont le
  moteur se sert pour rattacher une erreur à son bloc ; le ralenti (J3) remplacera le marqueur
  d'instruction par `await rx.step('<id>')`.
- Lecteur : `postMessage` entre origines, messages `rx:load`, `rx:restart`, `rx:stop`,
  `rx:scheme`, `rx:inspect` (studio → lecteur) et `rx:ready`, `rx:log`, `rx:state`, `rx:select`
  (lecteur → studio), types dans `packages/runtime/src/bridge.ts`. Le serveur injecte les deux
  origines dans `<script id="rublox-config" type="application/json">`.
- Mode invité : liste des projets et fichiers des ressources dans la base IndexedDB `rublox`,
  document Yjs de chaque projet dans `rublox-project-<id>` (y-indexeddb) :
  `apps/studio/src/storage/`. Le rapatriement (J1) lit ces deux sources.
- Serveur : `createApp` dans `apps/server/src/app.ts`, routes d'API dans `api.ts` (type `Api`
  exporté pour `hc`), base dans `db/` (Drizzle, migrations dans `apps/server/drizzle/`,
  appliquées au démarrage).

### 0.2 Ce que le J1 a fixé (06/10/2026)

**Écarts au cahier des charges, et pourquoi**

- Champs de `user` (§ 6.8) : le nom affiché est le champ `name` de Better Auth (pas de colonne
  `displayName`), « désactivé » est le `banned` du plugin admin (il bloque déjà la connexion), et
  une colonne `theme` s'ajoute (le thème fait partie du profil, § 4.7). Better Auth exige une
  adresse unique : un compte sans e-mail reçoit `<uuid>@rublox.invalid` (domaine réservé), que
  l'API ne montre jamais (`email: null`).
- Better Auth n'est joignable que par une **liste blanche** de routes (`AUTH_ROUTES` dans
  `apps/server/src/auth.ts`) : connexion par identifiant, e-mail ou passkey, sessions, mot de
  passe. Les routes des plugins admin et organisations sont fermées : comptes, espaces,
  invitations et administration passent par `/api/*`, où les autorisations sont écrites une fois
  et testées. Les plugins servent pour le schéma, le blocage des comptes désactivés et les
  passkeys.
- Espaces = organisations Better Auth : rôles `owner` (créateur) et `admin` = responsables,
  `member` = membre. La table `invitation` du plugin existe mais ne sert pas ; les invitations
  de Rublox sont dans `invites` (code gardé en HMAC-SHA256 avec `RUBLOX_SECRET`).
- Un responsable n'agit (mot de passe, suppression) **que sur les comptes créés par un espace
  qu'il gère** (`user.managedBySpaceId`), pas sur un adulte invité comme simple membre. Il voit
  en lecture seule les projets des membres (rôle `member`) de ses espaces. Supprimer un espace
  est refusé tant qu'il contient des comptes créés par lui.
- Force brute : le limiteur de requêtes de Better Auth est éteint ; `FailureGuard` compte les
  **échecs** (connexion, passkey, vérification et usage d'un code d'invitation), 5 par adresse en
  15 minutes, en mémoire. Better Auth lit l'adresse que Rublox a résolue (`X-Real-IP` seulement si
  `TRUST_PROXY=true`), jamais `X-Forwarded-For`.
- Réponses 401 : **aucune en usage normal**. Une route protégée sans session valide (expirée,
  révoquée ailleurs, compte supprimé) répond **403 `signed_out`**, y compris les routes de
  Better Auth (un 401 de Better Auth hors connexion est réécrit par `handleAuth`). Seul un échec
  de connexion (mauvais mot de passe) répond 401, ce que le reverse proxy doit voir. Le studio
  détecte la perte de session par `/api/me` (200, `user: null`), relu au retour sur l'onglet et
  toutes les 5 minutes, par une réponse `signed_out`, ou par le refus du document sur
  `/ws/collab` ; il ne sonde jamais une route protégée. Tests : `test/session.test.ts` (session
  expirée et révoquée) et `e2e/session.spec.ts` (aucun 401 enregistré par le navigateur).
- Toute requête `/api/*` qui modifie quelque chose doit porter l'en-tête `Origin` du studio.
- Projets du serveur : le document Yjs est tenu par **Hocuspocus** (`/ws/collab`, origine du
  studio, `Origin` vérifié avant l'upgrade, session lue dans le cookie ; un document = un
  projet, nommé par son id). Chargé depuis `project_docs.state`, il y est rangé 2 s après la
  dernière modification (10 s au plus), après validation par `projectDocSchema` : un état
  invalide n'est jamais rangé (le dernier valide reste). Le serveur possède `meta.id` (UUIDv7).
  Lecteurs et responsables ont une connexion en lecture seule ; un changement de droits
  (partage, corbeille, transfert, suppression) ferme les connexions, qui se réauthentifient. Un
  refus (`signed-out`, `not-found`) passe par le protocole Yjs, jamais par un HTTP 401. Le
  renommage depuis le tableau de bord et la restauration d'une version passent par le document
  vivant (`Collab.edit`), les onglets ouverts les reçoivent. Côté studio : `@hocuspocus/provider`
  plus un cache **y-indexeddb** (`rublox-cache-<id>`, projets modifiables seulement, propre au
  compte, vidé à la déconnexion) : un projet déjà ouvert se rouvre hors ligne et ses
  modifications partent au retour du réseau (l'éditeur suit `online` / `offline` du navigateur).
- Historique : instantanés JSON (`project_versions`), automatiques à la synchronisation si le
  dernier a plus de 10 minutes, ou nommés. Restaurer garde d'abord l'état courant, puis remplace
  le contenu par une modification Yjs ordinaire (les onglets ouverts la reçoivent).
- Lecture seule (partage en lecture, responsable) : bandeau, rien n'est envoyé, bouton « En
  faire une copie ». L'éditeur n'est pas verrouillé pour autant (on peut essayer sans enregistrer).
- Ressources : une ligne `assets` par (projet, fichier), fichiers sous `DATA_DIR/assets/ab/<sha256>`,
  servis sur l'origine des applis avec CORS ouvert (le studio en fait des `blob:`) et une CSP
  `sandbox` (SVG sans script). Types acceptés, lus sur le contenu (`sniff.ts`) : PNG, JPEG, GIF,
  WebP, AVIF, SVG, MP3, OGG, WAV, M4A, MP4, WebM, WOFF, WOFF2, TTF, OTF, Lottie (JSON ou
  `.lottie`). Le quota compte chaque fichier une fois par compte ; il est réglé, comme la taille
  maximale, dans l'administration (`instance_settings`, 500 Mo et `MAX_UPLOAD_MB` par défaut).
- Droits des membres d'un espace (publier, IA, galerie) : enregistrés (`space_settings`), à
  appliquer par J4 et J6. Valeur par défaut de « publier » : oui pour famille et équipe, non pour
  classe (proposition du § 10).
- Avatars : 12 illustrations SVG dessinées pour Rublox (`apps/studio/src/components/avatar.tsx`),
  le serveur accepte tout identifiant `[a-z0-9-]{1,32}`.
- Transférer la propriété d'un projet (P1) est fait. RGPD (P1) fait : `GET /api/me/export`
  (JSON : profil, espaces, sessions, noms des passkeys, projets avec leur contenu et la liste
  de leurs versions, fichiers, partages, favoris ; aucun secret), `DELETE /api/me` (mot de passe
  redemandé ; refusé aux comptes membres, au dernier administrateur, et au dernier responsable
  d'un espace qui a encore des membres ; un espace où le compte est seul part avec lui). Le
  responsable exporte et supprime les comptes créés par son espace, l'administrateur supprime
  avec les mêmes règles. TOTP (P2), journal d'administration (P2) et commentaires des
  responsables (P2) restent à faire.
- `RUBLOX_SECRET` est obligatoire en production : le serveur refuse de démarrer sans, avec moins
  de 32 octets, ou avec une valeur publique (celle d'exemple de `docker/compose.yaml`,
  `EXAMPLE_SECRET`, ou celle de développement). L'exemple de compose ne démarre donc pas tel
  quel : c'est voulu.
- L'aperçu de l'éditeur est une `iframe` avec `sandbox="allow-scripts allow-same-origin
  allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"` : sans
  `allow-top-navigation`, une appli ne peut pas rediriger l'onglet du studio.

**Contrats pour les jalons suivants**

- API : routes dans `apps/server/src/routes/` (`me`, `spaces`, `invites`, `admin`, `projects`),
  assemblées dans `api.ts` (type `Api`). Corps validés par `jsonBody(schéma Zod)` ; erreurs
  `{ error: code }` (`ErrorCode` dans `http.ts`), traduites par `errors.<code>` côté studio.
  Accès aux projets : `requireProject(db, userId, projectId, 'read' | 'write' | 'owner')`, aux
  espaces : `requireMembership`, aux comptes membres : `requireManagedAccount` (`access.ts`).
- Studio : client typé `api` et `call()` (`apps/studio/src/lib/api.ts`), session `useMe()`
  (`lib/session.ts`), client Better Auth `authClient` (`lib/auth-client.ts`). Les préférences
  restent dans `usePrefs` et sont recopiées dans le profil par `useProfileSync`.
- Éditeur : `ProjectSession.open(id, 'guest' | 'server')`, `session.source` (`DocSource` :
  `GuestSource` ou `ServerSource`, `editor/sources.ts`), `session.readOnly`, et
  **`session.storeAsset(file, kind)`** pour toute ressource envoyée (J2 : sons, vidéos, polices,
  Lottie passent par là, jamais directement par IndexedDB).
- Tableau de bord : `ProjectsBackend` (`storage/backend.ts`), `guestBackend` ou `serverBackend`.
- Chaînes du J1 : `packages/i18n/src/{fr,en}/accounts.ts`, fondues dans l'espace `studio`.
- Documents : `Collab` (`apps/server/src/collab.ts`, dans `services.collab`) : `edit(id,
  userId, fn)` pour toute écriture du serveur dans un projet, `read(id)` pour le lire,
  `reconnect(id)` après un changement de droits. Côté studio, `ServerSource.provider` est le
  `HocuspocusProvider` du projet ouvert.
- J4 : la présence et l'édition à plusieurs s'ajoutent sur ce même provider (awareness) ;
  appliquer `membersCanPublish`.
- Une route protégée sans session répond `403 signed_out`, jamais 401 : garder cette règle
  pour toute nouvelle route (`requireUser`).
- J3 : les comptes créés par un espace démarrent en Junior (`uiMode`) ; `Avatar` et la mascotte
  sont réutilisables ; la progression d'apprentissage se rattache à `user.id`.

### 0.3 Ce que le J3 a fixé (07/10/2026)

**Écarts au cahier des charges, et pourquoi**

- Tutoriels livrés : Mon premier bouton, Le dé magique, Le quiz (Junior) et Deux écrans et une
  navigation (Studio), en FR et EN. Les autres tutoriels du § 4.10 dépendent de composants du J2
  (Son, Minuteur, Zone de dessin, Liste…) ou du J5 (API, tables, variables partagées) : le moteur
  les accepte tels quels (dossier dans `content/tutorials/`), et un tutoriel dont un composant
  manque au catalogue (`requires`) est masqué. Le P0 « 4 Junior et 2 Studio » sera donc atteint
  avec le J2 (La boîte à sons, Le chrono) et le J5 (La météo, Carnet d'adresses).
- Défis : 4 (Le compteur, Le compte à rebours, Pile ou face, Une fonction qui sert deux fois),
  chacun avec un projet de départ et trois étoiles vérifiées en direct.
- Progression (tutoriels, défis, badges) : rangée derrière `ProgressStore` (`@rublox/learn`),
  dans IndexedDB (`rublox-learning`, un enregistrement par compte, `guest` sans compte). Les
  tables du § 6.8 (`learning_progress`, `badges`) ne sont pas créées : le J4 ajoute en parallèle
  la migration `0002` et une seconde migration aurait été en conflit. Il suffira d'écrire un
  `ProgressStore` qui parle au serveur et de le choisir dans `learn/sync.ts`.
- Badges « première publication » (décerné par le J4) et « premier remix » : définis et affichés « bientôt »,
  gagnables quand le J4 et le J6 appelleront `awardBadge`.
- Ralenti : vitesse de 100 à 1 500 ms par bloc, points d'arrêt par clic droit (tenus par
  l'éditeur, pas par le projet) ; en pause, « Continuer » ou « Bloc suivant ». Le bloc en cours
  est allumé avec `highlightBlock` de Blockly. Le code de l'aperçu est la variante lente ; la vue
  du code garde la variante lisible.
- Erreurs pour enfants : `RxError` (code + valeurs) et `rx.item(liste, n)`, appelé par le bloc
  « élément n° … de la liste » (`FROM_START`) pour dire « La liste n'a que 3 éléments, et ce
  bloc demande le 5ᵉ ». Les autres positions (`FROM_END`, `RANDOM`…) gardent le code de Blockly.
- Sons de Junior synthétisés par Web Audio (aucun fichier), désactivables dans le panneau
  d'aide ; confettis dessinés sur un `canvas` (pas de `canvas-confetti`).
- La mascotte reste sans nom (§ 10) ; elle a cinq humeurs (`happy`, `wave`, `think`, `cheer`,
  `oops`).
- Page d'accueil : montrée sur `/` à un visiteur non connecté qui n'a pas encore choisi
  « Essayer sans compte » (`usePrefs.welcomed`).
- Glisser-déposer au doigt : repli par évènements de pointeur (`editor/design/touch-drag.ts`),
  appui long de 280 ms dans la palette, immédiat sur la poignée du canevas ; il rejoue
  `dragover` / `drop` sur l'élément visé, si bien que canevas et calques n'ont pas changé. Testé
  dans Chromium avec des évènements tactiles simulés, **pas encore sur un vrai iPad ni un vrai
  téléphone Android**.
- Console repliée par défaut en Junior (préférence par mode), réduite à une ligne quand elle est
  vide ; le nom du composant sélectionné est à gauche du téléphone, hors de l'écran de l'appli.

**Contrats pour les jalons suivants**

- `@rublox/learn` (`packages/learn`) : types `Tutorial`, `Challenge`, `Condition` (vérifications
  en données : `component`, `prop`, `block` avec `inside` et `filled`, `preview`,
  `previewScreen`, `tab`, `workspace`, `screens`, `blockCount`, `variables`, `slowMotion`,
  `all`/`any`/`not`, `manual`), `evaluate(condition, LearnState)`, `badgesFromProject`,
  `badgesFromProgress`, `buildStarter`, `fillNames` (`{{Button}}`, `{{Text.2}}`,
  `{{screen.2}}`), `ProgressStore`.
- Contenus : `content/tutorials/<id>/{tutorial,fr,en}.json` et
  `content/challenges/<id>/{challenge,fr,en}.json`, déclarés dans
  `packages/learn/src/content.ts` ; un test vérifie les deux langues, les types de blocs et de
  composants cités, et que chaque dossier est déclaré. Les cibles de la bulle (`target`) sont
  décrites dans `packages/learn/src/model.ts` et résolues par `apps/studio/src/learn/targets.ts`
  (attributs `data-tour`).
- Lecteur : messages `rx:slow` (`SlowMotion`) et `rx:resume` (studio → lecteur), `rx:event`
  (`AppEvent`, chaque évènement d'un composant) et `rx:step` (`StepInfo`) (lecteur → studio).
  `ModuleApi.rx` gagne `step(id)` (ralenti) et `item(liste, n)`.
- Générateur : `generateProjectCode(doc, { slow: true })` insère `await rx.step('<id>')` avant
  chaque instruction (sauf devant un bloc d'évènement ou une définition de fonction).
- Badges : `awardBadge(id)` (`apps/studio/src/learn/store.ts`) les enregistre et les annonce.
- Aide : fiches des blocs généraux et glossaire dans `packages/i18n/src/{fr,en}/help.ts`
  (`blockSheets`, `glossary`) ; les blocs de composants prennent `help` et `example` du
  catalogue. Un nouveau bloc général demande sa fiche (test dans `@rublox/learn`).
- Chaînes du J3 : `packages/i18n/src/{fr,en}/learn.ts` et `help.ts` (espace `studio`),
  `runtime-learn.ts` (espace `runtime`).
- Préférences ajoutées à `usePrefs` (version 2) : `consoleOpen` par mode, `sounds`,
  `showBadges`, `toursSeen`, `welcomed`, `slowDelay`.

### 0.4 Ce que le J2 a fixé (07/10/2026)

**Fait** : les 40 composants du § 4.4 marqués J2 (y compris les P2 Note en étoiles, Texte riche,
Batterie et Réseau), chacun avec propriétés, événements, méthodes, blocs, rendu, comportement,
icône et fiche d'aide en FR et EN ; thème de l'appli éditable ; navigation par onglets et par
tiroir ; multisélection en Studio ; copier, couper, coller entre écrans et entre projets ;
fonctions partagées par l'espace « Appli » ; variables stockées gardées sur l'appareil ;
autorisations demandées au premier usage ; une appli de démonstration qui utilise chaque
composant (palette de commandes du tableau de bord) ; `docs/compatibilite.md`.

**Écarts au cahier des charges, et pourquoi**

- **Essai sur de vrais téléphones non fait** : impossible depuis une session de code. La liste de
  vérification `docs/compatibilite.md` est prête, sur l'appli de démonstration ; ses colonnes
  « attendu » disent ce que le code prévoit. Critère d'acceptation à fermer par Guilhem.
- Les **valeurs d'un événement** (l'élément touché, la nouvelle valeur…) passent par un seul bloc
  `rx_event_value` (« valeur [élément] de l'événement ») à poser dans le bloc « quand… », et non
  par des variables locales façon Thunkable : un seul type de bloc, un menu qui ne montre que les
  valeurs de l'événement englobant, un avertissement ailleurs. Code généré :
  `Liste1.onItemClick(async (event) => { … event.item … })`.
- Ce qu'un composant **mesure** (position, accélération, élément touché, « disponible ») est une
  **propriété d'état** (`state: true`) : lisible par les blocs, absente de l'inspecteur et du
  projet, écrite par le moteur.
- Lecteur de QR code : `BarcodeDetector` quand le navigateur le fournit, sinon **jsQR** (Apache-2.0,
  pur JavaScript, chargé à la demande) plutôt que zxing en wasm : pas de fichier wasm à servir,
  et Safari (sans `BarcodeDetector`) reste couvert.
- Animation Lottie : **lottie-web** (MIT, rendu SVG « light », chargé à la demande) et fichiers
  `.json` seulement ; dotLottie (`.lottie`, zip) demanderait un lecteur wasm : plus tard si besoin.
- Les notifications locales n'apparaissent que pendant que l'appli est ouverte (pas de serveur
  de notifications). Android exige un service worker (appli publiée, J4) ; iPhone exige l'appli
  installée sur l'écran d'accueil.
- La **Carte** et le **Graphique** restent au J5, la **scène de jeu** au J7, comme prévu.
- Les blocs « n'importe quel Bouton » (§ 4.2, Studio) ne sont pas faits : ils demandent une
  catégorie par type de composant et un type de valeur « composant » ; reportés (P1).

**Contrats pour la suite**

- Catalogue (`packages/catalog`) :
  - types de propriétés en plus : `list` (textes, ou objets avec `itemFields`), `date`
    (`AAAA-MM-JJ`), `time` (`HH:MM`), `any` ; `asset` accepte `blob:` et `data:` créés pendant
    l'exécution (photo, enregistrement) ;
  - `state: true` sur une propriété (voir plus haut) ; blocs `get` par défaut ;
  - `event({ args: { item: arg('string') } })` ; les libellés des valeurs vont dans
    `strings.<langue>.args` (test de complétude) ;
  - `availableProp()` et `errorEvent()` (`common.ts`) pour toute fonction du navigateur : propriété
    « disponible » posée au démarrage de l'écran, événement « a un problème » avec `message` ;
  - `ICON_NAMES` (`icons.ts`) : la liste des icônes d'une appli, dessinées par le moteur
    (`AppIcon`) ; propriété `prop.icon` ;
  - `createDemoProject({ locale, mode })` (`demo/`) : l'appli de démonstration ; un nouveau
    composant doit y entrer (le test `typesMissingFromDemo` échoue sinon).
- Moteur (`packages/runtime`) :
  - **comportements** : `BEHAVIORS[type]` (`behaviors/registry.ts`) avec `methods`, `mount` (au
    démarrage de l'écran) et `available` ; le contexte `ctx` donne `get`, `set`, `emit`, `fail`
    (avertissement + événement `error`), `handle()`, `assetUrl`, `onDispose`, `alive`,
    `overlay(kind)` ; tout ce qui tourne (minuteur, capteur, flux) s'arrête par `onDispose`
    quand l'écran se ferme ou que l'appli s'arrête ;
  - un rendu donne prise à son comportement par `useExpose(p, handle)` (une vidéo, une zone de
    dessin) ; `p.emit(event, args)` porte les valeurs de l'événement ;
  - panneaux plein écran : `OVERLAYS[kind]` (`overlays/registry.ts`), ouverts par `ctx.overlay` ;
  - variables stockées : `localStorage['rublox:<appId>:stored']`, `appId` = identifiant du projet
    par défaut (`EngineOptions.appId`, à fixer au slug ou à l'id de publication au J4) ;
  - fonctions de l'espace « Appli » : le module `app` les range dans `functions` avant son
    premier `await` ; un écran appelle `await functions.nom(…)` (blocs `rx_app_call` et
    `rx_app_call_value`). Le paramètre `functions` n'apparaît dans l'en-tête d'un module que
    s'il s'en sert (les instantanés du J0 ne changent pas) ;
  - navigation onglets et tiroir : `engine.navigationScreens()`, `engine.switchTo(id)` ; chaque
    écran du menu garde son instance (et son état) ; `screens.open` d'un écran du menu change
    d'onglet, celui d'un autre écran l'empile au-dessus ; `snapshot.root` est l'onglet courant ;
  - écrire deux fois la même valeur ne redessine rien (un rendu qui écrit dans un effet ne boucle
    pas).
- Format (`packages/schema`) : `setTheme`, `setNavigation` (les entrées du menu suivent l'ordre
  des écrans ; supprimer un écran le retire du menu), `copyComponents`, `pasteComponents`
  (nouveaux identifiants, noms libres, composants invisibles dans `nonVisual`).
- Studio : `useEditor().selection` (multisélection) à côté de `selected` ; presse-papiers
  `editor/clipboard.ts` (format `rublox/components`, presse-papiers du système par les
  événements copier/coller, et `localStorage['rublox:clipboard']`) ; les composants invisibles
  vont dans `nonVisual` (bandeau sous le téléphone et calques) ; l'inspecteur a un onglet
  « Appli » quand l'écran est sélectionné. Toute ressource envoyée passe par
  `session.storeAsset`.
- Chaînes du J2 : `packages/i18n/src/{fr,en}/catalog.ts`, espace `catalog` (`useTranslation('catalog')`
  côté studio, `messages[locale].catalog` ailleurs).
- J4 : coller dans un projet d'un autre propriétaire ne recopie pas les fichiers des ressources
  sur le serveur (seulement leur description) *(fait au J4b, § 0.9)* ; le service worker des applis publiées doit
  relayer `showNotification` ; `appId` des variables stockées.
- J5 : la Liste de données et la Grille de données se brancheront sur une table (même propriété
  `items`, mêmes champs `image`, `title`, `subtitle`) ; les variables partagées reprennent le
  mécanisme des stockées (`shared` vit encore en mémoire).

### 0.5 Ce que le J4 a fixé (07/10/2026)

**Écarts au cahier des charges, et pourquoi**

- **Édition à plusieurs (§ 4.9)** : livrée à part (J4b, PR #9, voir § 0.9), sur la persistance
  Hocuspocus du complément du J1 (PR #3).
- Le **code des applis est généré par le studio** (le même générateur que l'aperçu), envoyé avec
  le projet au test en direct et à la publication. Le serveur valide le projet
  (`projectDocSchema`) et la forme du code, pas son contenu : Blockly côté serveur demanderait un
  DOM (jsdom) et plusieurs Mo, et l'origine des applis est de toute façon traitée comme hostile
  (aucun cookie, aucune API du studio) : un code forgé n'y obtient rien de plus qu'une appli.
- Les **icônes** (192, 512, masquable 512, Apple 180, PNG) sont dessinées par le studio sur un
  canvas (émoji sur fond de couleur, ou image du projet recadrée) : seul le navigateur a les
  polices d'émoji. Le serveur vérifie que ce sont des PNG de 2 Mo au plus.
- **Adresse** : choisie à la première publication, elle ne change plus (même dépubliée, elle
  reste réservée au projet). Dépublier garde les versions ; `/a/<slug>/` répond 410 « Cette appli
  n'est plus publiée » et le service worker de l'appli vide son cache et se retire. Un projet à la
  corbeille est hors ligne aussi ; « Remettre en ligne » sert une version antérieure.
- **Droits** : publient le propriétaire et les comptes en écriture ; refusé à qui est simple
  membre d'un espace dont les responsables ont décoché « publier » (`membersCanPublish`, la règle
  la plus stricte l'emporte). Pas de publication ni de test sur téléphone en mode invité (ils
  passent par le serveur).
- **Test sur téléphone** : le téléphone et l'éditeur passent par le serveur (WebSocket
  `/_rx/live` et `/ws/live`), ce qui marche sur n'importe quel réseau qui joint l'instance. Lien
  valable 8 heures, un seul actif par personne et par projet (un nouveau lien révoque le
  précédent), jeton gardé en HMAC (`live_links`), rappelé par l'onglet (`sessionStorage`) pour
  qu'un rechargement ne demande pas de rescanner. Le serveur ne stocke rien d'autre : il garde en
  mémoire le dernier projet reçu pour le téléphone qui arrive. Console du téléphone : 40 messages
  par seconde au plus, dans la console de l'éditeur (pastille de l'appareil) et dans le dialogue.
- **Site web autonome** : `index.html`, lecteur, `app.json`, ressources, manifeste et icônes, avec
  des chemins relatifs (hébergeable dans n'importe quel dossier) ; **sans service worker** (son
  adresse n'est pas connue d'avance). Le studio lit le lecteur construit sur l'origine des applis
  (`/_rx/kit.json` et `/_app/*`, CORS réservé à l'origine du studio).
- **Variables stockées** (moteur du J2, `rublox:<appId>:stored`) : le lecteur donne à chaque
  appli son identifiant (`app:<publication>`, `live:<projet>`, `site:<projet>`), si bien que deux
  applis de l'origine des applis ne mélangent pas leurs valeurs.

**Contrats pour les jalons suivants**

- Format et protocole : `packages/schema/src/publish.ts` (`appSettingsSchema`, `appBundleSchema`,
  `PublishedApp`, `APP_ICON_FILES`, messages `LiveTo*` / `LiveFrom*`, fichier `.rublox` :
  `project.json` + `assets/<sha256>`, relu par `migrateProject`).
- Base : `publications` (slug unique, version courante), `publication_versions` (réglages, paquet
  `{ doc, code }`, icônes), `live_links`. API : `GET|PUT|DELETE /api/projects/:id/publication`,
  `GET …/publication/slug/:slug`, `POST …/publication/versions/:v/current`,
  `POST|DELETE /api/projects/:id/live[/:linkId]` (`routes/publish.ts`).
- Origine des applis : `/a/<slug>/` (et `install`, `app.json`, `manifest.webmanifest`, `sw.js`,
  `icon-192.png`, `icon-512.png`, `icon-maskable.png`, `apple-touch-icon.png`), `/live/<jeton>`,
  `/_rx/live`, `/_rx/kit.json` (`published.ts`, `live.ts`). La page reçoit
  `page: { kind: 'app' | 'live' }` dans `rublox-config` ; le lecteur choisit sa vue par
  `readPage()` (`apps/player/src/page.ts`), aussi d'après l'adresse en développement.
- **WebSockets** : un seul écouteur `upgrade`, `Upgrades` (`apps/server/src/upgrades.ts`) ; chaque
  point d'entrée s'y ajoute (origine, chemin, `Origin` exigé). Hocuspocus (`/ws/collab`) y
  passe aussi (`Collab.route()`, complément du J1) : un second écouteur casserait les autres.
- Moteur : le lecteur passe `appId` à `Engine` (stockage du J2) pour l'appli publiée, le test
  en direct et le site exporté.
- Service worker d'une appli publiée : il sert aussi aux notifications du composant Notifications
  (J2, `registration.showNotification`) ; toucher une notification rouvre l'appli
  (`notificationclick`).
- Studio : `buildBundle(doc)` (`editor/publish/bundle.ts`, Blockly chargé à la demande),
  `useLive` / `live.start(session)` (`editor/publish/live.ts`), `drawIcons`, `exportProject`,
  `importArchive`, `exportSite` (`storage/archive.ts`). Les messages de la console peuvent porter
  `source` (l'appareil). Chaînes du J4 : `packages/i18n/src/{fr,en}/publish.ts` (`live`,
  `publish`, `transfer` dans `studio`, et l'espace `player` pour les pages du lecteur).
- J6 (galerie, « Essayer ») : afficher l'appli publiée dans un `iframe` vers `/a/<slug>/` ; le
  bouton « Installer » ne s'y montre pas.

### 0.6 Ce que le J7 a fixé (07/10/2026)

**Écarts au cahier des charges, et pourquoi**

- **Rendu de la scène** : transformations CSS écrites directement dans le DOM par `World`
  (`packages/runtime/src/game/world.ts`), sans React à chaque image ; un élément par lutin, ce qui
  garde le toucher natif (`pointer-events`), les sélecteurs de test et l'accessibilité. Un
  `<canvas>` ne dessinait pas plus vite dans le conteneur sans GPU où la mesure a été faite (voir
  la PR #5), et le placement libre du designer réutilise les mêmes fonctions de dessin
  (`game/draw.ts`).
- **Boucles et images** : dans un écran qui a une scène, une boucle qui a modifié quelque chose
  de visible dans la scène attend l'image suivante à son `rx.tick()` (comme Scratch : « avancer de
  2 » dans « répéter indéfiniment » déplace de 2 par image). Sans scène, la règle du § 6.5
  (céder après 16 ms) ne change pas.
- **Clones** : les gestionnaires d'un composant `clonable` reçoivent l'instance qui déclenche
  l'événement en premier paramètre, sous le nom du composant : `Pomme.onHit(Panier, async (Pomme,
  event) => …)` ; les mêmes blocs pilotent l'original et chaque clone. Supprimer l'original le
  cache ; toucher un clone supprimé arrête silencieusement le bloc qui le fait. Un clone sorti
  de la scène disparaît tout seul ; au plus 300 clones par scène.
- **Événements filtrés** : « quand Pomme touche Panier », « quand Pomme touche le bord du bas » :
  `EventDef.filter` (un composant d'un type, ou une valeur d'une liste), choisi dans le bloc
  (`%2`, champ `FILTER`, `*` pour « n'importe lequel ») et passé avant le gestionnaire
  (`null` pour n'importe lequel). Un événement ne se déclenche qu'au début du contact.
- **Collisions** : boîtes (sans tenir compte de la rotation) ou cercles ; les lutins cachés ne
  touchent rien ; deux lutins `solid` se repoussent et rebondissent (rebond en %).
- Bords : réglés sur la scène (arrêtent, font rebondir, laissent sortir), et lutin par lutin
  (« comme la scène » par défaut).
- Coordonnées : repère logique de la scène (360 × 640 par défaut), y vers le bas, rotation en
  degrés dans le sens horaire, 0 = le costume tel qu'il est dessiné ; « avancer » suit la
  rotation.
- **Costumes** : propriété `images` (nouveau genre de propriété) : une liste d'identifiants de
  ressources, d'adresses `https:` ou d'émojis ; « numéro du costume » commence à 1.
- Tutoriel « Mon premier jeu » : le moteur de tutoriels du J3 n'est pas fusionné ; le jeu est
  livré comme **démo** chargeable depuis la palette de commandes (« Ouvrir la démo de jeu :
  Attrape les fruits »), construite uniquement avec des blocs (`packages/catalog/src/demos/`).
  Une seconde démo, « 50 lutins qui rebondissent », sert à la mesure de performance.
- Sons des jeux : ceux du composant Son du J2 ; aucun bloc de son propre au jeu.

**Contrats pour les jalons suivants**

- Catalogue : `ComponentDef.accepts` (types d'enfants admis), `parents` (types de parents
  admis), `freeLayout` (enfants placés par `x`/`y`), `clonable` ; `EventDef.filter` et
  `skipIfBusy` (un gestionnaire encore en cours n'est pas relancé : « à chaque image ») ;
  `ArgDef.kind: 'component'` (un argument de méthode choisi dans une liste de composants,
  `componentType`) et `ArgDef.default` (valeur des blocs fantômes de la boîte à outils) ;
  `strings.filters[event]` (avec `any`). Valeurs d'événement et propriétés `state` : forme du J2.
- Lecteur : la scène expose sa zone de dessin par `useExpose` (`{ stage }`, forme du J2) ; le
  moteur y monte le `World` de la scène (`Engine.mountWorlds`) et le démonte quand elle quitte la
  page (onglets). `Engine.live(clé d'instance, id)` rend le `World` (tests).
  Les méthodes des composants de jeu passent par le `World`, pas par `BEHAVIORS`.
- Moteur : `FrameClock` (`game/clock.ts`), une par moteur (`EngineOptions.clock` pour les tests,
  qui avancent image par image avec `clock.step`), en pause quand la page est cachée ;
  `GameInstance` par écran ouvert, mis en pause quand un autre écran le recouvre.
- Designer : `design/free-layout.ts` (`freeParent`, `freeKey`, `setProps`) et
  `design/free-frame.tsx` pour tout futur conteneur à placement libre (zone de dessin).
- Blocs de jeu : types `rx_GameScene_*`, `rx_Sprite_*`, `rx_SceneText_*`, `rx_Joystick_*` ;
  « nombre aléatoire entre » est le `math_random_int` de Blockly, déjà présent.
- Démos : `catchGameDemo(locale)` et `bouncingDemo(locale)` dans `@rublox/catalog` ; le J3 peut
  en tirer le tutoriel « Mon premier jeu » (identifiants fixes : `CATCH_GAME_IDS`).

### 0.7 Ce que le J6 a fixé (07/10/2026)

**Fait** : galerie interne (cartes, « Essayer », « Voir les blocs », « Remixer », j'aime, compteur
et arbre des remix, filtres récents / populaires et Junior / Studio, recherche), droit des
membres d'un espace à y partager, retrait par l'administrateur ; 12 modèles FR et EN proposés à
la création d'un projet ; assistant IA (« Créer avec l'IA », « Explique-moi » un bloc, une pile
ou un écran, « Pourquoi ça ne marche pas ? »), composant **IA** (générer un texte, décrire une
image), activation par l'administrateur et par espace, quotas quotidiens par compte, journal
d'usage, consignes adaptées aux enfants ; badge « premier remix ».

**Écarts au cahier des charges, et pourquoi**

- **Une seule recette pour les modèles et l'IA** : un modèle est une recette d'appli (`AppSpec`,
  `content/templates/<id>/template.json`, textes dans `fr.json` et `en.json`) que
  `@rublox/templates` construit en projet ; l'IA écrit la même recette. Le constructeur refuse
  tout ce que le catalogue et les blocs ne connaissent pas (type, propriété, valeur, bloc, nom de
  composant, d'écran), et un test charge chaque modèle dans Blockly (chaque pile, chaque menu
  déroulant) puis génère son code.
- **« Créer avec l'IA » crée un nouveau projet** (tableau de bord) : la proposition (écrans en
  miniature, résumé, nombre de composants et de blocs) se garde ou se refuse ; gardée, elle
  s'annule par le bouton « Annuler » du message (le projet est supprimé). Ajouter des écrans à un
  projet ouvert avec l'IA reste à faire.
- **Réponse de l'IA « à plat »** : les sorties structurées n'acceptent pas bien un schéma
  récursif ; le modèle donne les composants en liste (avec leur `parent`) et les blocs en JSON
  texte, que le serveur remet en recette. Une recette qui ne se construit pas est renvoyée une
  fois au modèle avec la liste des problèmes ; le studio revérifie avec Blockly avant de montrer
  la proposition.
- **Modèles par défaut** : `RUBLOX_AI_MODEL` = `claude-opus-5-5` (construire une appli ; effort
  `medium`, repli `fallbacks: "default"` en cas de refus), `RUBLOX_AI_FAST_MODEL` =
  `claude-haiku-4-5` (expliquer, déboguer, composant IA : réponses courtes et nombreuses). Les
  consignes et la référence du catalogue forment un préfixe fixe, mis en cache.
- **Qui paie le composant IA** : l'appli publiée, son propriétaire, seulement s'il l'a autorisé
  (`projects.app_ai_allowed`, interrupteur du dialogue de publication) ; l'aperçu de l'éditeur et
  le test sur téléphone, **la personne qui teste** (sinon un visiteur de la galerie dépenserait le
  quota du propriétaire). Un site exporté n'a pas d'IA. Relais : `/_rx/ai` sur l'origine des
  applis (20 requêtes par minute et par adresse), et le studio pour l'aperçu.
- **Quotas** : par compte et par jour UTC ; chaque requête compte (la seconde chance de « Créer
  avec l'IA » aussi). Le journal garde qui, quoi, quel modèle, combien de jetons et le résultat,
  **jamais le contenu** des questions ni des réponses.
- **Espaces** : un membre (rôle `member`) n'a l'IA et le partage en galerie que si **tous** ses
  espaces les autorisent (la règle la plus stricte, comme publier) ; les deux sont décochés par
  défaut (J1). Un compte qui n'est membre d'aucun espace les a si l'instance les active.
- **« Essayer »** montre l'appli publiée dans un téléphone (`/a/<slug>/`) ; un projet partagé mais
  pas publié montre sa miniature et s'essaie par « Voir les blocs » (l'éditeur en lecture seule,
  avec son aperçu). Galerie réservée aux comptes connectés.
- **Visibilité** : `private` ou `gallery` (la valeur `space` du § 6.8 ne sert pas : les
  responsables voient déjà les projets de leurs membres). Un projet retiré par l'administrateur
  ne peut plus être partagé jusqu'à `POST /api/gallery/:id/allow` (pas encore d'écran).
- **Sans clé, aucune trace** : ni bouton, ni réglage, ni droit d'espace, ni composant IA dans la
  palette, l'aide, les commandes ou l'appli de démonstration ; toutes les routes `/api/ai/*` et
  `/_rx/ai` répondent 404.
- Le tutoriel « Traduire avec l'IA » (§ 4.10) n'est pas écrit.

**Contrats pour les jalons suivants**

- `@rublox/templates` : `appSpecSchema` (`AppSpec`), `buildProject(spec, { locale, mode, name })`
  (`{ doc }` ou `{ issues }`), `localize`, `knownBlockTypes()` / `isKnownBlockType`,
  `catalogReference()` (le catalogue pour l'IA), `TEMPLATES`, `templateProject`. Un nouveau
  composant entre tout seul dans la référence de l'IA ; un nouveau bloc général s'ajoute à
  `GENERAL_BLOCK_TYPES` (le test vérifie que Blockly le connaît).
- Base (migration `0003`) : `likes`, `ai_usage`, et dans `projects` : `remix_of` (crédit « remix
  de X par Y », gardé même si l'original disparaît), `ui_mode`, `shared_at`,
  `gallery_removed_at`, `app_ai_allowed`.
- Accès : `ProjectAccess` gagne `gallery` (lecture seule, tout compte connecté) ;
  `requireProject(…, 'view')` l'accepte (ouvrir, remixer, dupliquer = remixer), `'read'` le
  refuse (versions, membres, publication).
- API : `/api/gallery` (liste, `/:id` avec ancêtres et arbre, `like`, `remix`, `sharing`,
  retrait), `/api/ai/{create,explain,debug,app,usage,projects/:id}`, `/_rx/ai` ; `/api/me`
  renvoie `features: { gallery, galleryShare, ai: { allowed, reason, quota, used } | null }`.
  Erreurs `gallery_*` et `ai_*` traduites par `gallery.errors` et `ai.errors`.
- Serveur : `services.ai` (`AiService`, `null` sans clé) ; un `AiClient` se remplace dans les
  tests (`createTestServer({}, { aiClient: new FakeAiClient() })`).
- Moteur et lecteur : `EngineOptions.ai` (`AiProvider`), `BehaviorContext.ai`,
  `Behavior.available(ctx)` ; messages `rx:ai` (lecteur → studio) et `rx:ai-reply`.
- Studio : `useFeatures()`, `aiAllowed()`, `AI_TYPES` et `useOfferedType()` (`lib/features.ts`)
  pour tout ce qui touche l'IA ; `createDemoProject({ ai })`. Chaînes du J6 :
  `packages/i18n/src/{fr,en}/gallery.ts` (`gallery`, `templates`, `ai` dans `studio`, `ai` dans
  `runtime`).
### 0.8 Ce que le J5 a fixé (07/10/2026)

**Fait** : onglet Données (tables éditables comme un tableur, colonnes typées, mode local ou
partagé avec droits, import et export CSV ; connexions API avec en-têtes, paramètres, secrets,
« Essayer » et réponse en arbre dont un clic crée le bloc qui lit le champ ; secrets chiffrés ;
valeurs des variables partagées), relais `/_rx/proxy`, variables et tables partagées par
`/_rx/shared`, liaison de la Liste de données, de la Grille de données, de la Carte et du
Graphique à une table, blocs de table, d'API et d'objets, composants Carte, Graphique et Feuille
Google (P2), tutoriels La météo, Carnet d'adresses, Carte de mes lieux et Tchat familial.

**Écarts au cahier des charges, et pourquoi**

- **Tables et connexions API ne sont pas des composants** (le § 4.4 les rangeait dans
  « Données (invisibles) ») : elles vivent dans l'onglet Données et leurs blocs sont des blocs
  généraux (catégorie « Données ») utilisables dans tous les écrans et dans l'espace « Appli ».
  Un composant par écran aurait obligé à le recréer sur chaque écran pour la même table. La
  **Feuille Google**, elle, est un composant invisible (une adresse à lire, sans colonnes à
  déclarer).
- Code généré : deux paramètres de module de plus, présents seulement quand un module s'en sert
  (comme `functions`) : `data` (`data.Contacts.rows()`, `await data.Contacts.add({…})`,
  `data.Contacts.onChange(…)`, `data.onShared('score', …)`) et `web` (`await
  web.Meteo.get('/forecast', paramètres)`). Les objets se lisent par `rx.get(objet,
  'current.temperature_2m')` (un champ absent donne `null`, pas d'erreur). `data` est un nom
  réservé (`GENERATED_CODE_NAMES`).
- Une **table locale** livre ses lignes avec l'appli ; l'appli peut les modifier sur l'appareil
  (`localStorage['rublox:<appId>:tables']`). Si les lignes sont modifiées ensuite dans l'onglet
  Données, la copie de l'appareil est oubliée (empreinte des lignes du projet).
- Une **table partagée** et les **variables partagées** sont **par projet** : l'aperçu de
  l'éditeur, le test sur téléphone et l'appli publiée voient les mêmes données (comme Thunkable
  avec sa base en ligne). Les lignes d'une table partagée ne sont pas dans le projet : ni copiées
  par « Dupliquer », ni dans l'export `.rublox`. Les secrets non plus.
- **« Quand la variable partagée change »** se déclenche pour tout changement de valeur, y
  compris celui fait par l'appareil lui-même, mais pas pour la valeur reçue à l'ouverture.
- **Projet invité** : pas de relais ni de données partagées (le serveur ne peut pas savoir que
  le projet est ouvert) : les blocs d'API disent « connecte-toi », une table partagée fonctionne
  en mémoire avec un avertissement. **Site web exporté** : les connexions sans secret sont
  appelées directement par le navigateur (si l'API accepte CORS), pas de données partagées.
- **Relais** : l'appli n'envoie que l'identifiant de la connexion, le chemin, des paramètres et
  un corps ; l'adresse de base, les en-têtes et les secrets viennent du projet côté serveur
  (document vivant pour l'éditeur et le test sur téléphone, version publiée pour une appli). Le
  chemin ne peut pas sortir de l'adresse de base. Les en-têtes de la connexion ne suivent pas
  une redirection vers une autre origine. Limites : 10 s, 2 Mo (décompressé), 120 appels par
  minute et par projet, 4 redirections. Le résolveur de noms vérifie **toutes** les adresses
  d'un nom et la connexion se fait sur l'adresse vérifiée (pas de « DNS rebinding »). Il
  refuse aussi les adresses de l'instance elle-même et `RUBLOX_RELAY_DENY` (§ 6.9).
- **Ticket de l'éditeur** : l'aperçu (origine des applis, sans cookie) reçoit du studio un
  ticket HMAC valable 12 h, demandé par `POST /api/projects/:id/data/ticket` (droit de lecture)
  et passé dans `rx:load`. Il n'est revérifié que par sa signature et la corbeille : retirer un
  partage ne le révoque pas avant son expiration.
- **Carte** : MapLibre GL 6 (BSD-3), chargé à la demande, avec les styles d'OpenFreeMap
  (`tiles.openfreemap.org`, gratuit, sans clé ni compte, vérifié le 07/10/2026 ; données ©
  OpenStreetMap, attribution affichée). La CSP de l'origine des applis ajoute ce seul hôte à
  `connect-src`. Sur le **canevas** et les miniatures, la carte est une esquisse (repères placés
  d'après leurs coordonnées) : ni tuile chargée depuis le studio, ni contexte WebGL par
  miniature. Une carte avec des repères s'ouvre en les montrant tous.
- **Graphique** : dessiné en SVG par Rublox (barres, courbe, secteurs) plutôt qu'avec Chart.js :
  quelques kilo-octets, rendu identique sur le canevas, valeurs lisibles par un lecteur d'écran.
- Liaison : propriété `source` (nouveau genre `binding` : `{ table, fields }`, colonnes par
  identifiant). Quand elle est réglée, les éléments propres du composant sont ignorés (et
  masqués dans l'inspecteur) ; les événements portent en plus la ligne touchée (`row`).
- Quotas des données partagées : 16 Ko par valeur ou par ligne, 5 000 lignes par table,
  30 écritures d'affilée puis 10 par seconde par connexion, 200 connexions par projet. Les
  secrets : 30 par projet, 4 Ko chacun.
- Le tutoriel « Tchat familial » finit par « Tester sur mon téléphone » ; la synchronisation
  entre deux navigateurs est vérifiée sur l'appli publiée (`e2e/data.spec.ts`).

**Contrats pour les jalons suivants**

- Format : `packages/schema/src/data.ts` (`Table`, `Column`, `Row` avec cellules par
  identifiant de colonne, `ApiConnection`, `coerceCell`, `rowToObject`, `buildApiUrl`,
  `{{secret:NOM}}`), opérations dans `data-ops.ts` (`addTable`, `addColumn`, `addRows`,
  `importTable`, `addApi`…), CSV dans `csv.ts`, protocole des services dans `services.ts`
  (`DataCredential`, `RelayRequest`, messages `SharedFromApp` / `SharedToApp`). Dans Yjs, chaque
  table est une `Y.Map` dont les lignes sont un `Y.Array` ; l'onglet Données est annulable.
  `formatVersion` reste 1 (une table d'avant le J5 se lit avec des valeurs par défaut).
- Base : `project_secrets`, `shared_vars`, `shared_rows` (migration `0004_data`). Serveur :
  `apps/server/src/data/` (`SecretStore` et `Tickets`, `resolveCredential`, `Relay` et
  `isPublicAddress`, `SharedData` et `SharedHub`) ; routes `apps/server/src/routes/data.ts`.
- Moteur : `EngineOptions.services` (`DataServices` : `request`, `sheet`, `shared`) ;
  `engine.data` (`DataStore`) ; `engine.tableRows(id)` pour les composants liés. Les rendus
  reçoivent `tableRows` (`RendererProps`, `ScreenView`). Le lecteur fournit les services
  (`apps/player/src/data.ts`).
- Blocs : `DATA_BLOCK_TYPES` (`@rublox/blocks/data-types`, sans Blockly) ; `BlocksContext`
  gagne `tables` et `apis` ; `refreshDataBlocks` après un changement de l'onglet Données.
- Studio : `useDataTicket`, `useCanvasTableRows`, `createReadBlock` (`editor/data/`) ;
  `useEditor().dataItem` ; chaînes du J5 dans `packages/i18n/src/{fr,en}/data.ts` (`studio.data`,
  `blocks.data`, `runtime.data`, `runtime.friendly`).
- Apprentissage : conditions `table` et `api`, `variables` avec `scope` ; cibles `tab:data` et
  `data:*` (`data-tour`).
- Modèles et IA (J6) : une recette `AppSpec` ne décrit pas encore de tables ni de connexions ;
  les y ajouter demande de les déclarer dans `appSpecSchema` et le constructeur.

### 0.9 Ce que le J4b a fixé (07/10/2026)

**Fait** : présence (avatars des présents dans la barre du haut, une couleur par personne, écran
et onglet de chacun, « Aller voir »), sélection des autres sur le canevas et dans les blocs,
blocs synchronisés par pile sans déplacer la vue, conflit sur une pile signalé (qui l'a
emporté), annuler et rétablir limités à ses propres modifications, fusion des modifications
faites hors ligne par plusieurs personnes, lecture seule vérifiée côté serveur (aussi pour la
présence), fichiers des ressources recopiés quand on colle dans un autre projet. Tests :
`apps/server/test/collab.test.ts`, `packages/schema/test/conflicts.test.ts`,
`e2e/collab.spec.ts`.

**Écarts au cahier des charges, et pourquoi**

- **Conflit sur une pile** (« le dernier enregistrement l'emporte ») : seul celui dont la
  version est perdue est prévenu (« Pile modifiée par Sacha »), avec un bouton « Montrer » et la
  pile qui s'allume. Deux cas : (1) pendant qu'on glisse un bloc, les modifications des autres
  attendent ; si l'autre a changé la même pile entre-temps, il a enregistré le premier : sa
  version est gardée, la nôtre abandonnée ; (2) deux enregistrements qui se croisent sur le réseau :
  Yjs garde l'un des deux, le même partout, et l'autre est prévenu. Une modification faite **en
  connaissant** celle de l'autre (il a vu la pile, puis l'a changée) n'est pas un conflit et
  n'affiche rien. Un conflit n'est signalé que si sa propre écriture de la pile date de moins
  de 15 s.
- **Supprimer une pile** que quelqu'un d'autre modifie au même moment : Yjs garde la
  modification (une écriture concurrente l'emporte sur une suppression). Supprimer une pile que
  l'autre venait de changer le prévient (« quelqu'un », l'auteur d'une suppression n'étant pas
  connu de Yjs).
- **Lecture seule** : un lecteur apparaît dans la présence (œil, « Regarde seulement ») ; il
  peut toujours essayer dans son onglet sans rien enregistrer (§ 0.2), le serveur refusant toute
  mise à jour (`connectionConfig.readOnly`).
- **Plusieurs onglets d'un même compte** ne s'affichent pas comme quelqu'un d'autre.
- **Visiteurs d'un projet de la galerie** (J6, accès `gallery`) : ils ne sont pas des
  éditeurs du projet et n'apparaissent pas dans sa présence (le serveur ignore leur état) ; leur
  studio n'affiche pas non plus la présence. Le protocole leur envoie tout de même l'état des
  éditeurs présents (Hocuspocus ne filtre pas l'awareness par connexion) : nom, avatar, écran.
- **Barre du haut de Junior** : à 1 440 px, elle débordait déjà (le menu des préférences était
  coupé) ; les libellés de « Tester », « Partager » et « Publier » ne s'affichent en Junior
  qu'à partir de 1 536 px (icône et infobulle en dessous), comme le mot de l'état
  d'enregistrement (gardé pour les lecteurs d'écran) depuis l'onglet Données du J5. Le nom du
  projet y reste écrasé à 1 440 px (antérieur, à reprendre au J8).

**Défauts antérieurs corrigés au passage**

- Un changement de droits (`Collab.reconnect` : partage, corbeille…) laissait l'éditeur du
  propriétaire « Hors ligne » pour toujours : Hocuspocus ferme le document mais garde la
  socket, et le provider ne le rouvrait pas. Le studio le rouvre (`ServerSource`).
- Les images d'un projet du serveur restaient des silhouettes sur le canevas : le React
  Compiler mémorisait le canevas sur `session.assetUrl`, qui ne change jamais. `useAssetUrl()`
  donne une fonction qui change à l'arrivée d'un fichier.
- Le test axe « accounts » se connectait au même `admin` dans ses quatre variantes en
  parallèle : toutes recevaient le thème et le mode du profil de ce compte (le profil
  l'emporte), fixés par la première connectée ; la variante « sombre » pouvait s'afficher en
  clair (vérifié). Chaque variante a désormais son administrateur, et vérifie son thème et son
  mode avant chaque mesure. `slow.test.ts` attendait des délais fixes (20 à 60 ms) des étapes
  minutées : il attend l'état du moteur (en pause, bloc allumé, valeur écrite). Les deux
  passent 20 fois de suite (80 passages pour les quatre variantes d'axe).

**Contrats pour les jalons suivants**

- **Présence** : `awareness` du provider, état `PresenceState` (`apps/studio/src/editor/presence.ts`) :
  `user` (écrit **par le serveur** depuis la session, `beforeHandleAwareness` dans
  `collab.ts` : `id`, `name`, `avatar`, `readOnly` ; un client ne peut ni se faire passer pour un
  autre, ni modifier l'état d'une autre connexion), `view` (`tab`, `screen`), `selection`
  (composants), `block` (bloc choisi). `session.presence` (`Presence`, nul en mode invité),
  `usePeers()`, `usePeople()`, `assignColors` (une couleur par personne, la même partout).
  Un nouvel élément à partager s'ajoute à `PresenceState` et se publie par
  `presence.set({...})`.
- **Blocs** : le pont Blockly ⇄ Yjs (`editor/blocks/workspace.tsx`) garde, pile par pile, le
  JSON qu'il a chargé ou enregistré (`Known`) : il n'écrit que les piles changées ici, ne charge
  que celles changées ailleurs. `StackConflicts` et `entryWriter` (`@rublox/schema`, `conflicts.ts`).
- **Cartes des piles** : chaque écran et `app` ont leur `Y.Map` de piles dès le chargement par le
  serveur (`ensureBlockMaps`) et dès la création d'un écran (`addScreen`, `duplicateScreen`) :
  ne jamais créer une carte partagée paresseusement, deux créations concurrentes en perdent une.
- **Annulation** : `createUndoManager(ydoc, origines)` (`@rublox/schema`) ne suit que les
  transactions de l'éditeur (origine `null` et celles passées), jamais le serveur ni le cache.
- **Ressources** : afficher une ressource passe par `useAssetUrl()` (`editor/context.tsx`), pas
  par `session.assetUrl` ; coller des composants recopie les fichiers manquants dans le projet
  (`clipboard.ts`), un fichier pas encore arrivé est recherché à nouveau (1 s, 2 s…, 5 fois).
- Chaînes du J4b : `packages/i18n/src/{fr,en}/collab.ts`, espace `studio`, préfixe `collab.`.

## 1. En bref

Rublox est un clone libre de [Thunkable](https://thunkable.com) : on construit de vraies applis
pour téléphone **sans écrire de code**, en dessinant les écrans par glisser-déposer puis en
programmant leur comportement avec des **blocs** (Blockly). Il sert à apprendre la programmation,
aux enfants comme aux adultes, et à fabriquer des applis utiles.

Ce qui le distingue de Thunkable :

- tout tourne **dans le navigateur** : l'éditeur, l'aperçu, et les applis produites, qui sont des
  **PWA** installables sur l'écran d'accueil (Android et iPhone) ;
- **deux modes d'interface** sur le même logiciel : **Junior** (ludique, guidé) et **Studio**
  (dense, complet, avec le code JavaScript généré) ;
- un **parcours d'apprentissage** intégré : tutoriels pas à pas, défis, badges, exécution au
  ralenti qui allume chaque bloc ;
- **auto-hébergé**, sur invitation : les comptes enfants n'ont pas d'e-mail et sont gérés par un
  parent ou un enseignant.

## 2. Décisions de départ (Guilhem, 06/10/2026)

| Sujet | Décision |
|---|---|
| Nom | **Rublox**, choisi en connaissant sa proximité avec la marque Roblox. Conséquence : identité visuelle franchement distincte de Roblox (§ 5.6). |
| Hébergement | Auto-hébergé dans un conteneur Docker, derrière un reverse proxy nginx. |
| Comptes | **Sur invitation uniquement** : pas d'inscription libre, donc ni envoi d'e-mails ni modération publique. Un **mode invité** permet d'essayer sans compte. |
| Applis produites | **PWA + QR code** pour tester sur téléphone. Pas de compilation native (APK, IPA). |
| Interface | **Deux modes, Junior et Studio**, que chacun peut changer ; les comptes enfants démarrent en Junior. |
| Langues | Français (par défaut) et anglais, dès le premier jalon. |
| Licence | MIT. |
| Assistant IA | Codé (J6), mais **éteint tant qu'aucune clé API n'est fournie** : il coûte à l'usage. |

## 3. Vocabulaire

- **Studio** : l'application web d'édition (tableau de bord, éditeur, apprentissage, galerie).
- **Projet** : une appli en cours de fabrication. Il contient des **écrans**, des **composants**,
  des **blocs**, des **ressources** (images, sons…) et des **données**.
- **Composant** : élément d'un écran. **Visible** (bouton, texte, image…) ou **invisible**
  (minuteur, son, localisation…, rangés sous l'écran).
- **Catalogue** : la définition unique de chaque type de composant (§ 6.3).
- **Lecteur** (*player*) : la page qui fait tourner une appli : aperçu dans l'éditeur, test sur
  téléphone, appli publiée.
- **Espace** : un groupe de comptes, de type **famille**, **classe** ou **équipe**, avec des
  **responsables** (parents, enseignants) et des **membres**.
- **Publication** : une version figée d'un projet, servie comme PWA à une adresse stable.

## 4. Fonctionnalités

Priorités : **P0** indispensable au jalon indiqué, **P1** attendu dans la version complète,
**P2** bonus si le temps le permet. Le jalon est indiqué entre crochets.

### 4.1 Design des écrans [J0, J2]

- **Écrans** : ajouter, renommer, dupliquer, supprimer, réordonner ; choisir l'écran de démarrage.
  Navigation de l'appli : pile (par défaut), onglets en bas ou tiroir latéral, avec icône et
  libellé par écran. (P0)
- **Palette** de composants, par catégories, avec recherche. Glisser un composant sur l'écran ou
  dans un conteneur ; repères d'insertion clairs ; double-clic ou Entrée pour l'ajouter à la
  sélection. (P0)
- **Calques** : arbre des composants de l'écran, réordonnable par glisser-déposer, renommage en
  place, masquer, verrouiller, dupliquer, supprimer. (P0)
- **Canevas** : l'écran dans un cadre de téléphone ; préréglages (petit Android 360×780,
  iPhone 393×852, tablette 820×1180), orientation, zoom (50 à 200 %), thème clair ou sombre de
  l'appli. Clic pour sélectionner, survol qui souligne, poignées de largeur et hauteur. (P0)
- **Inspecteur** des propriétés, généré depuis le catalogue (§ 6.3) et regroupé par sections
  (Contenu, Style, Disposition, Avancé). Éditeurs dédiés : couleur (avec les couleurs du thème),
  police, icône (recherche), ressource (image, son…), dimensions (auto, remplir, px, %), marges
  et espacements (boîte visuelle), bordure, rayon, ombre, opacité. En Junior, seules les
  propriétés essentielles sont visibles, le reste sous « Plus d'options ». (P0)
- **Disposition** en boîtes flexibles : conteneurs Ligne, Colonne, Boîte et Grille, avec
  alignement, répartition, écart et retour à la ligne. Le positionnement libre n'existe que dans
  la scène de jeu et la zone de dessin. (P0)
- **Thème de l'appli** : couleur principale et secondaire, fond, police, arrondis, clair, sombre
  ou automatique. Les composants en héritent sauf réglage contraire. (P1) [J2]
- Copier, coller, dupliquer (aussi d'un écran ou d'un projet à l'autre), annuler et rétablir
  partout, multisélection en Studio. (P0 pour annuler et rétablir, P1 pour le reste)
- **Ressources** : envoyer des images, sons, vidéos, polices et animations Lottie ; les glisser
  sur le canevas ; bibliothèque de départ libre de droits (CC0) incluse dans le dépôt. (P1) [J1
  pour l'envoi au serveur, J0 pour le stockage local en mode invité]

### 4.2 Programmation par blocs [J0, J2]

- Éditeur **Blockly**, un espace de travail par écran, plus un espace « Appli » pour ce qui est
  commun (démarrage de l'appli, fonctions et variables partagées). (P0)
- **Boîte à outils** :
  - les blocs des composants **présents dans l'écran**, rangés par composant : événements
    (« quand Bouton1 est cliqué »), propriétés (lire, écrire), méthodes (« Son1 jouer ») ;
  - en Studio, des blocs « n'importe quel Bouton » pour agir sur un composant passé en
    paramètre ;
  - les catégories générales : Contrôle, Logique, Maths, Texte, Listes, Objets (dictionnaires et
    JSON), Couleurs, Date et heure, Variables, Fonctions, Écrans (naviguer, revenir),
    Interface (alerte, confirmation, saisie, message bref), Appareil, Débogage. (P0 pour le
    socle, P1 pour l'ensemble)
- **Profils de boîte à outils** : Junior voit un sous-ensemble choisi, des libellés simples et un
  bouton « Plus de blocs » ; Studio voit tout. (P0)
- **Variables** : de l'appli (en mémoire), **stockées** (gardées sur l'appareil) et **partagées**
  (sur le serveur, communes à tous les utilisateurs de l'appli, avec un événement « quand la
  variable change ») [J5]. (P0 pour l'appli, P1 pour les autres)
- Fonctions avec paramètres et valeur de retour ; listes indexées **à partir de 1**, comme
  Blockly et Scratch. (P0)
- Blocs asynchrones écrits comme des blocs ordinaires : « attendre 1 seconde », « réponse de
  l'API… » s'emboîtent sans rappel, le code généré utilisant `await`. (P0)
- Confort : recherche dans l'espace de travail, sac à dos (blocs gardés d'un projet à l'autre),
  commentaires, réduire, désactiver, nettoyer, zoom pour tout voir, mini-carte en Studio,
  navigation au clavier (extension Blockly officielle). (P1)
- Renommer un composant met à jour ses blocs ; en supprimer un signale les blocs orphelins sans
  les effacer. (P0)
- **Vue du code** (Studio, et en option en Junior) : le JavaScript généré, lisible et commenté,
  en lecture seule ; survoler un bloc surligne ses lignes et inversement. (P0 pour la vue, P1
  pour le surlignage croisé)

### 4.3 Exécution, aperçu et débogage [J0, J4]

- **Aperçu en direct** dans l'éditeur, dans un cadre de téléphone, mis à jour à chaque
  modification (moins de 300 ms). Le design se recharge sans perdre l'état ; un changement de
  blocs redémarre l'écran courant ; bouton « Redémarrer l'appli ». (P0)
- En vue Blocs, l'aperçu reste visible à côté de l'espace de travail : on voit l'effet de ses
  blocs sans changer d'onglet. (P0)
- **Console** : messages du bloc « afficher dans la console », avertissements et erreurs.
  Cliquer une erreur sélectionne le bloc fautif. Les erreurs sont rédigées pour un enfant en
  Junior (« La liste n'a que 3 éléments, et ce bloc demande le 5ᵉ »). (P0)
- **Ralenti** : exécution pas à pas qui allume le bloc en cours, avec un curseur de vitesse, et
  pause sur un point d'arrêt (clic droit sur un bloc). (P1) [J3]
- **Boucles sûres** : une boucle infinie ne fige ni l'appli ni l'éditeur ; bouton Stop. (P0)
- **Tester sur mon téléphone** : un QR code ouvre l'appli en direct sur le téléphone, mise à jour
  à chaque modification, avec l'état de connexion et la console du téléphone dans l'éditeur.
  Lien temporaire, révocable. (P0) [J4]

### 4.4 Catalogue des composants [J0, J2, J5, J7]

Chaque composant est décrit une seule fois dans le catalogue (§ 6.3) : ses propriétés, ses
événements, ses méthodes, ses blocs et son rendu en découlent. Propriétés communes aux composants
visibles : visible, largeur, hauteur, marges, espacement interne, fond, bordure, rayon, ombre,
opacité, alignement dans le parent, grandir pour remplir.

| Catégorie | Composants | Jalon |
|---|---|---|
| Disposition | Ligne, Colonne, Boîte (carte), Grille, Espace, Séparateur ; l'Écran est lui-même une colonne défilante | J0 (Ligne, Colonne), J2 |
| Base | Bouton, Texte, Champ de texte (une ou plusieurs lignes, mot de passe, nombre, e-mail), Image, Icône | J0 (Bouton, Texte, Champ, Image), J2 (Icône) |
| Saisie | Case à cocher, Interrupteur, Curseur, Liste déroulante, Choix de date, Choix d'heure, Note en étoiles (P2) | J2 |
| Affichage | Barre de progression, Indicateur de chargement, Texte riche (Markdown, P2), QR code | J2 |
| Listes | Liste simple (textes), Liste de données (modèle : image, titre, sous-titre, bouton), Grille de données | J2 ; liaison aux tables en J5 |
| Médias | Vidéo, Animation Lottie, Page web, Vue caméra, Zone de dessin (traits, formes, toucher) | J2 |
| Cartes et graphiques | Carte (MapLibre, marqueurs, position, événements), Graphique (barres, courbes, secteurs) | J5 |
| Capteurs (invisibles) | Localisation, Mouvement (accéléromètre, gyroscope, orientation), Batterie (P2), Réseau en ligne (P2) | J2 |
| Appareil (invisibles) | Minuteur, Son, Enregistreur audio, Synthèse vocale, Reconnaissance vocale, Vibreur, Appareil photo, Choix de photo, Partage, Presse-papiers, Notifications locales, Lecteur de QR code | J2 |
| Données (invisibles) | API web, Table, Feuille Google publiée (lecture, P2), IA (texte, description d'image) | J5 (IA en J6) |
| Jeu | Scène de jeu, Lutin, Texte de scène, Joystick (P2) | J7 |

Les fonctions du navigateur ne sont pas partout disponibles (vibreur absent d'iOS, reconnaissance
vocale variable, batterie réservée à Chromium) : le composant expose une propriété « disponible »
et un événement d'erreur explicite, et l'aide le dit. Les autorisations (caméra, micro, position,
mouvement sur iOS) se demandent au premier usage, avec un message clair en cas de refus.

### 4.5 Données et services [J5]

- **Onglet Données** du projet :
  - **Tables** éditables comme un tableur, colonnes typées (texte, nombre, oui/non, date, image,
    lien). Deux modes : **locale** (données livrées avec l'appli, modifications gardées sur
    l'appareil) ou **partagée** (sur le serveur, communes à tous les utilisateurs de l'appli,
    avec droits lecture seule ou lecture-écriture). Import et export CSV. (P1)
  - **Connexions API** : adresse de base, en-têtes, paramètres, secrets ; bouton « Essayer » qui
    affiche la réponse en arbre, et un clic sur un champ crée le bloc qui le lit. (P1)
  - **Secrets** (clés d'API) : saisis une fois, **jamais** copiés dans le projet ni dans l'appli
    publiée ; le relais du serveur les injecte (§ 6.9). (P1)
- **Liaison de données** : une Liste de données ou une Grille se branche sur une table depuis
  l'inspecteur, avec le choix des colonnes pour l'image, le titre et le sous-titre ; le canevas
  montre les vraies données. (P1)
- Blocs de table : lire les lignes, filtrer, trier, compter, ajouter, modifier, supprimer,
  « quand la table change ». (P1)
- Cartes MapLibre avec les tuiles vectorielles gratuites et sans clé d'OpenFreeMap (à vérifier
  au moment du jalon), marqueurs, position de l'appareil, événements. (P1)
- Graphiques alimentés par une liste ou une table. (P1)

### 4.6 Publication et export [J4]

- **Publier** : nom de l'appli, adresse (slug), icône (ressource ou émoji sur fond de couleur),
  couleur du thème, description. Chaque publication est une version figée ; l'adresse ne change
  pas d'une version à l'autre ; liste des versions ; dépublier. (P0)
- L'appli publiée est une **PWA** : manifeste, icônes générées, fonctionnement hors ligne (service
  worker propre à l'appli), page d'aide « Installer sur l'écran d'accueil » adaptée à iOS et à
  Android. (P0)
- Partager : lien, QR code imprimable. (P0)
- **Exporter** le projet en fichier `.rublox` (zip : `project.json` + ressources) et
  l'**importer** ; exporter un **site web autonome** (zip statique) hébergeable n'importe où. (P1)

### 4.7 Comptes, espaces et invitations [J1]

- **Connexion** par identifiant (ou e-mail facultatif) et mot de passe, et par **passkey** ;
  session d'un an ; liste des sessions actives, révocables. (P0)
- **Pas d'inscription libre.** Un compte se crée :
  - par un **lien d'invitation** (rôle, espace, nombre d'usages, expiration ; révocable) ;
  - ou directement par l'administrateur, ou par le responsable d'un espace pour ses membres. (P0)
- **Premier démarrage** : le compte administrateur est créé à partir des variables
  d'environnement (§ 6.10), uniquement si la base ne contient aucun compte. (P0)
- **Espaces** famille, classe ou équipe : responsables et membres. Un responsable crée des
  comptes membres **sans e-mail** (identifiant, mot de passe choisi par lui), réinitialise leurs
  mots de passe, voit leurs projets, les commente (P2), leur assigne tutoriels et défis (classe,
  P1), et règle ce qu'ils ont le droit de faire (publier, utiliser l'IA, partager dans la
  galerie). (P0 pour comptes et mots de passe, P1 pour le reste)
- **Profil** : nom affiché, avatar (illustrations fournies, pas de photo), langue, mode Junior
  ou Studio, thème clair ou sombre. (P0)
- **RGPD** : export de toutes ses données et suppression du compte ; pour un compte membre, par
  son responsable. Aucune donnée personnelle superflue (ni date de naissance, ni photo). (P1)
- Protection contre la force brute : 5 échecs par adresse IP en 15 minutes, l'adresse étant lue
  dans `X-Real-IP` et jamais dans `X-Forwarded-For` (§ 6.9). (P0)
- Double authentification TOTP pour les administrateurs. (P2)

### 4.8 Gestion des projets [J0, J1]

- **Tableau de bord** : projets en cartes avec miniature (capture de l'écran de démarrage), récents
  d'abord ; recherche, tri, filtres (mes projets, partagés avec moi, espace, favoris), dossiers
  (P2). (P0)
- Créer un projet vierge ou depuis un **modèle** (J6) ; renommer, décrire, dupliquer, mettre en
  favori, supprimer vers la **corbeille** (30 jours, restaurable). (P0)
- **Historique des versions** : enregistrement continu, instantanés automatiques (toutes les
  10 minutes d'activité) et nommés ; aperçu d'une version ; restaurer (crée une nouvelle
  version, ne détruit rien). (P1)
- **Partager** un projet avec un autre compte de l'instance, en lecture ou en écriture ;
  transférer la propriété. (P1)
- **Mode invité** : sans compte, les projets vivent dans le navigateur (IndexedDB). Ni
  publication, ni partage, ni IA ; à la connexion, proposer de rapatrier ces projets dans le
  compte. (P0) [J0 pour le stockage local, J1 pour le rapatriement]

### 4.9 Collaboration en temps réel [J4]

- Plusieurs comptes éditent le même projet en même temps : avatars des présents, sélection de
  chacun visible sur le canevas, modifications fusionnées sans conflit (Yjs, § 6.4). (P1)
- Les blocs se synchronisent par pile de blocs : deux personnes sur la même pile, le dernier
  enregistrement l'emporte, et l'interface le signale. (P1)
- Fonctionne hors ligne : les modifications reprennent à la reconnexion. (P1)

### 4.10 Apprentissage [J3]

- **Tutoriels interactifs** dans l'éditeur : bulle guidée qui met en lumière l'élément à
  utiliser, et étape validée automatiquement quand l'action est faite (un bouton est posé, tel
  bloc existe, l'aperçu a reçu un clic). Pause, reprise, progression gardée. (P0)
- **Contenus de départ**, en français et en anglais :
  - Junior : Mon premier bouton, Le dé magique, Le quiz, La boîte à sons, Le chrono, Ma liste
    de courses (variables stockées), Dessine avec ton doigt, Mon premier jeu (J7) ;
  - Studio : La météo (API Open-Meteo, sans clé), Carnet d'adresses (table), Carte de mes
    lieux, Appli à onglets, Tchat familial (variables partagées), Traduire avec l'IA (si la clé
    est fournie). (P0 pour 4 tutoriels Junior et 2 Studio, P1 pour le reste)
- **Défis** : un objectif, un projet de départ facultatif, des vérifications automatiques, et
  jusqu'à 3 étoiles (par exemple, utiliser une boucle). (P1)
- **Badges** et progression (Junior) : première appli, première publication, premier remix,
  5 tutoriels, a utilisé une boucle, une variable, une fonction… Masquables en Studio. (P1)
- **Aide** : chaque bloc et chaque composant a une fiche d'aide (FR, EN) avec un exemple ;
  panneau latéral ; glossaire. (P1)
- **Ralenti** (§ 4.3) et **vue du code** : le pont vers la vraie programmation. (P1)

### 4.11 Galerie et remix [J6]

- Galerie **interne à l'instance** des projets partagés : carte avec miniature, « Essayer »
  (l'appli publiée dans un cadre de téléphone), « Voir les blocs » (éditeur en lecture seule),
  « Remixer » (copie dans mes projets, avec la mention « remix de X par Y »). (P1)
- J'aime, compteur de remix, arbre des remix, filtres (récents, populaires, Junior ou Studio). (P1)
- Les responsables décident si leurs membres peuvent partager dans la galerie ; l'administrateur
  peut retirer un projet de la galerie. (P1)

### 4.12 Assistant IA [J6]

Invisible tant que la clé n'est pas fournie (§ 6.10), activable par espace, avec des quotas
quotidiens par compte réglés par l'administrateur.

- **Créer avec l'IA** : « une appli qui tire au sort qui fait la vaisselle » produit écrans,
  composants et blocs, présentés comme une proposition à **accepter ou refuser** (annulable). (P1)
- **Explique-moi** un bloc, une pile, un écran, avec des mots adaptés au mode. (P1)
- **Pourquoi ça ne marche pas ?** : l'assistant lit la console et les blocs concernés. (P1)
- Composant **IA** dans les applis (générer un texte, décrire une image), facturé au propriétaire
  de l'appli : désactivé dans les applis publiées tant que le propriétaire ne l'autorise pas. (P2)
- Consignes de sécurité adaptées aux enfants ; journal d'usage ; aucune donnée personnelle
  envoyée au-delà du nécessaire. (P1)

### 4.13 Administration [J1]

- Comptes : liste, création, réinitialisation du mot de passe, désactivation, suppression, rôle.
- Invitations : création, suivi des usages, révocation.
- Espaces : vue d'ensemble.
- Réglages de l'instance : nom, galerie activée, IA (activée, quotas), taille maximale des envois,
  quota de stockage par compte.
- Espace disque utilisé ; journal des actions d'administration et des connexions (P2).

## 5. Expérience et design

### 5.1 Principes

- **Instantané** : chaque action répond en moins de 100 ms ; mises à jour optimistes, squelettes de
  chargement, aucun rechargement de page, préchargement au survol, enregistrement continu avec
  indicateur (« Enregistré », « Hors ligne, en attente »).
- **Découvrable** : chaque écran vide propose l'action suivante ; palette de commandes
  (Ctrl/Cmd + K) ; infobulles avec raccourcis ; visite guidée à la première ouverture, propre à
  chaque mode.
- **Sans crainte** : annuler partout, corbeille, historique des versions ; une action
  destructrice dit précisément ce qu'elle va détruire.
- **Accessible** : WCAG 2.2 AA, tout au clavier (y compris le glisser-déposer et les blocs),
  contrastes vérifiés, `prefers-reduced-motion` respecté.

### 5.2 Deux modes

| | Junior | Studio |
|---|---|---|
| Public | enfants, débutants | ados, adultes, enseignants |
| Densité | grandes cibles (44 px et plus), texte 16 à 18 px | compact, texte 13 à 14 px |
| Ton | ludique, mascotte, petites animations de réussite, sons (désactivables) | sobre, façon Figma |
| Propriétés | essentielles, le reste sous « Plus d'options » | toutes |
| Blocs | rendu Zelos (façon Scratch), sous-ensemble, libellés simples | rendu Thrasos, tout |
| Code | masqué (activable) | vue du code, console détaillée |
| Ralenti | mis en avant | disponible |

Le mode est une préférence du compte, changeable à tout moment depuis la barre du haut. Le changer
ne modifie pas le projet.

### 5.3 Éditeur

- **Barre du haut** : retour au tableau de bord, nom du projet (modifiable en place), onglets
  **Design**, **Blocs**, **Données**, sélecteur d'écran, annuler et rétablir, état
  d'enregistrement, présents, **Tester** (QR code), **Partager**, **Publier**, mode
  Junior/Studio.
- **Design** : à gauche palette, calques et ressources ; au centre le canevas ; à droite
  l'inspecteur ; en bas la console, repliable.
- **Blocs** : à gauche la boîte à outils, au centre l'espace de travail, à droite l'aperçu en
  direct et, en Studio, la vue du code.
- Panneaux redimensionnables, dispositions mémorisées par compte.
- L'éditeur vise l'ordinateur et la tablette en paysage (1024 px et plus). Sur téléphone, le
  tableau de bord, la galerie, l'apprentissage et le lancement des applis fonctionnent ;
  l'éditeur affiche un message aimable avec un QR code pour continuer sur un ordinateur.

### 5.4 Rédaction

- Interface en **tutoiement**, phrases courtes, mots de tous les jours. En Junior, aucun jargon
  (« écran », pas « vue » ; « bloc », pas « instruction »).
- Une erreur dit ce qui s'est passé et quoi faire.
- Toutes les chaînes passent par l'internationalisation, y compris les blocs, l'aide et les
  tutoriels. Aucune chaîne en dur.

### 5.5 Système de design

- Jetons (couleurs, espacements, rayons, ombres, typographie) en variables CSS, déclinés pour
  Junior et Studio, chacun en clair et en sombre.
- Couleurs de catégories de blocs cohérentes entre la boîte à outils, la palette et l'aide, et
  contrastées en mode sombre.
- Polices auto-hébergées sous licence OFL : par exemple Inter pour Studio, Nunito ou Baloo 2
  pour Junior, JetBrains Mono pour le code. Aucun appel à Google Fonts ni à un CDN externe.
- Animations brèves (150 à 250 ms), jamais bloquantes.

### 5.6 Identité

- Nom : **Rublox**. Logo en mot-symbole à partir de blocs emboîtables. **Ne rien reprendre de
  Roblox** : ni son « O » carré incliné, ni sa typographie, ni sa palette noir et blanc. Ne rien
  reprendre non plus de Thunkable : logo, illustrations, textes.
- Palette de départ à affiner au J0 : un violet-indigo vif en couleur principale, des accents
  corail, jaune et menthe, des gris neutres, contrastes AA vérifiés.
- Mascotte originale (un petit bloc expressif), utilisée en Junior pour guider et féliciter.
  Illustrations en SVG produites pour le projet.

## 6. Architecture technique

### 6.1 Pile

Prendre la **dernière version stable** de chaque outil au moment du J0 et l'épingler. Relevé du
06/10/2026, à titre indicatif : Blockly 13.3, React 19.3, Vite 8.3, Tailwind CSS 4.3,
TanStack Router 1.170 et Query 5, Zustand 5, Yjs 13.6, Hocuspocus 4.7, Hono 4.13,
Better Auth 1.7, Drizzle ORM 0.45, Zod 4.6, Biome 2.5, Vitest 5, Playwright 1.63, Turborepo 2.11,
pnpm 12, TypeScript 7.0, Motion 14, MapLibre GL 6, i18next 26, React Compiler 1.0.

| Couche | Choix |
|---|---|
| Langage | TypeScript strict partout. TypeScript 7 (compilateur natif) si l'outillage suit ; sinon la dernière version 5.x ou 6.x, raison notée dans `CLAUDE.md`. |
| Monorepo | pnpm (espaces de travail) + Turborepo |
| Qualité | Biome (formatage et lint), `tsc --noEmit`, Vitest, Playwright |
| Studio | React 19 + React Compiler, Vite 8, TanStack Router (routes typées par fichiers) et TanStack Query, Zustand pour l'état d'interface, Yjs pour les documents |
| Interface | Tailwind CSS 4, shadcn/ui, lucide-react, Motion, Sonner, cmdk, panneaux redimensionnables, CodeMirror 6 pour la vue du code |
| Glisser-déposer | dnd-kit (capteurs clavier pour l'accessibilité) ; Pragmatic drag and drop accepté si mieux justifié |
| Blocs | Blockly 13 et extensions officielles `@blockly/*` (couleur, navigation au clavier, recherche, sac à dos, mini-carte, zoom) |
| Traductions | i18next + react-i18next, paquets de langue de Blockly |
| Serveur | Node 24 LTS, Hono, Better Auth, Drizzle ORM (PostgreSQL en production, **PGlite** en développement et en test : aucun Docker requis), Hocuspocus (Yjs), Zod, pino |
| Lecteur | React 19 et `@rublox/runtime`, service worker propre à chaque appli publiée |
| Divers | MapLibre GL, Chart.js (ou équivalent léger), dotLottie, `qrcode`, BarcodeDetector avec repli wasm, canvas-confetti |
| IA | SDK `@anthropic-ai/sdk`, modèles réglables par variable d'environnement |

### 6.2 Dépôt

```
rublox/
├── apps/
│   ├── studio/       # SPA de l'éditeur : tableau de bord, éditeur, apprentissage, galerie, admin
│   ├── player/       # lecteur servi sur l'origine des applis : aperçu, test en direct, PWA publiées
│   └── server/       # API Hono, authentification, WebSockets, service des deux origines
├── packages/
│   ├── schema/       # format de projet : types, schémas Zod, migrations, passage Yjs <-> JSON
│   ├── catalog/      # définition des composants : propriétés, événements, méthodes, aide
│   ├── runtime/      # rendu des composants, moteur d'exécution, API du code généré, pont postMessage
│   ├── blocks/       # blocs Blockly, générateur JavaScript, boîtes à outils, thèmes, messages
│   ├── ui/           # composants d'interface partagés (studio, lecteur)
│   ├── i18n/         # chaînes FR et EN
│   └── config/       # tsconfig et Biome partagés
├── content/          # tutoriels, défis, modèles, ressources CC0 (FR et EN)
├── e2e/              # tests Playwright
├── docker/           # Dockerfile, compose.yaml d'exemple
└── docs/             # ce cahier des charges, guides
```

Règle de dépendance : `schema` ne dépend de rien ; `catalog` de `schema` ; `runtime` et `blocks`
de `catalog` ; les applications de tout le reste. Aucun paquet ne dépend d'une application.

### 6.3 Le catalogue, source unique

Chaque type de composant est déclaré **une seule fois**, dans `packages/catalog`, et tout le
reste en découle : palette, inspecteur, blocs, rendu, aide, validation. Esquisse :

```ts
defineComponent({
  type: 'Button',
  category: 'base',
  icon: 'square-mouse-pointer',
  visible: true,
  container: false,
  junior: true,                         // disponible en Junior
  props: {
    text: prop.string({ default: { fr: 'Bouton', en: 'Button' }, group: 'content', junior: true }),
    icon: prop.icon({ optional: true, group: 'content' }),
    variant: prop.enum(['filled', 'outline', 'ghost'], { default: 'filled', group: 'style' }),
    disabled: prop.boolean({ default: false, group: 'advanced', blocks: 'get-set' }),
    // + propriétés communes (visible, dimensions, marges, fond, bordure…)
  },
  events: {
    click: event({ junior: true }),
    longPress: event(),
  },
  methods: {},
  help: { fr: '…', en: '…' },          // fiche d'aide avec exemple
})
```

- Les libellés passent par l'internationalisation.
- Le rendu React de chaque type vit dans `runtime`, indexé par `type` ; un test vérifie que chaque
  type du catalogue a un rendu, des blocs et une aide dans les deux langues.
- Ajouter un composant = une déclaration + un rendu + une fiche d'aide. Rien d'autre à toucher.

### 6.4 Format de projet

Le projet est un document **Yjs** dès le J0, même sans collaboration : cela donne l'annulation
(`Y.UndoManager`), le hors-ligne (`y-indexeddb`) et, au J4, la collaboration sans réécriture. Une
fonction de `schema` le convertit en JSON (`ProjectDoc`), forme utilisée par le lecteur, l'export
et les instantanés. Esquisse :

```ts
type ProjectDoc = {
  format: 'rublox/project'
  formatVersion: 1                      // migrations dans packages/schema
  meta: { id: string; name: string; description?: string; mode: 'junior' | 'studio'; createdAt: string; updatedAt: string }
  settings: {
    theme: Theme                        // couleurs, police, arrondis, clair/sombre/auto
    navigation: { kind: 'stack' | 'tabs' | 'drawer'; startScreen: ScreenId; items?: NavItem[] }
    orientation: 'portrait' | 'landscape' | 'any'
    icon?: AssetId
  }
  screenOrder: ScreenId[]
  screens: Record<ScreenId, {
    name: string                        // identifiant JS valide, unique dans le projet
    rootId: ComponentId                 // colonne racine
    components: Record<ComponentId, {
      type: string                      // type du catalogue
      name: string                      // identifiant JS valide, unique dans l'écran
      props: Record<string, unknown>    // seulement les valeurs différentes du défaut
      children?: ComponentId[]
      hidden?: boolean; locked?: boolean   // état d'édition, pas d'exécution
    }>
    nonVisual: ComponentId[]            // composants invisibles de l'écran
  }>
  blocks: Record<ScreenId | 'app', Record<TopBlockId, BlocklyJson>>   // une entrée par pile
  variables: { app: VarDecl[]; stored: VarDecl[]; shared: VarDecl[] }
  assets: Record<AssetId, { name: string; kind: 'image' | 'sound' | 'video' | 'font' | 'lottie' | 'file'; mime: string; size: number; sha256: string }>
  data: { tables: Record<TableId, Table>; apis: Record<ApiId, ApiConnection> }   // jamais de secret ici
}
```

Dans Yjs : une `Y.Map` par niveau (écrans, composants, propriétés), des `Y.Array` pour les
ordres, et les blocs **par pile** (une entrée JSON par bloc de tête), ce qui rend les fusions
naturelles. Identifiants : nanoid courts pour le contenu d'un projet, UUIDv7 en base.

### 6.5 Code généré et exécution

Le générateur produit, par écran, un module JavaScript **lisible**, celui que montre la vue du
code :

```js
// Écran « Accueil »
export default async function ({ components, app, stored, shared, screens, ui, device, rx }) {
  const { Bouton1, Texte1, Champ1, Son1 } = components

  Bouton1.onClick(async () => {
    Texte1.text = 'Bonjour ' + Champ1.text
    await Son1.play()
    for (let i = 1; i <= 3; i++) {
      await rx.tick()                   // cède la main : une boucle infinie ne fige rien
      app.score = app.score + 1
    }
  })
}
```

- Les composants sont des objets mandataires (proxies) : lire et écrire une propriété passe par le
  moteur, qui valide la valeur et met à jour le rendu.
- Tous les gestionnaires sont `async` ; les blocs d'attente et d'appel réseau génèrent `await`.
- Chaque boucle appelle `rx.tick()`, qui ne cède la main que si 16 ms se sont écoulées.
- En **ralenti**, une seconde variante générée insère `await rx.step('<id du bloc>')` avant
  chaque instruction : le moteur allume le bloc et attend selon la vitesse choisie.
- Une erreur non rattrapée remonte à la console avec l'identifiant du bloc en cours.
- Le code est chargé comme module (URL `blob:`), jamais par `eval` ; il ne voit que l'objet
  passé en paramètre.
- Les chaînes saisies dans les blocs sont échappées par le générateur ; un test vérifie qu'un
  texte piégé (guillemets, `</script>`, `${…}`) reste une chaîne.

Le **lecteur** reçoit `{ doc: ProjectDoc, code: Record<ScreenId | 'app', string> }`, rend les écrans
avec les composants du catalogue, applique la navigation (pile, onglets, tiroir ; revenir garde
l'état de l'écran précédent), et dialogue avec l'éditeur par `postMessage` : mise à jour du
projet, journaux, erreurs, bloc en cours, composant cliqué dans l'aperçu (qui le sélectionne dans
l'éditeur).

### 6.6 Deux origines

Le code des applis ne doit jamais s'exécuter sur l'origine du studio, sinon une appli remixée
pourrait agir avec la session de celui qui la regarde.

- **Origine du studio** (`STUDIO_URL`) : interface, API, cookies de session.
- **Origine des applis** (`APPS_URL`, un autre nom d'hôte) : le lecteur, les applis publiées, les
  ressources, le relais d'API et les variables partagées. Aucun cookie du studio n'y existe.
- L'aperçu de l'éditeur est une `iframe` vers l'origine des applis, avec les autorisations
  utiles (`camera`, `microphone`, `geolocation`, `accelerometer`, `gyroscope`, `clipboard-write`,
  `web-share`, `fullscreen`, `autoplay`).
- Les applis publiées partagent l'origine des applis : le moteur range leur stockage par
  identifiant d'appli. Limite connue et acceptée : une appli pourrait lire le stockage local
  d'une autre.
- En développement : studio sur `localhost:5173`, lecteur sur `127.0.0.1:5174`.

### 6.7 Serveur

Un seul processus Node sert les deux origines, distinguées par l'en-tête `Host` :

- **Studio** : fichiers de `apps/studio` ; `/api/*` (Hono, client typé `hc` côté studio) ;
  `/api/auth/*` (Better Auth) ; `/ws/collab` (Hocuspocus).
- **Applis** : fichiers de `apps/player` ; `/a/<slug>/` (applis publiées, manifeste et service
  worker générés) ; `/live/<jeton>` (test sur téléphone) ; `/assets/<sha256>` (ressources,
  cache immuable) ; `/_rx/proxy` (relais d'API) ; `/_rx/shared` (variables et tables partagées,
  WebSocket) ; `/_rx/live` (WebSocket du test en direct).
- Migrations Drizzle appliquées au démarrage ; `/healthz` pour la sonde Docker.

Grandes routes de l'API : `me`, `invites`, `spaces` (et leurs membres), `projects` (CRUD,
corbeille, duplication, remix, versions, export, import, ressources, secrets, publication),
`gallery`, `learn`, `ai`, `admin`.

### 6.8 Données (PostgreSQL)

En plus des tables de Better Auth (`user`, `session`, `account`, `verification`, `passkey`,
`organization`, `member`, `invitation`) :

- `user` étendu : `username`, `displayName`, `avatar`, `locale`, `uiMode`, `role`, `disabled`,
  `managedBySpaceId` ;
- `space_settings` (espaces = organisations Better Auth) : type, droits des membres ;
- `invites` : code haché, créateur, rôle, espace, usages, expiration, révocation ;
- `projects` : propriétaire, espace, nom, description, visibilité (`private`, `space`,
  `gallery`), `remixOfId`, miniature, dates, `deletedAt` ;
- `project_members` (partage), `project_favorites` ;
- `project_docs` : état Yjs (`bytea`) et dernier JSON ; `project_versions` : instantanés ;
- `assets` : propriétaire, projet, type, taille, `sha256`, chemin sur disque ;
- `publications` : projet, slug unique, version, paquet figé (doc, code compilé, ressources),
  dates ;
- `shared_vars`, `shared_rows` : données partagées des applis ;
- `project_secrets` : chiffrés en AES-GCM avec une clé dérivée de `RUBLOX_SECRET` ;
- `likes`, `learning_progress`, `badges`, `ai_usage`, `audit_log` (P2).

### 6.9 Sécurité

- Cookies `HttpOnly`, `Secure`, `SameSite=Lax` ; vérification d'origine sur toute requête qui
  modifie quelque chose ; en-têtes CSP stricts sur les deux origines.
- Derrière le reverse proxy, l'adresse du client est **`X-Real-IP`**, et seulement si
  `TRUST_PROXY=true`. Ne jamais se fier à `X-Forwarded-For`.
- Le reverse proxy de production bannit les adresses qui accumulent des réponses 401 : le studio
  ne doit pas en produire en usage normal (session expirée détectée côté client, pas de sondage
  répété d'une route protégée).
- **Relais d'API** : uniquement pour un projet ouvert dans l'éditeur, un lien de test valide ou
  une appli publiée ; refuse les adresses privées, de bouclage, locales au lien et de
  métadonnées, **après** résolution DNS et à chaque redirection ; délai, taille de réponse et
  débit plafonnés ; injecte les secrets côté serveur.
- Le relais refuse aussi **l'instance elle-même** : les adresses vers lesquelles résolvent les
  noms de `STUDIO_URL` et `APPS_URL` (résolues au démarrage puis toutes les 5 minutes ; un nom
  qui ne résout plus garde ses dernières adresses), et ces noms. Derrière un routeur domestique,
  le nom public résout vers l'adresse publique du routeur, et un appel vers elle revient par le
  NAT (« hairpin ») avec une adresse source **locale** : sans ce refus, une appli joindrait
  tous les services publiés sur la même adresse en passant pour le réseau local (listes
  blanches, bannissements qui ignorent le réseau local).
- **`RUBLOX_RELAY_DENY`** : ce que l'administrateur interdit en plus, séparé par des virgules :
  suffixes de noms (`example.com` refuse aussi `*.example.com`), vérifiés avant résolution, et
  plages CIDR IPv4 ou IPv6 (ou adresses seules), vérifiées après résolution (formes IPv4 dans
  IPv6 comprises), à chaque redirection. Une entrée invalide empêche le démarrage.
- Envois : taille maximale réglable, type vérifié sur le contenu, SVG servis sans exécution de
  script, quota par compte.
- Comptes membres : un responsable n'agit que sur les membres de ses espaces ; vérifié côté
  serveur, avec des tests.
- Aucune donnée envoyée à un service tiers sans action explicite (pas de télémétrie, pas de
  CDN).

### 6.10 Déploiement

- Une **image Docker** (`ghcr.io/guim31/rublox`) multi-étapes sur `node:24` allégée, utilisateur
  non root, sonde de santé. Un `docker/compose.yaml` d'exemple l'associe à PostgreSQL.
- Variables d'environnement : `DATABASE_URL`, `STUDIO_URL`, `APPS_URL`, `RUBLOX_SECRET` (32 octets
  ou plus), `RUBLOX_ADMIN_USERNAME` et `RUBLOX_ADMIN_PASSWORD` (premier démarrage seulement),
  `DATA_DIR` (ressources), `TRUST_PROXY`, `MAX_UPLOAD_MB`, `ANTHROPIC_API_KEY` (facultative),
  `RUBLOX_AI_MODEL`, `RUBLOX_AI_FAST_MODEL`, `RUBLOX_RELAY_DENY` (facultative, § 6.9 : les
  autres services auto-hébergés à ne jamais laisser joindre par le relais).
- CI GitHub Actions (dépôt public, minutes gratuites) : sur chaque PR, Biome, types, tests
  unitaires, construction, Playwright (Chromium), construction de l'image sans la pousser ; sur
  `main`, image `:edge` ; sur une étiquette `v*`, images `:x.y.z` et `:latest`. Une seule
  architecture (amd64), `concurrency` avec annulation, durée maximale par tâche.
- Le déploiement réel (reverse proxy, noms de domaine, sauvegardes) est hors du dépôt.

## 7. Qualité

- **Tests unitaires** : schéma et migrations, catalogue (complétude), générateur (instantanés du
  code produit pour chaque bloc), moteur (propriétés, événements, navigation, boucles sûres),
  autorisations de l'API (PGlite).
- **Tests de bout en bout** (Playwright), à tenir à jour à chaque jalon : mode invité (poser un
  bouton, écrire ses blocs, voir l'effet dans l'aperçu) ; connexion ; invitation ; création et
  gestion de projet ; publication puis ouverture de l'appli publiée ; tutoriel « Mon premier
  bouton ».
- **Accessibilité** : axe sur les pages principales, dans les tests de bout en bout.
- **Performances** : studio sous 300 Ko gzip avant l'éditeur, Blockly et l'éditeur chargés à la
  demande ; aperçu mis à jour en moins de 300 ms ; une modification de propriété en moins de 50 ms.
- **Captures** : chaque PR qui touche l'interface joint des captures (Junior et Studio, clair et
  sombre) dans sa description.
- Un jalon n'est terminé que lorsque ses critères d'acceptation (§ 8) passent et que la CI est
  verte.

## 8. Jalons

Chaque jalon donne une branche et une PR. J1, J2 et J3 partent de J0 et avancent en parallèle ;
J4, J5 et J7 après eux ; J6 après J4 ; J8 en dernier.

### J0 — Socle et tranche verticale

Monorepo, outillage, CI, image Docker. Schéma de projet, Yjs, catalogue avec Écran, Ligne,
Colonne, Bouton, Texte, Champ de texte, Image. Éditeur (Design et Blocs), aperçu, console, vue du
code, Junior et Studio, FR et EN, mode invité.

Acceptation :

- `pnpm install && pnpm dev` démarre studio, lecteur et serveur sans Docker ni base externe.
- En mode invité : créer un projet, poser un Bouton et un Texte, écrire « quand Bouton1 est
  cliqué, mettre Texte1.texte à "Bonjour" », cliquer dans l'aperçu, voir « Bonjour ».
- Annuler et rétablir ; recharger la page retrouve le projet ; deux écrans et la navigation entre
  eux fonctionnent.
- Bascule Junior et Studio, FR et EN, clair et sombre.
- Une boucle infinie ne fige rien ; le bouton Stop l'arrête.
- CI verte ; `docker build` réussit ; `docker compose up` sert le studio et répond sur `/healthz`.

### J1 — Comptes, espaces et projets côté serveur

Better Auth (identifiant, passkey, admin, organisations), premier démarrage, invitations, espaces
et comptes membres, profil, tableau de bord branché sur le serveur, corbeille, favoris,
ressources envoyées au serveur, historique des versions, partage entre comptes, rapatriement des
projets invités, administration.

Acceptation : parcours de bout en bout « l'admin crée une invitation, un parent s'inscrit, crée
l'espace Famille et un compte enfant, l'enfant se connecte et crée un projet que le parent voit » ;
tests d'autorisations de l'API.

### J2 — Catalogue complet

Tous les composants du § 4.4 marqués J2, avec propriétés, blocs, rendu et aide FR et EN, thème
de l'appli, navigation par onglets et tiroir, multisélection, copier-coller entre écrans.

Acceptation : le test de complétude du catalogue passe ; une appli de démonstration utilise
chaque composant ; capteurs et autorisations testés sur un vrai téléphone (Android et iPhone),
résultats notés dans `docs/compatibilite.md`.

### J3 — Junior, Studio et apprentissage

Finition des deux modes, mascotte, visite guidée, page d'accueil, moteur de tutoriels, premiers
tutoriels, défis, badges, ralenti, fiches d'aide, messages d'erreur pour enfants.

Acceptation : un enfant de 8 ans termine « Mon premier bouton » seul (test de bout en bout du
parcours, puis essai réel avec Guilhem) ; les tutoriels marqués P0 existent dans les deux langues.

### J4 — Collaboration, téléphone, publication

Hocuspocus et présence, test sur téléphone par QR code, publication PWA (manifeste, icônes,
service worker, hors ligne), versions de publication, export et import `.rublox`, export en site
web.

Acceptation : deux navigateurs éditent le même projet ; un téléphone suit les modifications en
direct ; une appli publiée s'installe et s'ouvre hors ligne.

### J5 — Données et services

Onglet Données, tables locales et partagées, liaison de données, connexions API avec secrets et
relais, variables stockées et partagées, cartes, graphiques.

Acceptation : le tutoriel Météo fonctionne de bout en bout ; une appli Tchat familial synchronise
deux téléphones ; le relais refuse `http://127.0.0.1`, `http://169.254.169.254` et un nom de domaine
qui résout vers une adresse privée (tests).

### J6 — Galerie, remix, modèles, IA

Galerie interne, j'aime, remix et arbre des remix, 12 modèles (FR et EN), assistant IA (créer,
expliquer, déboguer) et composant IA, quotas.

Acceptation : sans `ANTHROPIC_API_KEY`, aucune trace de l'IA dans l'interface ; avec, « Créer avec
l'IA » produit un projet valide que l'utilisateur accepte ou refuse.

### J7 — Mode jeu

Scène de jeu (positionnement libre), lutins (costumes, vitesse, gravité, rebonds, collisions,
toucher, glisser), sons, score, tutoriel « Mon premier jeu ».

Acceptation : un jeu d'attrape-objets se construit uniquement avec des blocs et tourne à 60 images
par seconde sur un téléphone moyen.

### J8 — Finitions et mise en production

Audit d'accessibilité, de performances et de sécurité, nettoyage, documentation utilisateur,
version `v1.0.0`.

## 9. Hors périmètre

- Compilation native Android ou iOS (APK, IPA) et publication dans les magasins d'applis.
- Inscription libre, envoi d'e-mails, modération publique.
- Paiements, publicités, achats intégrés.
- Import des projets Thunkable (format propriétaire).
- Bluetooth et NFC, jeux multijoueurs en temps réel.

## 10. Questions ouvertes

- Clé d'API Claude et budget mensuel de l'IA (avant J6).
- Nom de la mascotte.
- Un membre d'espace peut-il publier sans validation de son responsable ? Réglage par espace
  prévu ; valeur par défaut à décider (proposition : oui pour les familles, non pour les classes).
