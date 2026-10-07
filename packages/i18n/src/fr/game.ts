/** Strings of the game mode (J7), merged into the `studio`, `blocks` and `runtime` spaces. */
export const game = {
  blocks: {
    eventValue: '%1 de l’événement',
    eventValueTooltip: 'Une valeur que l’événement apporte (le temps écoulé, l’autre lutin…).',
    eventValueOutside: 'Ce bloc ne marche que dans son bloc « quand … ».',
  },
  runtime: {
    tooManyClones: 'Il y a déjà {{count}} clones : {{name}} n’en crée pas de nouveau.',
  },
  studio: {
    demos: {
      catchGame: 'Ouvrir la démo de jeu : Attrape les fruits',
      bouncing: 'Ouvrir la démo de jeu : 50 lutins qui rebondissent',
    },
    demoCreating: 'Préparation de la démo…',
    demoFailed: 'La démo n’a pas pu être créée. Réessaie.',
    costumes: {
      title: 'Costumes',
      costume: 'Costume {{n}}',
      empty: 'Aucun costume : ajoute un émoji ou une image.',
      add: 'Ajouter un costume',
      emoji: 'Émoji ou lettre',
      emojiPlaceholder: 'par ex. 🚀',
      addEmoji: 'Ajouter',
      suggestions: 'Idées',
      images: 'Images du projet',
      upload: 'Envoyer une image',
      remove: 'Retirer le costume {{n}}',
      moveEarlier: 'Avancer le costume {{n}}',
    },
    canvas: {
      move: 'Déplacer : glisse, ou flèches (Maj : 10 à la fois)',
      resize: 'Changer la taille',
      rotate: 'Tourner (Maj : par 15°)',
      sceneOnly: 'Les lutins, textes de scène et joysticks vont dans une scène de jeu.',
      notInScene:
        'Une scène de jeu n’accepte que des lutins, des textes de scène et des joysticks.',
      keyboardHelp:
        'Flèches : déplacer. Alt + flèches : taille. R ou Maj + R : tourner. Échap : désélectionner.',
    },
  },
}
