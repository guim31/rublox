# Rublox — cahier des charges

Ce document fait foi. Il décrit ce que Rublox doit faire, comment il est construit, et dans quel
ordre. Chaque session de code le lit en entier avant de commencer, et met à jour la section
« État » (§ 0) à la fin de son jalon. Une décision qui s'en écarte s'écrit ici, avec sa raison.

## 0. État

| Jalon | Contenu | État |
|---|---|---|
| J0 | Socle et tranche verticale (mode invité) | à faire |
| J1 | Comptes, espaces, invitations, projets côté serveur | à faire |
| J2 | Catalogue complet des composants et de leurs blocs | à faire |
| J3 | Expérience Junior et Studio, apprentissage, accueil | à faire |
| J4 | Collaboration, test sur téléphone, publication PWA, export | à faire |
| J5 | Données et services : tables, variables, API web, cartes, graphiques | à faire |
| J6 | Galerie, remix, modèles, assistant IA | à faire |
| J7 | Mode jeu : scène, lutins, physique | à faire |
| J8 | Finitions : accessibilité, performances, sécurité, mise en production | à faire |

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
  `RUBLOX_AI_MODEL`, `RUBLOX_AI_FAST_MODEL`.
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
