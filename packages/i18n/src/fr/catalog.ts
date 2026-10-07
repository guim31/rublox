/**
 * Strings of the J2 milestone (full catalog): new property editors, app theme and
 * navigation, multiple selection, copy and paste, the demo app, and what components say
 * while the app runs (permissions, missing features).
 */
export const catalog = {
  studio: {
    app: {
      tab: 'Appli',
      screenTab: 'Écran',
      theme: 'Thème de l’appli',
      themeHint:
        'Les composants prennent ces couleurs et ces arrondis, sauf ceux que tu as réglés toi-même.',
      presets: 'Thèmes tout prêts',
      primary: 'Couleur principale',
      secondary: 'Couleur secondaire',
      background: 'Fond',
      font: 'Police',
      fonts: {
        system: 'Du téléphone',
        rounded: 'Arrondie',
        serif: 'À empattements',
        mono: 'Machine à écrire',
      },
      radius: 'Arrondis',
      scheme: 'Clair ou sombre',
      schemes: { light: 'Clair', dark: 'Sombre', auto: 'Comme le téléphone' },
      navigation: 'Navigation',
      kinds: { stack: 'Pile', tabs: 'Onglets', drawer: 'Tiroir' },
      kindHints: {
        stack: 'Les écrans s’empilent : « aller à l’écran » en ouvre un, le bouton retour revient.',
        tabs: 'Une barre d’onglets en bas de l’appli. Choisis les écrans, leur icône et leur nom.',
        drawer: 'Un menu qui s’ouvre sur le côté, avec le bouton ☰. Choisis les écrans du menu.',
      },
      entries: 'Écrans du menu',
      inMenu: 'Mettre {{name}} dans le menu',
      label: 'Nom affiché pour {{name}}',
      open: 'Thème et navigation de l’appli',
    },
    nonVisual: { title: 'Composants invisibles' },
    list: {
      linesHint: 'Un élément par ligne.',
      item: 'Élément {{n}}',
      up: 'Monter',
      down: 'Descendre',
      remove: 'Retirer cet élément',
      add: 'Ajouter un élément',
      noImage: 'Pas d’image',
      fields: { title: 'Titre', subtitle: 'Sous-titre', image: 'Image', button: 'Bouton' },
    },
    icon: { none: 'Aucune icône', search: 'Chercher une icône', choose: 'Icônes' },
    asset: {
      none: 'Aucun fichier',
      url: 'ou une adresse https:',
      tooBig: 'Ce fichier est trop lourd.',
      upload: {
        image: 'Envoyer une image',
        sound: 'Envoyer un son',
        video: 'Envoyer une vidéo',
        lottie: 'Envoyer une animation Lottie (.json)',
      },
      wrongKind: {
        image: 'Ce fichier n’est pas une image.',
        sound: 'Ce fichier n’est pas un son.',
        video: 'Ce fichier n’est pas une vidéo.',
        lottie: 'Ce fichier n’est pas une animation Lottie (.json).',
      },
    },
  },
  runtime: {
    storageFull:
      'Impossible de garder les variables stockées sur cet appareil (stockage plein ou bloqué).',
    unavailable: 'Ce navigateur ne sait pas faire ça : {{feature}}.',
    denied:
      'Tu as refusé l’accès à : {{what}}. Pour l’autoriser, ouvre les réglages du navigateur pour ce site, puis réessaie.',
    failed: 'Ça n’a pas marché : {{message}}',
    noSource: 'Choisis d’abord un fichier dans l’inspecteur.',
    what: {
      camera: 'la caméra',
      microphone: 'le micro',
      location: 'ta position',
      motion: 'les mouvements du téléphone',
      notifications: 'les notifications',
      clipboard: 'le presse-papiers',
    },
    scanner: {
      title: 'Vise un QR code',
      cancel: 'Annuler',
      starting: 'Ouverture de la caméra…',
    },
    camera: {
      off: 'Caméra éteinte',
    },
    lottie: 'Animation',
    web: 'Page web',
    webHint: 'Une adresse https:// s’affichera ici.',
    video: 'Vidéo',
    noItems: 'Aucun élément',
    choose: 'Choisir…',
    tabs: 'Navigation',
    menu: 'Menu',
    closeMenu: 'Fermer le menu',
  },
  blocks: {
    appCall: 'appeler la fonction',
    appCallValue: 'résultat de la fonction',
    appCallTooltip:
      'Lance une fonction de l’espace « Appli » : elle est partagée par tous les écrans.',
    missingFunction: 'fonction introuvable dans l’espace Appli',
    appFunctions: 'Fonctions de l’appli',
    noAppFunctions:
      'Crée une fonction dans l’espace « Appli » (sélecteur d’écran) pour l’utiliser dans tous les écrans.',
    createVariable: 'Créer une variable',
    createStoredVariable: 'Créer une variable stockée',
    appVariables: 'Variables de l’appli (remises à zéro au démarrage)',
    storedVariables: 'Variables stockées (gardées sur le téléphone)',
    storedPrompt: 'Nom de la nouvelle variable stockée :',
    nameTaken: 'Ce nom est déjà pris ou n’est pas valable : choisis-en un autre.',
    eventValue: 'valeur %1 de l’événement',
    eventValueTooltip:
      'Ce que l’événement apporte (l’élément touché, la nouvelle valeur…). À utiliser dans le bloc « quand… » qui le fournit.',
    eventValueOutside: 'Place ce bloc dans un bloc « quand… » qui fournit cette valeur.',
  },
}
