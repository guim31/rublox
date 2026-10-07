/**
 * Help sheets of the general blocks, and the glossary (SPEC § 4.10). Component blocks take
 * their help from the catalog (`help` and `example` of each component).
 */
export const helpContent = {
  blockSheets: {
    rx_app_start: {
      title: 'quand l’appli démarre',
      text: 'Les blocs à l’intérieur s’exécutent une seule fois, à l’ouverture de l’appli, avant le premier écran. Idéal pour donner une valeur de départ aux variables.',
      example: 'quand l’appli démarre : mettre score à 0',
    },
    rx_forever: {
      title: 'répéter indéfiniment',
      text: 'Répète les blocs à l’intérieur sans jamais s’arrêter. L’appli ne se fige pas : le bouton Stop arrête tout.',
      example: 'répéter indéfiniment : attendre 1 seconde, ajouter 1 à secondes',
    },
    rx_wait: {
      title: 'attendre … seconde(s)',
      text: 'Fait une pause avant de passer au bloc suivant. Le reste de l’appli continue de répondre pendant ce temps.',
      example: 'mettre texte de Texte1 à "3", attendre 1 seconde, mettre texte de Texte1 à "2"',
    },
    rx_log: {
      title: 'afficher … dans la console',
      text: 'Écrit une valeur dans la console, en bas de l’éditeur. Pratique pour comprendre ce que fait ton appli.',
      example: 'afficher score dans la console',
    },
    rx_screen_open: {
      title: 'aller à l’écran …',
      text: 'Ouvre un autre écran de l’appli. Le bouton retour (ou le bloc « revenir ») ramène à celui-ci.',
      example: 'quand Bouton1 est cliqué : aller à l’écran Ecran2',
    },
    rx_screen_back: {
      title: 'revenir à l’écran précédent',
      text: 'Ferme l’écran actuel et revient à celui d’avant, tel qu’on l’avait laissé.',
      example: 'quand Retour est cliqué : revenir à l’écran précédent',
    },
    rx_ui_alert: {
      title: 'afficher le message …',
      text: 'Affiche un message dans une fenêtre, avec un bouton OK. Les blocs suivants attendent qu’on ait appuyé sur OK.',
      example: 'afficher le message "Bravo !"',
    },
    rx_ui_toast: {
      title: 'message bref …',
      text: 'Affiche un petit message en bas de l’écran, qui disparaît tout seul après quelques secondes.',
      example: 'message bref "Enregistré"',
    },
    rx_ui_confirm: {
      title: 'réponse oui ou non à …',
      text: 'Pose une question avec deux boutons. Le bloc vaut vrai si on répond oui, faux sinon.',
      example: 'si réponse oui ou non à "On recommence ?" alors …',
    },
    rx_ui_prompt: {
      title: 'réponse à la question …',
      text: 'Demande d’écrire une réponse. Le bloc vaut le texte écrit (ou rien si on annule).',
      example: 'mettre prénom à réponse à la question "Comment tu t’appelles ?"',
    },
    controls_if: {
      title: 'si … alors',
      text: 'Exécute les blocs seulement si la condition est vraie. Avec la roue dentée, ajoute « sinon si » et « sinon ».',
      example: 'si score > 10 alors mettre texte de Texte1 à "Gagné !" sinon …',
    },
    controls_repeat_ext: {
      title: 'répéter … fois',
      text: 'Exécute les blocs à l’intérieur le nombre de fois choisi.',
      example: 'répéter 3 fois : afficher le message "Hip hip hourra !"',
    },
    controls_whileUntil: {
      title: 'répéter tant que …',
      text: 'Répète les blocs tant que la condition est vraie (ou jusqu’à ce qu’elle le devienne).',
      example: 'répéter tant que vies > 0 : …',
    },
    controls_for: {
      title: 'compter avec … de … à …',
      text: 'Répète en donnant à une variable les valeurs de départ à fin, avec le pas choisi.',
      example: 'compter avec i de 1 à 10 par 1 : afficher i dans la console',
    },
    controls_forEach: {
      title: 'pour chaque élément … dans la liste …',
      text: 'Répète les blocs une fois pour chaque élément de la liste, rangé dans une variable.',
      example: 'pour chaque élément fruit dans la liste courses : afficher fruit',
    },
    controls_flow_statements: {
      title: 'quitter la boucle',
      text: 'Arrête la boucle tout de suite, ou passe directement au tour suivant.',
      example: 'si trouvé alors quitter la boucle',
    },
    logic_compare: {
      title: '… = …',
      text: 'Compare deux valeurs : égal, différent, plus petit, plus grand… Le bloc vaut vrai ou faux.',
      example: 'score ≥ 10',
    },
    logic_operation: {
      title: '… et …',
      text: '« et » est vrai si les deux conditions le sont ; « ou » si au moins une l’est.',
      example: 'vies > 0 et temps < 60',
    },
    logic_negate: {
      title: 'non …',
      text: 'Inverse une condition : vrai devient faux, et faux devient vrai.',
      example: 'non (liste est vide)',
    },
    logic_boolean: {
      title: 'vrai / faux',
      text: 'Une valeur de vérité, à ranger dans une variable ou à comparer.',
      example: 'mettre fini à vrai',
    },
    logic_null: {
      title: 'nul',
      text: 'L’absence de valeur.',
      example: 'si réponse = nul alors …',
    },
    logic_ternary: {
      title: 'si … alors … sinon …',
      text: 'Vaut une valeur ou une autre selon la condition, dans un seul bloc.',
      example: 'mettre texte à (si score > 10 alors "Bravo" sinon "Encore")',
    },
    math_number: {
      title: 'nombre',
      text: 'Un nombre, entier ou à virgule.',
      example: '42',
    },
    math_arithmetic: {
      title: '… + …',
      text: 'Additionne, soustrait, multiplie, divise ou élève à une puissance deux nombres.',
      example: 'score + 1',
    },
    math_random_int: {
      title: 'entier aléatoire entre … et …',
      text: 'Un nombre entier au hasard, bornes comprises. Change à chaque fois.',
      example: 'entier aléatoire entre 1 et 6 (un dé)',
    },
    math_single: {
      title: 'racine carrée …',
      text: 'Racine carrée, valeur absolue, opposé, logarithme, puissance de 10…',
      example: 'racine carrée de 9 → 3',
    },
    math_round: {
      title: 'arrondi …',
      text: 'Arrondit un nombre : au plus proche, vers le haut ou vers le bas.',
      example: 'arrondi de 3,6 → 4',
    },
    math_modulo: {
      title: 'reste de … ÷ …',
      text: 'Le reste de la division entière. Utile pour savoir si un nombre est pair.',
      example: 'reste de 7 ÷ 2 → 1',
    },
    math_number_property: {
      title: '… est pair',
      text: 'Vérifie si un nombre est pair, impair, premier, entier, positif, négatif ou divisible par un autre.',
      example: 'si score est pair alors …',
    },
    math_constrain: {
      title: 'contraindre … entre … et …',
      text: 'Garde un nombre entre une valeur minimale et une valeur maximale.',
      example: 'contraindre volume entre 0 et 100',
    },
    math_random_float: {
      title: 'fraction aléatoire',
      text: 'Un nombre à virgule au hasard, entre 0 et 1.',
      example: 'si fraction aléatoire < 0,5 alors …',
    },
    math_on_list: {
      title: 'somme de la liste …',
      text: 'Calcule sur une liste de nombres : somme, plus petit, plus grand, moyenne…',
      example: 'moyenne de la liste notes',
    },
    math_change: {
      title: 'ajouter … à …',
      text: 'Ajoute un nombre à une variable (ou en retire, avec un nombre négatif).',
      example: 'ajouter 1 à score',
    },
    text: {
      title: '" … "',
      text: 'Un texte : des mots, une phrase, un émoji.',
      example: '"Bonjour !"',
    },
    text_join: {
      title: 'créer un texte avec …',
      text: 'Colle plusieurs morceaux de texte (ou de nombres) les uns après les autres.',
      example: 'créer un texte avec "Score : " et score',
    },
    text_length: {
      title: 'longueur de …',
      text: 'Le nombre de caractères d’un texte.',
      example: 'longueur de "abc" → 3',
    },
    text_isEmpty: {
      title: '… est vide',
      text: 'Vrai si le texte ne contient rien.',
      example: 'si texte de Champ1 est vide alors …',
    },
    text_indexOf: {
      title: 'trouver … dans …',
      text: 'La position d’un morceau de texte dans un autre (0 s’il n’y est pas).',
      example: 'trouver "b" dans "abc" → 2',
    },
    text_charAt: {
      title: 'lettre n° … de …',
      text: 'Un caractère d’un texte, par sa position (à partir de 1).',
      example: 'lettre n° 1 de "Rublox" → "R"',
    },
    text_getSubstring: {
      title: 'morceau de texte',
      text: 'Une partie d’un texte, entre deux positions.',
      example: 'de la lettre 1 à la lettre 3 de "Bonjour" → "Bon"',
    },
    text_changeCase: {
      title: 'en MAJUSCULES …',
      text: 'Met un texte en majuscules, en minuscules ou en Majuscule Au Début.',
      example: 'en MAJUSCULES "abc" → "ABC"',
    },
    text_trim: {
      title: 'supprimer les espaces …',
      text: 'Retire les espaces au début et à la fin d’un texte.',
      example: '"  abc " → "abc"',
    },
    text_replace: {
      title: 'remplacer … par … dans …',
      text: 'Remplace chaque morceau de texte par un autre.',
      example: 'remplacer "a" par "o" dans "papa" → "popo"',
    },
    lists_create_empty: {
      title: 'liste vide',
      text: 'Une liste qui ne contient encore rien.',
      example: 'mettre courses à liste vide',
    },
    lists_create_with: {
      title: 'créer une liste avec …',
      text: 'Une liste avec les éléments donnés. La roue dentée en ajoute.',
      example: 'créer une liste avec "pain", "lait", "œufs"',
    },
    lists_repeat: {
      title: 'liste avec … répété … fois',
      text: 'Une liste qui contient plusieurs fois la même valeur.',
      example: 'liste avec 0 répété 5 fois',
    },
    lists_length: {
      title: 'longueur de la liste …',
      text: 'Le nombre d’éléments d’une liste.',
      example: 'longueur de courses',
    },
    lists_isEmpty: {
      title: 'la liste … est vide',
      text: 'Vrai si la liste ne contient aucun élément.',
      example: 'si courses est vide alors …',
    },
    lists_indexOf: {
      title: 'trouver … dans la liste …',
      text: 'La position d’un élément dans la liste (0 s’il n’y est pas).',
      example: 'trouver "lait" dans courses → 2',
    },
    lists_getIndex: {
      title: 'élément n° … de la liste …',
      text: 'Un élément de la liste, par sa position : la première est 1. Si la position n’existe pas, la console te le dit.',
      example: 'élément n° 1 de courses → "pain"',
    },
    lists_setIndex: {
      title: 'mettre l’élément n° … de la liste …',
      text: 'Remplace ou insère un élément à une position de la liste.',
      example: 'insérer en dernier "beurre" dans courses',
    },
    lists_getSublist: {
      title: 'sous-liste',
      text: 'Une partie de la liste, entre deux positions.',
      example: 'sous-liste de courses du n° 1 au n° 2',
    },
    lists_split: {
      title: 'liste depuis le texte …',
      text: 'Découpe un texte en liste avec un séparateur, ou recolle une liste en texte.',
      example: 'liste depuis le texte "a,b,c" avec "," → a, b, c',
    },
    lists_sort: {
      title: 'trier la liste …',
      text: 'Trie une liste par ordre alphabétique ou numérique, croissant ou décroissant.',
      example: 'trier courses par ordre alphabétique',
    },
    colour_picker: {
      title: 'couleur',
      text: 'Une couleur choisie dans la palette.',
      example: 'mettre couleur de Bouton1 à 🟣',
    },
    colour_random: {
      title: 'couleur au hasard',
      text: 'Une couleur tirée au hasard, différente à chaque fois.',
      example: 'mettre couleur de Texte1 à couleur au hasard',
    },
    colour_rgb: {
      title: 'couleur avec rouge … vert … bleu …',
      text: 'Une couleur composée de rouge, de vert et de bleu, de 0 à 100 chacun.',
      example: 'rouge 100, vert 50, bleu 0 → orange',
    },
    colour_blend: {
      title: 'mélanger …',
      text: 'Mélange deux couleurs, dans la proportion choisie.',
      example: 'mélanger rouge et bleu à 0,5 → violet',
    },
    variables_get: {
      title: 'variable',
      text: 'La valeur rangée dans la variable.',
      example: 'mettre texte de Texte1 à score',
    },
    variables_set: {
      title: 'mettre … à …',
      text: 'Range une valeur dans une variable. Elle la garde jusqu’à ce qu’on en range une autre.',
      example: 'mettre score à 0',
    },
    procedures_defnoreturn: {
      title: 'pour faire …',
      text: 'Une fonction : des blocs rangés sous un nom, qu’on lance avec un seul bloc. La roue dentée ajoute des paramètres.',
      example: 'pour faire « rejouer » : mettre score à 0, aller à l’écran Jeu',
    },
    procedures_defreturn: {
      title: 'pour faire … retourner …',
      text: 'Une fonction qui calcule une valeur et la rend à celui qui l’appelle.',
      example: 'pour faire « double » de n : retourner n × 2',
    },
    procedures_callnoreturn: {
      title: 'appeler une fonction',
      text: 'Lance les blocs de la fonction, puis continue.',
      example: 'quand Rejouer est cliqué : rejouer',
    },
    procedures_callreturn: {
      title: 'appeler une fonction qui retourne',
      text: 'Lance la fonction et vaut la valeur qu’elle retourne.',
      example: 'mettre texte de Texte1 à double(21)',
    },
  },
  componentSheets: {
    event: 'Les blocs à l’intérieur s’exécutent quand cela se produit sur {{name}}.',
    set: 'Change une propriété de {{name}} pendant que l’appli tourne.',
    get: 'La valeur actuelle d’une propriété de {{name}}.',
    method: 'Une action que {{name}} sait faire.',
  },
  glossary: {
    app: {
      term: 'Appli',
      text: 'Un programme pour téléphone. Avec Rublox, elle tourne dans le navigateur et s’installe sur l’écran d’accueil.',
    },
    screen: {
      term: 'Écran',
      text: 'Une page de l’appli. Une appli peut en avoir plusieurs et passer de l’une à l’autre.',
    },
    component: {
      term: 'Composant',
      text: 'Un élément posé sur un écran : bouton, texte, image… Les composants invisibles (minuteur, son) n’apparaissent pas à l’écran.',
    },
    property: {
      term: 'Propriété',
      text: 'Un réglage d’un composant : son texte, sa couleur, sa taille. Les blocs « mettre » la changent.',
    },
    event: {
      term: 'Évènement',
      text: 'Quelque chose qui se passe : un clic, l’ouverture d’un écran. Les blocs « quand… » y répondent.',
    },
    block: {
      term: 'Bloc',
      text: 'Une pièce de programme. Les blocs s’emboîtent pour former des instructions.',
    },
    variable: {
      term: 'Variable',
      text: 'Une boîte avec un nom, où l’appli range une valeur (un score, un prénom) pour s’en servir plus tard.',
    },
    loop: {
      term: 'Boucle',
      text: 'Un bloc qui répète d’autres blocs : un nombre de fois, tant qu’une condition est vraie, ou pour chaque élément d’une liste.',
    },
    condition: {
      term: 'Condition',
      text: 'Une question dont la réponse est vrai ou faux. Le bloc « si » choisit quoi faire selon la réponse.',
    },
    function: {
      term: 'Fonction',
      text: 'Des blocs rangés sous un nom, pour s’en servir plusieurs fois sans les recopier.',
    },
    parameter: {
      term: 'Paramètre',
      text: 'Une valeur qu’on donne à une fonction quand on l’appelle, pour qu’elle s’adapte.',
    },
    list: {
      term: 'Liste',
      text: 'Plusieurs valeurs rangées dans l’ordre. Le premier élément est le n° 1.',
    },
    preview: {
      term: 'Aperçu',
      text: 'L’appli en train de tourner, à côté de l’éditeur. Elle se met à jour à chaque changement.',
    },
    console: {
      term: 'Console',
      text: 'Le panneau en bas de l’éditeur : les messages de l’appli et ses erreurs. Clique sur une erreur pour voir le bloc en cause.',
    },
    slowMotion: {
      term: 'Ralenti',
      text: 'Une façon de lancer l’appli lentement, en allumant chaque bloc pendant qu’il s’exécute.',
    },
    breakpoint: {
      term: 'Point d’arrêt',
      text: 'Une pause posée sur un bloc (clic droit) : au ralenti, l’appli s’arrête dessus pour que tu regardes.',
    },
    bug: {
      term: 'Bug',
      text: 'Une erreur dans un programme. Tout le monde en fait : les trouver, c’est déboguer.',
    },
    code: {
      term: 'Code',
      text: 'Le programme écrit en texte. Tes blocs deviennent du JavaScript, que tu peux lire dans la vue du code.',
    },
  },
}
