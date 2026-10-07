/** Runtime strings added by J3: errors explained for children (SPEC § 4.3). */
export const runtimeLearning = {
  friendly: {
    listIndex: 'La liste n’a que {{length}} élément(s), et ce bloc demande le {{nth}}.',
    emptyList: 'La liste est vide, et ce bloc demande son {{nth}} élément.',
    notAList: 'Ce bloc attend une liste, mais il a reçu autre chose.',
    badLength: 'Ce bloc demande une liste d’une longueur impossible (négative ou trop grande).',
    emptyValueProperty:
      'Ce bloc cherche « {{property}} » dans une valeur vide : vérifie qu’une variable a bien reçu une valeur.',
    badJson: 'Ce texte n’est pas écrit en JSON valide.',
    unknownName:
      'Ce bloc utilise un nom qui n’existe pas (une fonction ou une variable supprimée ?).',
  },
}
