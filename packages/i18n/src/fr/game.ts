/** Strings of the game mode (J7), merged into the `studio`, `blocks` and `runtime` spaces. */
export const game = {
  blocks: {
    eventArg: 'Une valeur reçue par le bloc « quand … » qui contient celui-ci.',
    eventArgMisplaced: 'Ce bloc ne marche que dans son bloc « quand … ».',
    eventArgEmpty: 'valeur reçue',
  },
  runtime: {
    tooManyClones: 'Il y a déjà {{count}} clones : {{name}} n’en crée pas de nouveau.',
  },
  studio: {
    demo: 'Ouvrir la démo : Attrape les fruits',
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
