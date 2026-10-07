# Guide d’utilisation de Rublox

*Version 1.0.0*

Rublox sert à fabriquer de vraies applis pour téléphone avec des blocs. Tu dessines les écrans, tu
assembles des blocs pour dire à l’appli quoi faire, et tu l’essaies tout de suite. Ce guide est pour
tout le monde : un parent, un enseignant, un enfant qui sait lire, un adulte qui débute.

Les mots entre « guillemets » sont ceux que tu vois à l’écran. Si ton interface est en anglais, lis
plutôt le [guide en anglais](en.md).

## Sommaire

1. [Premiers pas](#1-premiers-pas)
2. [Junior et Studio](#2-junior-et-studio)
3. [L’éditeur](#3-léditeur)
4. [Apprendre](#4-apprendre)
5. [Comptes et espaces](#5-comptes-et-espaces)
6. [Publier et tester sur téléphone](#6-publier-et-tester-sur-téléphone)
7. [Données](#7-données)
8. [Galerie et remix](#8-galerie-et-remix)
9. [Assistant IA](#9-assistant-ia)
10. [Mode jeu](#10-mode-jeu)
11. [Pour l’administrateur](#11-pour-ladministrateur)
12. [Questions fréquentes](#12-questions-fréquentes)

---

## 1. Premiers pas

### 1.1 Qu’est-ce que Rublox ?

Rublox est un logiciel libre (licence MIT) qui tourne dans le navigateur. Une famille, une école ou
un club l’installe sur son propre serveur : Rublox est **auto-hébergé**. On n’y entre pas
librement : il faut une **invitation**.

Avec Rublox, tu peux :

- **dessiner tes écrans** en glissant des boutons, des textes, des images, des listes, une carte…
  sur un vrai écran de téléphone ;
- **programmer avec des blocs** qui s’emboîtent comme des briques ;
- **essayer ton appli** tout de suite dans l’aperçu, puis sur ton téléphone avec un QR code ;
- **publier ton appli** : elle a sa propre adresse et s’installe sur l’écran d’accueil d’un
  téléphone Android ou d’un iPhone ;
- **apprendre pas à pas** avec des tutoriels, des défis à étoiles, des badges et un ralenti qui
  allume chaque bloc pendant qu’il s’exécute.

Une appli Rublox est une **PWA**, une appli web qui s’installe. Rublox ne fabrique pas de fichier
pour le Play Store ou l’App Store.

### 1.2 Essayer sans compte (mode invité)

Pas besoin de compte pour commencer. Sur la page d’accueil, choisis « Essayer sans compte » (sur la
page de connexion : « Continuer sans compte »).

En mode invité :

- tes projets restent **dans ce navigateur**, sur cet appareil. Le badge « Mode invité » le rappelle
  en haut de la page. Si tu effaces les données du navigateur, ils disparaissent ;
- tu peux dessiner, programmer, utiliser l’aperçu, suivre les tutoriels, importer et exporter un
  fichier `.rublox` ;
- tu ne peux pas tester sur ton téléphone, partager, publier, ni utiliser l’assistant IA : ces
  boutons sont grisés, et leur bulle dit pourquoi (« Pas disponible en mode invité. ») ;
- les données partagées et les appels à des services sur Internet ne marchent pas (section 7).

Quand tu te connectes plus tard dans le même navigateur, Rublox propose de récupérer ces projets :
« Des projets attendent dans ce navigateur ». Choisis « Ranger dans mon compte » ou « Plus tard ».

### 1.3 Se connecter

Clique sur « Me connecter » en haut à droite (ou « Se connecter » sur la page d’accueil). Tu peux
entrer :

- avec ton « Identifiant ou e-mail » et ton « Mot de passe », puis « Me connecter » ;
- avec « Utiliser une passkey » : ton empreinte, ton visage ou le code de ton appareil (après en
  avoir ajouté une, voir 5.8).

Pas de compte ? « Demande une invitation à un adulte ou à l’administrateur. » Après cinq essais
ratés, il faut patienter : « Trop d’essais. Réessaie dans … min. » Une connexion dure un an sur un
appareil.

### 1.4 Le tableau de bord

C’est la page « Mes projets ». La barre du haut mène à « Mes projets », « Galerie », « Espaces »,
« Apprendre » et, pour l’administrateur, « Administration ». En mode invité, seuls « Mes projets »
et « Apprendre » sont proposés. ([capture](../screenshots/j0/dashboard.png))

**Créer un projet.** « Nouveau projet », puis un « Nom du projet ». Choisis « Projet vierge » (un
écran vide) ou un **modèle**, une petite appli toute prête, puis « Créer depuis ce modèle ». Les
modèles fournis ([capture](../screenshots/j6/junior-light-templates.png)) :

| Junior | Studio |
|---|---|
| Dis bonjour, Lance le dé, Le quiz des animaux, Qui fait la vaisselle ?, Mon carnet de dessin, Tableau des scores, Le minuteur des dents, Attrape l’étoile | Partage de l’addition, Convertisseur de températures, Liste de courses, Appli à onglets |

**Autres boutons.** « Importer » ouvre un fichier `.rublox` (voir 6.5). « Créer avec l’IA »
n’apparaît que si l’assistant IA est activé (section 9).

**Chercher, trier, filtrer.** « Chercher un projet » filtre par nom. « Trier » : « Récents d’abord »
ou « Par nom ». Les filtres « Tous », « Favoris » et « Corbeille » sont toujours là ; avec un compte
s’ajoutent, quand ils servent, « Les miens », « Partagés avec moi » et « Mon espace » (les projets
des membres d’un espace que tu gères).

**Sur chaque carte** : la miniature de l’écran de démarrage, la date de modification, l’étoile
« Ajouter aux favoris », et le menu « Actions sur … » : ouvrir, « Renommer », « Dupliquer »,
« Supprimer ».

**La corbeille.** « Supprimer » envoie le projet à la corbeille. « Les projets restent 30 jours dans
la corbeille, puis disparaissent. » Dans le filtre « Corbeille », tu peux « Restaurer » un projet ou
le « Supprimer définitivement ».

**L’appli de démonstration.** Depuis le tableau de bord, la palette de commandes (Ctrl/Cmd + K, voir
3.5) propose « Ouvrir l’appli de démonstration (tous les composants) » : un projet qui utilise
chaque composant, avec ses blocs.

### 1.5 La page d’accueil et la visite guidée

La page d’accueil s’affiche à un visiteur non connecté qui n’a pas encore choisi « Essayer sans
compte ». Elle présente Rublox et ses deux modes.

La première fois que tu ouvres l’éditeur dans un mode, une **visite guidée** montre les coins
importants : les composants, l’écran de l’appli, les réglages, les blocs, l’aide. Suis-la
(« Suivant », « Précédent », « Terminer ») ou clique « Passer la visite ». Pour la revoir :
« Aide », puis « Revoir la visite guidée ». ([capture](../screenshots/j3/junior-light-tour.png))

### 1.6 Langue, thème et mode

En haut à droite de chaque page :

- l’interrupteur **« Mode »** : « Junior » ou « Studio » (section 2) ;
- le bouton **« Réglages de l’interface »** : « Thème » (« Clair », « Sombre » ou « Automatique »,
  qui suit ton appareil) et « Langue » (« Français » ou « English »).

Avec un compte, ces choix sont aussi dans « Mon compte », partie « Préférences » : « Elles te
suivent sur tous tes appareils. » La palette de commandes les propose aussi (« Passer en mode
Junior », « Thème sombre », « Interface en anglais »…).

Changer la langue de l’interface ne traduit pas tes projets : les textes de ton appli (le texte d’un
bouton, par exemple) restent dans la langue où le projet a été créé.

---

## 2. Junior et Studio

Rublox a deux modes d’interface. Chacun choisit le sien et en change quand il veut. **Changer de
mode ne modifie pas le projet.** Les comptes d’enfants créés par un espace démarrent en Junior.

| | Junior | Studio |
|---|---|---|
| Pour qui | enfants, débutants | ados, adultes, enseignants |
| Interface | grands boutons, gros texte, une mascotte qui guide et félicite, des sons (qu’on peut couper) | compacte, sobre |
| Composants | une sélection | tous |
| Propriétés | les essentielles ; le reste sous « Plus d’options » | toutes |
| Blocs | arrondis façon Scratch, une sélection, libellés simples ; interrupteur « Plus de blocs » | tous |
| Code | caché ; interrupteur « Voir le code » | toujours visible sous l’aperçu |
| Sélection | un composant à la fois | plusieurs (Maj + clic) |
| Console | repliée au départ | ouverte |
| Badges | toujours affichés | peuvent être masqués |

Réservés au Studio : les composants IA, Enregistreur audio, Batterie, Réseau, Presse-papiers,
Notifications locales et Feuille Google.

**Changer de mode** : l’interrupteur « Mode » en haut à droite, la palette de commandes (« Passer en
mode Studio »), ou « Mon compte › Préférences ».

En Junior, sur un écran de moins de 1 536 pixels de large, les boutons « Tester », « Partager » et
« Publier » n’affichent que leur icône : passe la souris dessus pour lire leur nom.

Captures : [Design en Junior](../screenshots/j2/design-junior-light.png),
[Design en Studio](../screenshots/j2/design-studio-light.png).

---

## 3. L’éditeur

Ouvre un projet depuis le tableau de bord. L’éditeur a besoin d’un ordinateur ou d’une tablette en
paysage. Sur un téléphone, il affiche « L’éditeur a besoin d’un écran plus grand » avec un QR code
pour continuer sur un ordinateur.

### 3.1 La barre du haut

De gauche à droite :

- le **logo** : retour au « Tableau de bord » ;
- le **nom du projet** : clique dessus pour le changer ;
- les onglets **« Design »**, **« Blocs »** et **« Données »**, puis le **sélecteur d’écran**
  (3.2.6) ;
- **« Annuler »** et **« Rétablir »** ;
- l’**état d’enregistrement** : « Enregistrement… », puis « Enregistré ». Rublox enregistre tout
  seul, en continu. Tu peux aussi voir « Hors ligne » (tes changements partiront quand la connexion
  reviendra) ou « Lecture seule » ;
- les **avatars** des personnes présentes dans le projet (5.13) et la loupe **« Palette de
  commandes »** ;
- **« Historique »** (projets d’un compte seulement, 5.10) et le menu **« Projet »** (exports,
  6.5) ;
- **« Tester »** (6.1), **« Partager »** (5.11 et section 8) et **« Publier »** (6.2) ;
- **« Aide »**, l’interrupteur **« Mode »** et **« Réglages de l’interface »**.

### 3.2 L’onglet Design

C’est ici que tu dessines tes écrans : à gauche les composants et les calques, au centre l’écran de
l’appli dans un cadre de téléphone, à droite les propriétés, en bas la console.

#### 3.2.1 La palette des composants

La palette « Composants » range les composants par catégories : Disposition, Base, Saisie,
Affichage, Listes, Médias, Cartes et graphiques, Capteurs, Appareil, Données, Jeu. « Chercher un
composant » filtre la liste.

Pour ajouter un composant, **glisse-le** sur l’écran ou dans un conteneur (Ligne, Colonne, Boîte…) :
un repère montre où il va se poser (« Dépose ici »). Ou choisis-le et appuie sur **Entrée** (ou
double-clique). Sur une tablette, appuie longtemps sur le composant, puis glisse-le avec le doigt.

Les **composants invisibles** (Minuteur, Son, Localisation, Vibreur…) ne se voient pas dans
l’appli : ils se rangent sous le téléphone, dans « Composants invisibles ».

La mise en page se fait en boîtes (Ligne, Colonne, Boîte, Grille). On ne place un composant à un
endroit précis que dans une scène de jeu (section 10).

#### 3.2.2 Les calques

Sous la palette, l’onglet « Calques » montre l’arbre des composants de l’écran. Glisse un composant
pour changer sa place, double-clique pour le renommer, et utilise ses boutons : « Masquer dans
l’éditeur », « Verrouiller », dupliquer, supprimer. Au clavier : « Espace pour saisir, flèches pour
déplacer, Alt + flèches pour monter ou descendre. »

#### 3.2.3 Le canevas

Le canevas montre l’écran de ton appli. Clique sur un composant pour le choisir ; ses poignées
« Largeur » et « Hauteur » changent sa taille. La barre du canevas choisit l’« Appareil » (« Petit
Android », « iPhone », « Tablette »), permet de « Pivoter », « Zoomer », « Dézoomer », « Ajuster à
la fenêtre », et ouvre le « Thème de l’appli ».

#### 3.2.4 L’inspecteur

À droite, « Propriétés » montre les réglages du composant choisi :

- « Nom » : le nom utilisé dans les blocs (par exemple Bouton1). Il commence par une lettre, sans
  espace, et n’est pas déjà pris ;
- les réglages, rangés en « Contenu », « Style », « Disposition » et « Avancé », chacun avec son
  éditeur : couleur (avec les « Couleurs du thème »), taille (« Auto », « Remplir », px ou %),
  marges (« Partout » ou « Par côté »), icône, image, son… ;
- « Revenir à la valeur par défaut » efface un réglage ; « Aide » ouvre la fiche du composant ;
- en Junior, « Plus d’options » montre les réglages moins courants ;
- en bas, « Dupliquer le composant » et « Supprimer le composant ».

En Studio, **Maj + clic** choisit plusieurs composants : « Les réglages ci-dessous changent tous les
composants sélectionnés. »

#### 3.2.5 Le thème et la navigation de l’appli

Clique sur le fond de l’écran : l’inspecteur montre deux onglets, « Écran » et « Appli ». L’onglet
« Appli » règle le **« Thème de l’appli »** : « Thèmes tout prêts », « Couleur principale »,
« Couleur secondaire », « Fond », « Police », « Arrondis », « Clair ou sombre ». Les composants
prennent ces couleurs, sauf ceux que tu as réglés toi-même.
([capture](../screenshots/j2/theme-junior-light.png))

Il règle aussi la **« Navigation »** :

- « Pile » : « aller à l’écran » ouvre un écran par-dessus, le bouton retour revient ;
- « Onglets » : une barre d’onglets en bas de l’appli ;
- « Tiroir » : un menu qui s’ouvre sur le côté avec le bouton ☰.

Pour les onglets et le tiroir, choisis les « Écrans du menu », leur nom et leur icône. Raccourci :
la commande « Thème et navigation de l’appli ».

#### 3.2.6 Les écrans

Le **sélecteur d’écran** (barre du haut) liste les écrans ; l’étoile marque l’« Écran de
démarrage ». En bas de la liste : « Ajouter un écran ». Le bouton « … » à côté donne « Renommer
l’écran », « En faire l’écran de démarrage », « Dupliquer », « Monter », « Descendre » et
« Supprimer ». Une appli garde au moins un écran.

Quand l’appli tourne, on change d’écran avec les blocs « aller à l’écran … » et « revenir à l’écran
précédent » (catégorie Écrans), ou par les onglets et le tiroir.

#### 3.2.7 Les images et autres fichiers

À côté de « Calques », l’onglet « Images » liste les images du projet ; « Envoyer une image » en
ajoute une (8 Mo au plus). Les sons, vidéos et animations Lottie s’envoient depuis l’inspecteur du
composant qui s’en sert (« Envoyer un son », « Envoyer une vidéo », « Envoyer une animation Lottie
(.json) »). Une image peut aussi venir d’une adresse `https:`. Avec un compte, la taille maximale
d’un envoi et la place de chaque compte sont réglées par l’administrateur.

#### 3.2.8 Copier, coller, annuler

- **Copier, couper, coller** : Ctrl/Cmd + C, X, V. On peut coller dans un autre écran ou un autre
  projet ; les images suivent.
- **Dupliquer** : Ctrl/Cmd + D. **Supprimer** : Suppr.
- **Annuler** et **Rétablir** : Ctrl/Cmd + Z et Ctrl/Cmd + Maj + Z. Tout s’annule, dans tous les
  onglets. À plusieurs, chacun n’annule que ses propres changements.

### 3.3 L’onglet Blocs

C’est ici que tu dis à ton appli quoi faire : à gauche la boîte à outils, au centre l’espace de
travail, à droite l’aperçu en direct (et le code en Studio). Captures :
[Junior](../screenshots/j2/blocks-junior-light.png),
[Studio](../screenshots/j2/blocks-studio-light.png).

#### 3.3.1 La boîte à outils

La catégorie **Composants** donne les blocs des composants posés sur l’écran, rangés par composant :
leurs événements (« quand Bouton1 est cliqué »), leurs propriétés à lire ou à changer (« mettre
texte de Texte1 à … ») et leurs actions. Viennent ensuite les catégories générales : Contrôle,
Logique, Maths, Texte, Listes, Variables, Fonctions, Écrans, Interface, Débogage, Couleurs, Données,
Objets, et Appli.

Quelques blocs utiles : « quand l’appli démarre », « répéter indéfiniment », « attendre 1
seconde(s) », « afficher … dans la console », « afficher le message … », « message bref … »,
« réponse oui ou non à … », « réponse à la question … ». Le bloc « valeur … de l’événement » donne
ce qu’un événement apporte (l’élément touché, la nouvelle valeur…) ; il se pose dans le bloc
« quand … » qui fournit cette valeur.

Les listes commencent à **1**, comme dans Scratch.

#### 3.3.2 L’espace de travail

Glisse les blocs dans l’espace de travail et emboîte-les. Chaque écran a son espace de travail ; le
sélecteur d’écran choisit lequel tu modifies. Le clic droit sur un bloc donne son aide, les points
d’arrêt, dupliquer, supprimer et, si l’IA est activée, « Explique-moi ce bloc » ou « Explique-moi
cette pile ».

Renommer un composant met ses blocs à jour. Le supprimer laisse ses blocs, signalés : « Ce composant
n’existe plus. Choisis-en un autre ou supprime ce bloc. »

En Junior, la boîte à outils montre une sélection de blocs simples. L’interrupteur **« Plus de
blocs »**, au-dessus de l’espace de travail, les montre tous ; à côté, « Voir le code » affiche le
code.

#### 3.3.3 L’espace « Appli », les variables et les fonctions

Dans l’onglet Blocs, le sélecteur d’écran propose aussi « Appli (commun à tous les écrans) ». On y
met « quand l’appli démarre » (pour donner une valeur de départ aux variables) et les **fonctions de
l’appli**, que chaque écran lance avec « appeler la fonction » ou « résultat de la fonction »
(catégorie Appli). Une fonction créée dans un écran ne sert que dans cet écran. Les fonctions
acceptent des paramètres et peuvent rendre une valeur.

La catégorie Variables crée trois sortes de variables :

- « Créer une variable » : une variable de l’appli, « remises à zéro au démarrage » ;
- « Créer une variable stockée » : **gardée sur le téléphone**, même quand on ferme l’appli (un
  record, un réglage) ;
- « Créer une variable partagée » : **la même pour tous** ceux qui utilisent l’appli, gardée sur le
  serveur (il faut un compte, section 7).

#### 3.3.4 L’aperçu en direct et la console

L’**aperçu** fait tourner ton appli pour de vrai, à côté des blocs, et se met à jour à chaque
changement. Ses boutons : « Redémarrer l’appli », « Arrêter », et « Appli en sombre » / « Appli en
clair ». Une boucle sans fin ne fige ni l’appli ni l’éditeur : « Arrêter » arrête tout.

La **console**, en bas de l’éditeur, reçoit les messages de « afficher … dans la console », les
avertissements et les erreurs, écrites simplement (« La liste n’a que 3 élément(s), et ce bloc demande
le 5ᵉ. »). « Voir le bloc » montre le bloc fautif, « Effacer » vide la console. Si l’IA est activée,
la console a un bouton « Pourquoi ça ne marche pas ? ».

#### 3.3.5 La vue du code

En Studio, sous l’aperçu, la partie « Code » montre le JavaScript généré par tes blocs. Il se lit
mais ne se modifie pas ; « Copier le code » le copie. En Junior, active « Voir le code ».

#### 3.3.6 Le ralenti et les points d’arrêt

Le **ralenti** fait tourner l’appli doucement et allume chaque bloc pendant qu’il s’exécute.
([capture](../screenshots/j3/studio-light-slow-motion.png))

- Dans l’aperçu, clique sur « Activer le ralenti », puis règle la « Vitesse du ralenti » (« Plus
  lent », « Plus rapide »).
- **Point d’arrêt** : clic droit sur un bloc, « Ajouter un point d’arrêt ». L’appli se met « En
  pause sur un bloc » ; choisis « Continuer » ou « Bloc suivant ».
- « Retirer tous les points d’arrêt » les enlève. Ils ne sont pas enregistrés dans le projet.

#### 3.3.7 Le panneau d’aide

Le bouton « Aide » ouvre un panneau avec quatre onglets : « Blocs » (une fiche par bloc, avec un
exemple), « Composants » (une fiche par composant, avec « Ses blocs »), « Glossaire » (les mots de
la programmation expliqués simplement) et « Clavier » (3.6). « Chercher dans l’aide » cherche
partout ; le clic droit sur un bloc, puis « Aide sur ce bloc », ouvre sa fiche. En bas : « Tutoriels
et défis », « Revoir la visite guidée » et, en Junior, « Couper les sons ».
([capture](../screenshots/j3/junior-light-help.png))

### 3.4 L’onglet Données

L’onglet « Données » range les **tables**, les **connexions API**, les **secrets** et les
**variables partagées** de ton appli. Tout est expliqué dans la section 7.

### 3.5 La palette de commandes (Ctrl/Cmd + K)

Ctrl + K (Cmd + K sur Mac), ou la loupe, ouvre la « Palette de commandes » : « Que veux-tu
faire ? ». Tape quelques lettres, puis Entrée. Elle regroupe :

- **Éditeur** : « Aller à Design », « Aller à Blocs », « Annuler », « Rétablir », « Ajouter un
  écran », « Redémarrer l’appli », « Arrêter l’appli », « Afficher ou masquer la console », « Copier
  la sélection », « Couper la sélection », « Coller », « Thème et navigation de l’appli » ;
- **Ajouter un composant** : « Ajouter : Bouton », « Ajouter : Texte »… ;
- **Projet** : « Nouveau projet », « Aller au tableau de bord », « Ouvrir la démo de jeu : Attrape
  les fruits », « Ouvrir la démo de jeu : 50 lutins qui rebondissent » et, sur le tableau de bord,
  « Ouvrir l’appli de démonstration (tous les composants) » ;
- **Interface** : changer de mode, de thème et de langue.

### 3.6 Tout faire au clavier

« Tout Rublox se fait au clavier. Tab passe d’une zone à l’autre. » L’onglet « Clavier » de l’aide
donne la liste complète.

**Partout**

| Touche | Action |
|---|---|
| Ctrl/Cmd + K | Palette de commandes : toutes les actions |
| Ctrl/Cmd + Z | Annuler |
| Ctrl/Cmd + Maj + Z | Rétablir |
| Échap | Fermer un dialogue ou un menu |

**Design (palette et calques)**

| Touche | Action |
|---|---|
| Entrée | Dans la palette : ajouter le composant à l’écran |
| ↑ ↓ Début Fin | Dans les calques : passer d’un composant à l’autre |
| Espace, flèches, Entrée | Saisir un composant, le déplacer, le poser (Échap annule) |
| Alt + ↑ ↓ | Monter ou descendre le composant |
| F2 | Renommer |
| Suppr | Supprimer |
| Ctrl/Cmd + D | Dupliquer |
| Ctrl/Cmd + C, X, V | Copier, couper, coller |

**Blocs**

| Touche | Action |
|---|---|
| T | Aller à la boîte à outils |
| W | Aller à l’espace de travail |
| Flèches | Passer d’un bloc ou d’une catégorie à l’autre |
| Entrée | Poser le bloc choisi, ou modifier un champ |
| M | Déplacer le bloc (flèches, puis Entrée pour l’accrocher) |
| Maj + M | Déplacer toute la pile |
| Ctrl/Cmd + Entrée | Menu du bloc (aide, ralenti, supprimer…) |
| X | Détacher le bloc |
| D | Dupliquer le bloc |
| Suppr | Supprimer le bloc |
| N, B | Pile suivante, pile précédente |
| Début, Fin | Début ou fin du bloc |
| I | Dire ce qu’est le bloc (lecteur d’écran) |
| C | Ranger l’espace de travail |

Dans une scène de jeu, d’autres touches placent les lutins (10.2).

---

## 4. Apprendre

La page « Apprendre » réunit les tutoriels, les défis et les badges. Elle marche aussi en mode
invité. ([capture](../screenshots/j3/junior-light-learn.png))

### 4.1 Les tutoriels

Un tutoriel te guide pas à pas dans l’éditeur. Une bulle montre l’élément à utiliser (« Regarde
ici ») et chaque étape se valide toute seule quand l’action est faite : un bouton est posé, un bloc
existe, tu as cliqué dans l’aperçu… « Bien joué ! »

Pendant le tutoriel : « Un indice ? », « Mettre en pause », « Quitter le tutoriel ». Ta progression
est gardée : sur la page Apprendre, un tutoriel commencé propose « Reprendre », un tutoriel fini
« Refaire ».

| Junior | Studio |
|---|---|
| Mon premier bouton, Le dé magique, Le quiz | Deux écrans et une navigation, La météo, Carnet d’adresses, Carte de mes lieux, Tchat familial |

La météo et Tchat familial ont besoin d’un compte (un service sur Internet, des données partagées).

### 4.2 Les défis et les étoiles

Un défi donne un « Objectif » et un projet de départ. Rublox vérifie ton travail en direct et donne
jusqu’à **trois étoiles** : « Une étoile de plus ! », puis « Les trois étoiles ! Défi réussi. » Un
« Indice » aide si tu bloques. Défis fournis : Le compteur, Le compte à rebours, Pile ou face, Une
fonction qui sert deux fois.

### 4.3 Les badges

| Badge | Comment le gagner |
|---|---|
| Première appli | Ton appli réagit à quelque chose : un bouton, un écran qui s’ouvre… |
| Premier tutoriel | Tu as terminé un tutoriel. |
| Cinq tutoriels | Cinq tutoriels terminés. |
| Ça tourne en boucle | Tu as utilisé une boucle. |
| Mémoire d’éléphant | Tu as rangé une valeur dans une variable. |
| Fonction maison | Tu as écrit une fonction et tu l’as appelée. |
| Globe-trotteur | Ton appli passe d’un écran à l’autre. |
| Œil de lynx | Tu as regardé tes blocs au ralenti. |
| Chasseur de bugs | Ton appli s’est arrêtée sur un point d’arrêt. |
| Trois étoiles | Tu as eu les trois étoiles d’un défi. |
| Première publication | Ton appli est en ligne. |
| Premier remix | Tu as remixé l’appli de quelqu’un. |
| Attrape-étoiles, Casse-briques, Grand quiz, Tirelire décortiqués | Tu as fini les 4 niveaux de l’appli (4.5). |

Un nouveau badge s’annonce : « Nouveau badge : … ». En Studio, « Masquer les badges » les cache.

La progression est gardée **dans ce navigateur**, une par compte (et une pour le mode invité). Elle
ne suit pas encore sur un autre appareil.

### 4.4 L’aide et le glossaire

Chaque bloc et chaque composant a sa fiche avec un exemple, et le glossaire explique les mots de la
programmation : appli, écran, composant, propriété, évènement, bloc, variable, boucle, condition,
fonction, paramètre, liste, aperçu, console, ralenti, point d’arrêt, bug, code. Voir 3.3.7.

### 4.5 Les applis à décortiquer

Plus riches que les tutoriels, quatre vraies applis se démontent petit à petit, chacune en
**4 niveaux** : **Attrape-étoiles** et **Casse-briques** (des jeux), **Le grand quiz** et **Ma
tirelire** (un utilitaire). Chaque niveau est une appli complète, qui marche, et reprend le
précédent en y ajoutant quelques blocs. ([capture](../screenshots/j9/junior-light-learn.png))

- Sur la page Apprendre, choisis l’appli et son niveau, puis « **Ouvrir une copie** » : tu
  travailles toujours sur une copie, rangée dans tes projets (dans ce navigateur en mode invité) ;
  l’original ne change jamais. « Reprendre ma copie » rouvre la dernière.
- Les blocs sont rangés dans des **fonctions aux noms parlants** (« faire tomber une étoile »,
  « vérifier si c’est perdu ») et portent des **commentaires** : ceux des piles sont ouverts dans
  la marge, ceux des blocs du dedans s’ouvrent avec le « ? » du bloc.
- Une **visite guidée** (5 à 10 étapes) montre les piles une par une : la bulle s’accroche aux
  blocs, dit ce qu’ils font et pourquoi, puis propose de lancer le **ralenti** pour les voir
  s’allumer. ([capture](../screenshots/j9/studio-light-tour.png))
- Elle se termine par **3 défis de modification** (« Fais tomber l’étoile plus vite », « Donne 5
  vies au lieu de 3 »…), cochés tout seuls quand c’est fait, avec « Montrer le bloc » et « Un
  indice ? ». ([capture](../screenshots/j9/junior-light-challenges.png))
- Dès le niveau 2, « **Montre-moi ce qui est nouveau** » (« Nouveau » en Junior), au-dessus des
  blocs, allume ce que le niveau ajoute (en vert) ou modifie (en jaune) par rapport au niveau
  d’avant, et le liste dans un petit panneau. ([capture](../screenshots/j9/junior-dark-whats-new.png))

Un niveau est **terminé** quand sa visite est faite et ses défis réussis ; les 4 niveaux d’une appli
donnent son badge. Les blocs déjà présents dans une copie ne font pas gagner les badges de projet
(boucle, fonction…) : ce sont ceux que tu ajoutes qui comptent.

---

## 5. Comptes et espaces

### 5.1 L’invitation, seule façon d’entrer

Personne ne s’inscrit seul. Un compte se crée avec un **lien d’invitation** (donné par
l’administrateur ou par le responsable d’un espace), ou directement par l’administrateur, ou par le
responsable d’un espace pour un enfant ou un élève (5.4).

Le lien mène à « Bienvenue sur Rublox ». Remplis « Ton nom », « Identifiant » (lettres minuscules,
chiffres, « . », « _ » ou « - »), « Mot de passe » (8 caractères ou plus), « Confirme le mot de
passe » et, si tu veux, « E-mail (facultatif) ». Rublox n’envoie aucun e-mail. Puis « Créer mon
compte ». Un lien expiré, déjà servi ou annulé affiche « Cette invitation ne marche plus ».
([capture](../screenshots/j1/invite.png))

### 5.2 Le premier compte : l’administrateur

Au premier démarrage, Rublox crée un administrateur à partir des réglages du serveur (section 11),
seulement si la base n’a aucun compte. L’administrateur invite ensuite les autres.

### 5.3 Les espaces : famille, classe, équipe

Un **espace** regroupe des comptes, avec des **responsables** (parents, enseignants) et des
**membres**. Trois types :

- « Famille » : « Les parents créent les comptes des enfants. »
- « Classe » : « L’enseignant crée les comptes des élèves. »
- « Équipe » : « Des adultes qui travaillent ensemble. »

Pour en créer un : « Espaces », puis « Créer un espace », avec un « Type » et un « Nom de
l’espace ». Tu en deviens le « Créateur ». Un compte créé par un espace ne peut pas créer d’espace.

La page d’un espace a quatre onglets : « Membres », « Projets », « Invitations », « Réglages ».
([capture](../screenshots/j1/junior-light-space.png))

### 5.4 Les comptes d’enfants, sans e-mail

Dans « Membres », le responsable clique sur « Créer un compte » : « Pas besoin d’e-mail : tu choisis
l’identifiant et le mot de passe, et tu pourras le changer. » Le compte est prêt tout de suite ;
donne l’identifiant et le mot de passe à l’enfant. Ces comptes démarrent en Junior.

Pour un adulte qui a, ou aura, son propre compte : onglet « Invitations », « Créer une invitation »,
en choisissant le « Rôle dans l’espace ».

### 5.5 Ce que les responsables voient et font

Un responsable :

- voit en **lecture seule** les projets des membres (onglet « Projets », ou filtre « Mon espace » du
  tableau de bord) ;
- sur les comptes **créés par son espace** : « Changer le mot de passe », « Télécharger ses
  données », « Supprimer le compte » ;
- peut « Rendre responsable », « Rendre simple membre », « Retirer de l’espace » ;
- invite des adultes et règle les droits des membres (5.6).

Il n’agit pas sur le mot de passe ni sur les données d’un adulte venu avec son propre compte ; cet
adulte peut « Quitter l’espace ». Un espace garde au moins un responsable. Pour « Supprimer
l’espace », il faut d’abord supprimer les comptes créés dans cet espace ; les autres gardent leurs
comptes et leurs projets.

### 5.6 Les droits des membres

Onglet « Réglages », partie « Ce que les membres peuvent faire » : « Publier leurs applis »,
« Utiliser l’assistant IA » (si l’IA est installée), « Partager dans la galerie ».

Par défaut, publier est permis dans une famille et une équipe, pas dans une classe ; l’IA et la
galerie sont décochées. Ces droits ne visent que les membres. Un membre de plusieurs espaces suit
**la règle la plus stricte** : il faut que tous ses espaces l’autorisent.

### 5.7 Le profil et l’avatar

Clique sur ton avatar en haut à droite, puis « Mon compte ». La partie « Profil » contient ton « Nom
affiché », ton « Identifiant », ton « E-mail » (facultatif) et ton « Avatar » : douze personnages
dessinés pour Rublox (Bloc bleu, Bloc corail, Bloc menthe, Bloc soleil, Chat, Renard, Ours, Lapin,
Grenouille, Robot, Extra-terrestre, Astronaute). Pas de photo. La partie « Préférences » règle le
mode, le thème et la langue. ([capture](../screenshots/j1/junior-light-account.png))

### 5.8 Mot de passe, appareils, passkeys

Dans « Mon compte », partie « Sécurité » :

- « Changer de mot de passe » : tes autres appareils sont déconnectés. Le mot de passe d’un compte
  créé par un espace est géré par son responsable ;
- « Passkeys » : « Ajouter une passkey » pour te connecter sans mot de passe, avec ton empreinte ou
  ton visage ;
- « Appareils connectés » : « Déconnecter » un appareil que tu ne reconnais pas, ou « Déconnecter
  les autres appareils ».

### 5.9 Mes données : export et suppression

Dans « Mon compte », partie « Mes données » :

- « Télécharger mes données » : un fichier avec tout ce que Rublox garde sur toi (profil, espaces,
  appareils, noms des passkeys, projets et versions, fichiers, partages, favoris), sans mot de passe
  ni secret ;
- « Supprimer mon compte » : ton compte, tes projets, leurs versions et leurs fichiers sont effacés
  pour toujours. Tape ton mot de passe pour confirmer.

La suppression est refusée à un compte créé par un espace (« Le responsable de ton espace peut
télécharger tes données ou supprimer ton compte. »), au dernier administrateur, et au dernier
responsable d’un espace qui a encore des membres.

### 5.10 L’historique des versions

Avec un compte, le projet est sur le serveur, et « Une version est gardée toutes les 10 minutes de
travail. Restaurer ne détruit rien. » Dans la barre du haut, « Historique » :

- « Nom de la version » puis « Garder cette version » pour en nommer une (« avant le niveau 2 ») ;
- « Restaurer » : ton projet actuel est d’abord gardé dans l’historique, tu pourras y revenir.

Les projets invités n’ont pas d’historique.

### 5.11 Partager un projet avec un autre compte

Clique sur « Partager ». Seul le propriétaire partage. Tape l’« Identifiant » de l’autre compte,
choisis les « Droits » (« Peut voir » ou « Peut modifier »), puis « Partager ». Pour chaque
personne, tu peux changer ses droits ou la retirer.

Le projet apparaît chez elle dans « Partagés avec moi ». Avec « Peut voir », elle l’ouvre en lecture
seule : un bandeau le dit, elle peut essayer sans rien enregistrer, et « En faire une copie ». Elle
peut aussi choisir « Ne plus suivre ce projet ».

Le même dialogue sert au partage dans la galerie (section 8).

### 5.12 Donner un projet

Dans « Partager », menu d’une personne : « Lui donner le projet ». « Tu deviendras simple
éditeur : … pourra te retirer. » Le nouveau propriétaire n’hérite pas de tes choix : l’IA de
l’appli publiée est de nouveau coupée, et le projet sort de la galerie, jusqu’à ce qu’il décide
autrement.

### 5.13 Travailler à plusieurs en même temps

Plusieurs comptes peuvent modifier un projet en même temps ; tout se fusionne.
([capture](../screenshots/j4b/studio-light-presence.png))

- **Qui est là** : les avatars des autres, chacun de sa couleur, dans la barre du haut. Clique
  dessus : « Dans le projet en ce moment » montre l’onglet et l’écran de chacun, avec « Aller
  voir ». Quelqu’un qui ne peut que lire porte « Regarde seulement ».
- **Ce que font les autres** : le composant ou la pile de blocs qu’ils ont choisi s’entoure de leur
  couleur.
- **Conflit** : les blocs se synchronisent par pile. Si deux personnes changent la même pile en même
  temps, la dernière enregistrée gagne, et l’autre est prévenue : « Pile modifiée par … », avec
  « Montrer ».
- **Annuler** n’annule que tes propres changements.
- **Hors ligne** : continue à travailler ; tes changements partent au retour de la connexion et se
  fusionnent avec ceux des autres. Un projet déjà ouvert sur cet appareil se rouvre même sans
  réseau.

---

## 6. Publier et tester sur téléphone

Tester et publier passent par le serveur : il faut un compte.

### 6.1 Tester sur ton téléphone

Clique sur « Tester ». « Scanne ce QR code avec l’appareil photo de ton téléphone : ton appli
s’ouvre et suit chacune de tes modifications. » ([capture](../screenshots/j4/junior-light-live.png))

- Le lien est valable **8 heures** (« Valable jusqu’à … ») ; « Copier le lien » pour l’envoyer
  autrement.
- Le dialogue montre l’état (« En direct »…) et le nombre de téléphones connectés.
- La « Console du téléphone » reçoit les messages de « afficher … dans la console » et les erreurs
  du téléphone ; ils arrivent aussi dans la console de l’éditeur, avec une pastille.
- « Nouveau lien » : l’ancien s’arrête et les téléphones sont déconnectés (un seul lien actif par
  personne et par projet). « Arrêter le test » coupe le lien.

Dialogue fermé, la pastille « Test en direct : … » de la barre du haut le rouvre. Le téléphone doit
pouvoir joindre le serveur Rublox : une adresse comme `localhost` ne marche que sur l’ordinateur, et
le dialogue le signale.

### 6.2 Publier

Clique sur « Publier ». « Chaque publication est une version figée : tes modifications suivantes n’y
changent rien tant que tu ne publies pas à nouveau. » Trois onglets :

**« Réglages »**

- « Nom de l’appli » : affiché sous l’icône, sur l’écran d’accueil ;
- « Adresse » : 3 à 40 caractères (lettres minuscules, chiffres, tirets), par exemple `mon-de`, ce
  qui donne une adresse comme `https://apps.example.com/a/mon-de/`. **Elle ne changera plus**, même
  avec de nouvelles versions, même si tu dépublies ;
- « Description » (facultatif) ;
- « Icône » : un « Émoji » sur une « Couleur de fond de l’icône », ou une « Image du projet » ;
- « Couleur du thème » (la barre du téléphone) et « Couleur de démarrage » (le fond pendant
  l’ouverture) ;
- si l’appli utilise le composant IA : « Autoriser l’IA dans l’appli publiée » (9.5).

Puis « Publier » (ou « Publier une nouvelle version ») : « C’est en ligne ! »

**« Partager »** : l’adresse (« Copier l’adresse », « Ouvrir l’appli »), le QR code, « Imprimer le
QR code » et « Comment l’installer ? ».
([capture](../screenshots/j4/junior-light-publish-share.png))

**« Versions »** : « Remettre en ligne » une ancienne version, ou « Dépublier » : l’adresse
affichera « Cette appli n’est plus publiée ». Les versions sont gardées. Un projet mis à la
corbeille n’est plus en ligne non plus.

Publient le propriétaire et les comptes qui peuvent modifier le projet, sauf un membre d’un espace
où « Publier leurs applis » est décoché : « Ton espace ne permet pas encore de publier : demande à
ton responsable. »

### 6.3 Installer l’appli sur un téléphone

Ouvre l’adresse de l’appli sur le téléphone, ou scanne son QR code. Le bouton « Installer » explique
comment faire.

- **Sur iPhone ou iPad** : ouvre la page dans Safari, touche le bouton Partager (le carré avec une
  flèche vers le haut), puis « Sur l’écran d’accueil » et « Ajouter ».
- **Sur Android** : ouvre la page dans Chrome, touche le menu ⋮ en haut à droite, puis « Installer
  l’appli » (ou « Ajouter à l’écran d’accueil »).
- **Sur un ordinateur** : dans Chrome ou Edge, clique sur l’icône d’installation dans la barre
  d’adresse.

### 6.4 Sans Internet, et les mises à jour

Une appli publiée marche **hors ligne** une fois ouverte une première fois avec Internet (avant :
« Connecte-toi à Internet une première fois pour ouvrir cette appli. »). La carte, les connexions
API, les données partagées et l’IA ont besoin d’Internet.

Pour une nouvelle version : « Publier une nouvelle version ». L’adresse ne change pas, et un
téléphone qui ouvre l’appli avec Internet reçoit tout de suite la nouvelle version.

Les variables stockées et les tables « dans l’appli » restent sur le téléphone ; l’appli publiée, le
test sur téléphone et le site exporté gardent chacun les leurs. Les notifications locales ne
s’affichent que pendant que l’appli est ouverte ; sur Android il faut l’appli publiée, sur iPhone
l’appli installée sur l’écran d’accueil.

### 6.5 Exporter et importer

Menu « Projet » de la barre du haut :

- « Exporter le projet (.rublox) » : « Un fichier à garder ou à importer dans un autre Rublox. » Il
  contient le projet et ses fichiers, mais ni les secrets ni les lignes des tables partagées ;
- « Exporter en site web (.zip) » : « Un site statique à héberger où tu veux. » Copie tout le
  dossier chez un hébergeur de pages statiques (en HTTPS pour l’installer sur un téléphone). Ce site
  ne marche pas hors ligne et n’a ni données partagées ni IA ; une connexion API sans secret y est
  appelée directement par le navigateur, si le service l’accepte.

Pour **importer** un `.rublox` : bouton « Importer » du tableau de bord. Un fichier d’une version
plus récente est refusé : « Ce projet vient d’une version plus récente de Rublox : mets Rublox à
jour. »

---

## 7. Données

Dans l’onglet « Données », la colonne de gauche liste « Tables », « Connexions API », « Secrets » et
« Variables partagées ». Un projet sans données propose « Créer une table » et « Créer une connexion
API ».

### 7.1 Les tables

Une table range des informations en lignes et en colonnes, comme un tableur : des contacts, des
scores, des lieux. « Nouvelle table » en crée une.
([capture](../screenshots/j5/studio-light-table.png))

- **Colonnes** : « Ajouter une colonne », avec un nom et un « Type » : « Texte », « Nombre »,
  « Oui/non », « Date », « Image », « Lien ». Le menu d’une colonne la renomme, change son type, la
  déplace ou la supprime.
- **Lignes** : « Ajouter une ligne », ou supprimer une ligne.
- **CSV** : « Importer un CSV » (la première ligne donne les noms des colonnes ; « Remplacer les
  lignes » ou « Ajouter à la suite ») et « Exporter en CSV ».

**« Où vivent les lignes »** :

- « Dans l’appli » : les lignes sont livrées avec l’appli ; chaque téléphone garde ses propres
  changements. Si tu modifies ensuite les lignes dans l’onglet Données, les téléphones repartent de
  tes nouvelles lignes.
- « Partagée » : les lignes sont sur le serveur, communes à tous ceux qui utilisent l’appli (un
  tchat, des scores). « L’appli peut » : « seulement lire » ou « lire et modifier ». L’aperçu, le
  test sur téléphone et l’appli publiée voient les mêmes lignes. Il faut un compte.

Les blocs de table sont dans la catégorie Données : « lignes de la table … », « lignes de … où … »,
« nombre de lignes de … », « trier … par … », « … de la ligne … », « ajouter une ligne à … »,
« dans …, mettre … de la ligne … à … », « supprimer de … la ligne … », « vider la table … », « quand
la table … change ».

**Brancher un composant sur une table** : une Liste de données, une Grille de données, une Carte ou
un Graphique choisit sa « Table » dans l’inspecteur, puis la colonne de chaque champ (image, titre,
sous-titre, latitude, valeur…). Le canevas montre alors les vraies lignes.

### 7.2 Les connexions API

Une connexion API va chercher des informations sur Internet : la météo, des films, des citations.
« Nouvelle connexion », puis l’« Adresse de base » (par exemple `https://api.open-meteo.com`, chaque
appel y ajoute un chemin), les « En-têtes » et les « Paramètres envoyés à chaque appel ».
([capture](../screenshots/j5/studio-light-api.png))

**« Essayer »** appelle la connexion avec une « Méthode » et un « Chemin » (par exemple
`/v1/forecast`). La « Réponse » s’affiche **en arbre** : « Clique sur un champ pour créer le bloc
qui le lit. » Le bloc est ajouté à l’écran ; « Voir le bloc » y mène.

Dans la catégorie Données, « réponse de … » attend la réponse, « appeler … » envoie sans l’attendre.
Une réponse JSON devient un **objet** : la catégorie Objets lit un champ (« … de … », avec un chemin
comme `current.temperature_2m`), crée des objets (« nouvel objet », « … avec … = … ») et convertit
du texte JSON.

Les appels passent par le serveur Rublox, qui refuse les adresses de réseaux privés. Limites : 10
secondes, 2 Mo de réponse, 120 appels par minute et par projet.

### 7.3 Les secrets

Une clé d’API ne doit jamais être visible dans l’appli. Dans « Secrets », donne un « Nom » (par
exemple `METEO_KEY`) et une « Valeur », puis « Ajouter le secret ». Dans une connexion, écris
`{{secret:METEO_KEY}}` à la place de la clé (ou « Insérer un secret »). « Les clés d’API restent sur
le serveur, chiffrées. Ni le projet, ni l’appli publiée ne les contiennent : le serveur les ajoute à
chaque appel. » On ne voit que leur nom. Au plus 30 secrets par projet.

### 7.4 Variables stockées et partagées

Une **variable stockée** reste sur le téléphone. Une **variable partagée** a la même valeur pour
tous ceux qui utilisent l’appli ; elle se crée dans l’onglet Blocs, catégorie Variables, et le bloc
« quand la variable partagée … change » réagit dès que quelqu’un la change, sur n’importe quel
appareil. Dans l’onglet Données, « Variables partagées » montre la « Valeur actuelle » de chacune et
permet de la remettre à sa valeur de départ.

### 7.5 Cartes et graphiques

- La **Carte** se déplace et s’agrandit, avec des repères (latitude, longitude, titre) posés dans
  l’inspecteur, par des blocs ou depuis une table. Les fonds de carte viennent d’OpenFreeMap
  (données © OpenStreetMap) : il faut Internet. Sur le canevas, la carte est une esquisse ; la vraie
  s’affiche dans l’aperçu et sur le téléphone.
- Le **Graphique** dessine des « Barres », une « Courbe » ou des « Secteurs », à partir de ses
  propres points ou d’une table.
- La **Feuille Google** (Studio) lit une feuille Google publiée en CSV.

### 7.6 Les limites

- **Projet invité** : seules les tables « dans l’appli » marchent. Les blocs d’API demandent de se
  connecter, une table partagée ne vit qu’en mémoire (avec un avertissement), pas de secrets ni
  d’« Essayer ».
- **Site exporté** : pas de données partagées ; les connexions sans secret sont appelées directement
  par le navigateur.
- **Copies** : les lignes d’une table partagée et les secrets ne suivent ni « Dupliquer » ni un
  fichier `.rublox`.
- **Données partagées** : 16 Ko par valeur ou par ligne, 5 000 lignes par table. Une appli qui écrit
  trop vite est freinée (« L’appli écrit trop vite dans les données partagées : ralentis un peu. »).
- « Essayer » et la modification des secrets demandent le droit de modifier le projet.

---

## 8. Galerie et remix

La **galerie** montre les applis partagées par les comptes de cette instance. Elle est réservée aux
comptes connectés ; l’administrateur peut l’éteindre.
([capture](../screenshots/j6/junior-light-gallery.png))

### 8.1 Parcourir et essayer

Ouvre « Galerie ». Tu peux « Chercher une appli ou une personne », trier par « Récentes » ou
« Populaires », filtrer par « Mode » (« Toutes », « Junior », « Studio »). Sur une appli :

- « Essayer » : l’appli tourne pour de vrai dans un téléphone. Une appli pas encore publiée montre
  sa miniature et s’essaie par « Voir les blocs » ;
- « Voir les blocs » : l’éditeur en lecture seule, avec l’aperçu ;
- « J’aime » / « Je n’aime plus » ;
- « Arbre des remix » : d’où vient l’appli, et qui l’a remixée.

### 8.2 Remixer

« Remixer » copie l’appli dans tes projets (« … (remix) »). Ta carte garde le crédit : « Remix de …
par … ». Ton premier remix te vaut le badge « Premier remix ».

### 8.3 Partager dans la galerie

Dans ton projet, « Partager », puis active « Partager dans la galerie » : « Montre ton appli à toute
l’instance : chacun pourra l’essayer, voir ses blocs et la remixer. » Désactive-le pour la retirer.
Seul le propriétaire peut le faire ; un membre d’un espace qui ne l’autorise pas voit « Ton espace
ne permet pas encore de partager dans la galerie : demande à ton responsable. » Publie aussi l’appli
(section 6) pour qu’on puisse l’« Essayer » directement.

L’administrateur peut « Retirer de la galerie » un projet : il reste chez son propriétaire, mais ne
peut plus y être partagé.

---

## 9. Assistant IA

L’assistant n’existe que si l’administrateur l’a installé avec une clé et l’a activé. Sinon, **aucun
bouton d’IA n’apparaît**, nulle part : c’est normal. L’assistant s’appuie sur Claude, d’Anthropic.
Il peut se tromper : vérifie toujours dans l’aperçu.

### 9.1 Qui y a droit

- L’administrateur l’active et fixe un nombre de questions par compte et par jour.
- Un membre d’un espace n’y a droit que si tous ses espaces cochent « Utiliser l’assistant IA » ; un
  compte sans espace y a droit dès que l’instance l’active.
- Pas d’IA en mode invité.

Le panneau de l’assistant affiche « Encore … question(s) aujourd’hui. » Le compteur repart chaque
jour. Épuisé : « Tu as posé toutes tes questions à l’IA pour aujourd’hui. Reviens demain ! »

### 9.2 Créer avec l’IA

Sur le tableau de bord, « Créer avec l’IA ». Décris ton idée (« Une appli qui tire au sort qui fait
la vaisselle »), puis « Proposer une appli ». Ça peut prendre jusqu’à une minute.

La **proposition** montre les écrans en miniature, un résumé, et le nombre d’écrans, de composants
et de blocs. Choisis « Garder cette appli » (un nouveau projet est créé ; le message « Appli créée
dans tes projets. » a un bouton « Annuler » qui le supprime), « Refuser » ou « Changer ma demande ».
L’IA crée toujours un **nouveau** projet ; elle n’ajoute pas d’écrans à un projet ouvert.
([capture](../screenshots/j6/junior-light-ai-proposal.png))

### 9.3 Explique-moi

Clic droit sur un bloc : « Explique-moi ce bloc » ou « Explique-moi cette pile ». Au-dessus de
l’espace de travail : « Explique-moi cet écran ». Les mots sont adaptés au mode, Junior ou Studio.

### 9.4 Pourquoi ça ne marche pas ?

Dans la console, « Pourquoi ça ne marche pas ? » : « L’assistant lit la console et les blocs de cet
écran. » Écris si tu veux « Ce que tu attendais (facultatif) », puis « Chercher le problème ».
« Montrer le bloc » mène au bloc en cause.

### 9.5 Le composant IA

En Studio, le composant **IA** (catégorie Données) ajoute à ton appli deux blocs : « réponse de …
à … » (écrire un texte) et « description par … de l’image … » (décrire une photo). Ses « consignes »
s’ajoutent à chaque demande. S’il n’est pas disponible, il répond un texte vide et déclenche « a un
problème ».

**Qui paie les questions :**

- dans l’aperçu et le test sur téléphone : **la personne qui teste**, sur son quota ;
- dans l’appli publiée : **le propriétaire du projet**, sur son quota, **seulement** s’il a activé
  « Autoriser l’IA dans l’appli publiée » dans « Publier » ; sinon l’IA n’y marche pas ;
- un site exporté n’a pas d’IA.

### 9.6 Ce qui est gardé

Un journal note qui a demandé, pour quel usage, avec quel modèle, combien de jetons, et le résultat.
**Le contenu des questions et des réponses n’est jamais gardé.** Les consignes de l’assistant sont
adaptées aux enfants.

---

## 10. Mode jeu

Rublox fait aussi des petits jeux : des personnages qui bougent, tombent, rebondissent et se
touchent. ([capture](../screenshots/j7/junior-light-design.png))

### 10.1 La scène de jeu

Catégorie Jeu de la palette : pose une **Scène de jeu**. C’est un terrain de taille fixe (360 × 640
par défaut), agrandi ou réduit pour remplir sa place. Le jeu tourne à 60 images par seconde et se
met en pause quand l’appli est cachée. Une scène n’accepte que des lutins, des textes de scène et
des joysticks, qui ne vont que dans une scène.

Les coordonnées partent du coin en haut à gauche : x vers la droite, y **vers le bas** ; le x et le
y d’un lutin donnent la place de son centre. La rotation est en degrés, dans le sens des aiguilles
d’une montre.

Réglages : taille de la scène, « image de fond », « bords » (« Arrêtent », « Font rebondir »,
« Laissent sortir »). Blocs : « quand … démarre », « à chaque image de … », « quand on touche … »,
« mettre … en pause », « relancer … », « supprimer tous les clones de … ».

### 10.2 Les lutins et leurs costumes

Un **Lutin** est une image ou un émoji dans la scène. Place-le en le glissant sur le canevas, ou au
clavier : « Flèches : déplacer. Alt + flèches : taille. R ou Maj + R : tourner. Échap :
désélectionner. »

Ses **costumes** sont ses différentes images : dans l’inspecteur, « Costumes », « Ajouter un
costume » avec un « Émoji ou lettre » ou une image du projet. Le « numéro du costume » commence à
1 ; « costume suivant pour … » passe au suivant.

Pour le faire bouger : « avancer … de … pas », « déplacer … de x … y … », « mettre … à x … y … »,
« faire glisser … vers x … y … en … s », « tourner … de … degrés », « orienter … vers … ».

### 10.3 Physique, collisions et bords

- « vitesse x », « vitesse y », « gravité » (le lutin tombe), « rebond (%) », « se glisse au
  doigt » ;
- « solide » : deux lutins solides se repoussent et rebondissent ;
- « forme des collisions » : « Boîte », « Cercle » ou « Aucune ». Un lutin caché ne touche rien ;
- « quand … touche … » : « quand Pomme touche Panier », ou « quand Pomme touche le bord du bas ». Il
  se déclenche au début du contact. « … touche … » et « distance de … à … » se posent dans un
  « si » ;
- « bords » d’un lutin : « Comme la scène » (par défaut), « Arrêtent », « Font rebondir »,
  « Laissent sortir ».

### 10.4 Les clones

« créer un clone de … » fait apparaître une copie du lutin, et « quand … apparaît comme clone »
s’exécute pour chacune. Dans les blocs « quand … », le nom du lutin désigne le clone concerné : les
mêmes blocs pilotent l’original et chaque clone. Un clone qui sort de la scène disparaît tout seul ;
au plus 300 clones par scène.

### 10.5 Joystick et texte de scène

Le **Joystick** se pilote au doigt ; sa direction va de -1 à 1 (« direction x » vers la droite,
« direction y » vers le bas) : multiplie-la par une vitesse pour faire avancer un lutin. Le **Texte
de scène** affiche un texte, un score par exemple, dans la scène. Pour les sons, utilise le
composant Son.

### 10.6 La démo « Attrape les fruits »

Ouvre la palette de commandes (Ctrl/Cmd + K) et choisis « Ouvrir la démo de jeu : Attrape les
fruits ». Un jeu complet est créé, fait uniquement de blocs : joue, regarde ses blocs, modifie-le.
Le modèle « Attrape l’étoile » est un autre point de départ.

---

## 11. Pour l’administrateur

### 11.1 Installer Rublox

L’installation est décrite dans le [README](../../README.md#self-hosting) (partie
« Self-hosting », avec toutes les variables d’environnement) et dans l’exemple
[`docker/compose.yaml`](../../docker/compose.yaml). À retenir :

- l’administrateur est créé au premier démarrage avec `RUBLOX_ADMIN_USERNAME` et
  `RUBLOX_ADMIN_PASSWORD`, seulement si la base n’a aucun compte ;
- `RUBLOX_SECRET` est obligatoire en production (32 octets au moins) : le serveur refuse de démarrer
  sans, ou avec la valeur d’exemple ;
- l’assistant IA demande une clé `ANTHROPIC_API_KEY` sur le serveur, puis son activation dans les
  réglages.

### 11.2 Les pages d’administration

Le lien « Administration » n’apparaît qu’aux administrateurs. Quatre onglets :
([capture](../screenshots/j1/studio-light-admin.png))

**« Comptes »** : la liste (« Chercher un compte ») avec rôle, espaces, stockage, dernière
connexion ; « Créer un compte ». Pour chaque compte : « Rendre administrateur » ou « Retirer le rôle
d’administrateur », « Désactiver » ou « Réactiver », « Changer le mot de passe », « Supprimer le
compte ». Il faut garder au moins un administrateur.

**« Invitations »** : « Créer une invitation » avec une note (« Pour qui ? »), le type de compte
(« Utilisateur » ou « Administrateur »), un espace et le rôle dans cet espace, le « Nombre
d’utilisations » et l’expiration (« Dans 1 jour », « Dans 7 jours », « Dans 30 jours », « Jamais »).
**Copie le lien tout de suite : il ne sera plus affiché.** La liste montre l’état (« Active »,
« Utilisée », « Expirée », « Annulée ») et qui l’a utilisée ; « Annuler l’invitation » la révoque.

**« Espaces »** : la vue d’ensemble des espaces et de leurs responsables.

**« Réglages »** : « Nom de l’instance », « Galerie activée », « Assistant IA activé » et
« Questions à l’IA par compte et par jour » (si une clé est installée), « Taille maximale d’un envoi
(Mo) », « Stockage par compte (Mo) ». La page montre aussi l’« Espace disque » utilisé et, avec
l’IA, le « Journal de l’IA » : les 200 dernières questions, sans leur contenu.

---

## 12. Questions fréquentes

**Où sont mes projets du mode invité ?** Dans le navigateur où tu les as créés, sur cet appareil :
pas ailleurs. Connecte-toi dans ce même navigateur et choisis « Ranger dans mon compte ». Tu peux
aussi les exporter en `.rublox`.

**J’ai oublié mon mot de passe.** Rublox n’envoie pas d’e-mail. Si ton compte a été créé par un
espace, demande à ton responsable de « Changer le mot de passe » ; sinon, demande à
l’administrateur. Avec une passkey, tu peux encore entrer par « Utiliser une passkey ».

**La carte affiche « La carte ne peut pas s’afficher ici ».** La carte a besoin d’Internet et d’un
navigateur qui sait afficher de la 3D (WebGL). Sur certains réseaux (école, entreprise), le service
des fonds de carte peut être bloqué : la carte ne s’affiche pas, le reste de l’appli marche.

**Un capteur ou le vibreur ne marche pas sur iPhone.** Les navigateurs ne savent pas tous tout
faire : l’iPhone n’a pas de vibreur pour les pages web (« Ce navigateur ne sait pas faire ça :
Vibreur »), ne donne pas le niveau de la batterie, et demande l’autorisation pour les mouvements.
Chacun de ces composants a une propriété « disponible » à tester dans un « si ». La liste complète
est dans [docs/compatibilite.md](../compatibilite.md).

**« Tu as refusé l’accès à … »** Tu as dit non à la caméra, au micro ou à la position. Autorise
l’accès dans les réglages du navigateur pour ce site, puis réessaie.

**« Tester », « Partager » et « Publier » sont grisés.** Tu es en mode invité : connecte-toi.

**« Ton espace ne permet pas encore de publier ».** Ton responsable n’a pas coché « Publier leurs
applis » dans les réglages de ton espace. Demande-lui.

**Je ne vois aucun bouton d’IA.** L’assistant n’est pas installé ou pas activé, ou ton espace ne
l’autorise pas.

**Le téléphone n’ouvre pas le lien de test.** Le téléphone doit joindre le serveur Rublox : une
adresse comme `localhost` ne marche que sur l’ordinateur. Le lien dure 8 heures ; s’il a expiré,
demande un « Nouveau lien ».

**Mon appli tourne en boucle et rien ne répond.** Clique sur « Arrêter » dans l’aperçu. Une boucle
sans fin ne fige jamais l’éditeur.

**J’ai supprimé un projet, ou cassé mon projet.** Un projet supprimé reste 30 jours dans la
« Corbeille » : « Restaurer » le fait revenir. Pour une erreur dans un projet : « Annuler »
(Ctrl/Cmd + Z) et, avec un compte, « Historique » pour « Restaurer » une version plus ancienne.

**L’éditeur dit « L’éditeur a besoin d’un écran plus grand ».** L’éditeur vise l’ordinateur et la
tablette en paysage. Sur téléphone, scanne le QR code affiché pour continuer sur un ordinateur ; le
tableau de bord, la galerie, la page Apprendre et les applis publiées marchent sur téléphone.
