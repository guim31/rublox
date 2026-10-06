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
  Playwright pour ce qui touche l'interface. Une session cloud ne peut pas lire la CI GitHub :
  elle doit la rendre verte d'avance.
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
- Le proxy refuse `api.github.com` et `codeload.github.com` : pas de `gh`, et aucune dépendance
  tirée d'une archive GitHub. Le registre npm passe.
- La PR brouillon s'ouvre d'elle-même au premier push de la branche.
- Docker n'est pas supposé disponible : PGlite remplace PostgreSQL en développement et en test.
- Si Playwright ne peut pas télécharger son navigateur, chercher le Chromium préinstallé
  (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`).

## Commandes

À compléter au J0.

## Pièges

Aucun pour l'instant.
