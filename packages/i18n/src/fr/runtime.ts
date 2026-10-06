export const runtime = {
  ok: 'OK',
  cancel: 'Annuler',
  yes: 'Oui',
  no: 'Non',
  imagePlaceholder: 'Image',
  stopped: 'L’appli est arrêtée.',
  restart: 'Relancer',
  noScreen: 'Cet écran n’existe pas : {{name}}',
  errors: {
    unknownProperty: '{{component}} n’a pas de propriété « {{property}} ».',
    invalidValue: '« {{value}} » ne convient pas pour {{component}}.{{property}}.',
    notAFunction: 'Ce bloc essaie d’utiliser quelque chose qui n’est pas une action.',
    undefinedValue:
      'Ce bloc utilise une valeur vide : vérifie qu’une variable a bien reçu une valeur.',
    tooMuchRecursion: 'Une fonction s’appelle elle-même sans fin.',
    generic: 'Erreur : {{message}}',
  },
}
