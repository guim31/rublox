# Compatibilité des composants sur téléphone

Le J2 n'a pas pu être essayé sur de vrais téléphones depuis la session de code : cette liste est
à dérouler par Guilhem sur **Android (Chrome)** et **iPhone (Safari)**, puis à remplir. Elle
sert aussi de référence aux fiches d'aide : ce qui ne marche pas quelque part doit y être dit.

## Préparer l'essai

1. Mettre Rublox en ligne (HTTPS obligatoire : caméra, micro, position et capteurs ne marchent
   pas en HTTP, sauf sur `localhost`).
2. Dans le studio, tableau de bord, **Ctrl/Cmd + K** puis « Ouvrir l'appli de démonstration » :
   un projet « Démo du catalogue » est créé. Il utilise chaque composant, avec des blocs.
3. Ouvrir l'aperçu sur le téléphone. Tant que « Tester sur mon téléphone » (J4) n'existe pas :
   ouvrir le studio sur le téléphone en mode paysage, ou une tablette, onglet **Blocs**, l'aperçu
   est à droite. Refaire l'essai avec le QR code du J4 quand il existera, puis avec l'appli
   publiée installée sur l'écran d'accueil (certaines fonctions d'iOS l'exigent).
4. Pour chaque ligne : ✅ marche, ⚠️ marche avec une réserve (la noter), ❌ ne marche pas (noter
   le message affiché). L'événement « a un problème » de chaque composant affiche son message
   dans l'appli : le recopier.

Légende de la colonne « attendu » : ce que le code prévoit, d'après les navigateurs en 2026.

## Écran « Accueil »

| Vérification | Attendu | Android | iPhone |
|---|---|---|---|
| Boîte, texte riche (titre, gras, liste), icônes, séparateur, grille de boutons | affichés | | |
| « Encore » remplit la barre de progression, « Zéro » la vide | oui | | |
| « Coucou » affiche « Bonjour Rublox » (fonction partagée de l'espace Appli) | oui | | |
| L'étoile affiche un message bref ; le cœur grossit | oui | | |
| « Visites sur ce téléphone » augmente à chaque ouverture de l'appli (variable stockée) | oui, gardé après fermeture | | |
| Le QR code se lit avec un autre téléphone (https://example.com) | oui | | |
| Barre d'onglets en bas : les 5 onglets, chacun garde son état quand on revient | oui | | |

## Écran « Saisie »

| Vérification | Attendu | Android | iPhone |
|---|---|---|---|
| Champ de texte : le clavier s'ouvre, « Résultat » suit la saisie | oui | | |
| Case à cocher, interrupteur : « Résultat » donne vrai ou faux | oui | | |
| Curseur : glisser au doigt, la valeur suit | oui | | |
| Liste déroulante : le sélecteur natif s'ouvre | oui | | |
| Choix de date et d'heure : le calendrier et l'horloge du téléphone s'ouvrent | oui | | |
| Note en étoiles : toucher une étoile change la note | oui | | |

## Écran « Listes »

| Vérification | Attendu | Android | iPhone |
|---|---|---|---|
| Liste simple : toucher « Mardi » affiche « 2 · Mardi » | oui | | |
| « Ajouter » ajoute le texte du champ à la liste, puis vide le champ | oui | | |
| Liste de données : toucher une fiche, puis son bouton « Voir » | deux messages différents | | |
| Grille de données : toucher une vignette | oui | | |
| Défilement de l'écran quand la liste dépasse | oui | | |

## Écran « Medias »

| Vérification | Attendu | Android | iPhone |
|---|---|---|---|
| Vidéo : envoyer une vidéo MP4 dans l'inspecteur, la lire avec ses boutons | oui | | |
| Vidéo en lecture automatique : seulement si « muette » est coché | iPhone : muette obligatoire | | |
| Animation Lottie : envoyer un fichier `.json`, elle tourne en boucle | oui | | |
| Page web : example.com s'affiche ; un site qui refuse les cadres reste blanc | oui | | |
| « Allumer la caméra » : l'autorisation est demandée la première fois | oui | | |
| Refuser la caméra : un message clair s'affiche (« Tu as refusé l'accès à : la caméra… ») | oui | | |
| « Photo » : l'image de la caméra apparaît dessous | oui | | |
| Zone de dessin : dessiner au doigt ; un toucher ajoute un rond ; « Effacer » vide | oui, sans faire défiler l'écran | | |

## Écran « Appareil » (composants invisibles)

| Vérification | Attendu | Android | iPhone |
|---|---|---|---|
| Minuteur : « Le minuteur a sonné » augmente toutes les 5 secondes | oui | | |
| « Parler » : le téléphone lit la phrase | oui (iPhone : le mode silencieux peut couper le son) | | |
| « Écouter » : demande le micro, puis écrit la phrase entendue | Chrome Android : oui ; Safari : oui depuis iOS 14.5, en ligne | | |
| « Vibrer » | Android : oui ; iPhone : ❌ attendu, message « Ce navigateur ne sait pas faire ça : Vibreur » | | |
| « Prendre une photo » : l'appareil photo du téléphone s'ouvre, la photo s'affiche | oui ; annuler ne montre rien | | |
| « Choisir une photo » : la galerie s'ouvre | oui | | |
| « Partager » : la fenêtre de partage du téléphone s'ouvre | oui ; la fermer n'affiche pas d'erreur | | |
| « Copier » : copie puis relit le presse-papiers | copie : oui ; lecture : demande une autorisation (Android) ou affiche « Coller » (iPhone) | | |
| « Notifier » : l'autorisation est demandée, la notification s'affiche | Android : seulement avec un service worker (appli publiée, J4) ; iPhone : seulement installée sur l'écran d'accueil | | |
| « Scanner un QR code » : caméra plein écran, lit un QR code, « Annuler » ferme | oui (iPhone : lecteur jsQR, un peu plus lent) | | |
| « Enregistrer 3 s » puis « Jouer le son » : la voix enregistrée est rejouée | oui (iPhone : format MP4) | | |
| Jouer un son envoyé dans l'inspecteur (MP3) | oui, après un toucher | | |

## Écran « Capteurs » (bouton « Voir les capteurs » de l'écran Appareil)

| Vérification | Attendu | Android | iPhone |
|---|---|---|---|
| L'écran s'ouvre au-dessus des onglets, avec un bouton retour | oui | | |
| « Où suis-je ? » : l'autorisation est demandée, latitude et longitude s'affichent | oui | | |
| Refuser la position : message « Tu as refusé l'accès à : ta position… » | oui | | |
| « Mouvement » : inclinaison avant-arrière et gauche-droite suivent le téléphone | Android : oui ; iPhone : l'autorisation est demandée au toucher du bouton | | |
| Secouer le téléphone : message « Secoué ! » | oui | | |
| Réseau : « En ligne : true », passe à false en mode avion | oui | | |
| Batterie : le niveau s'affiche | Android Chrome : oui ; iPhone : ❌ attendu (« disponible » vaut faux, 100 %) | | |

## Thème et navigation

| Vérification | Attendu | Android | iPhone |
|---|---|---|---|
| Changer le thème (couleur principale, arrondis, sombre) : l'appli suit | oui | | |
| Thème « Auto » : suit le réglage clair ou sombre du téléphone | oui | | |
| Navigation par tiroir : le bouton ☰ ouvre le menu, toucher à côté le ferme | oui | | |

## Résultats

Date de l'essai, modèles et versions (par exemple « Pixel 7, Android 15, Chrome 140 » et
« iPhone 13, iOS 18.5, Safari ») :

- Android :
- iPhone :

Problèmes trouvés (à reporter dans une issue, avec le message affiché) :

-
