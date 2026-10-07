import type { helpContent as fr } from '../fr/help.ts'

type Sheets<T> = { [K in keyof T]: T[K] extends string ? string : Sheets<T[K]> }

/**
 * Help sheets of the general blocks, and the glossary (SPEC § 4.10). Component blocks take
 * their help from the catalog (`help` and `example` of each component).
 */
export const helpContent: Sheets<typeof fr> = {
  blockSheets: {
    rx_app_start: {
      title: 'when the app starts',
      text: 'The blocks inside run once, when the app opens, before the first screen. The right place to give variables their starting value.',
      example: 'when the app starts: set score to 0',
    },
    rx_forever: {
      title: 'repeat forever',
      text: 'Repeats the blocks inside without ever stopping. The app does not freeze: the Stop button stops everything.',
      example: 'repeat forever: wait 1 second, change seconds by 1',
    },
    rx_wait: {
      title: 'wait … second(s)',
      text: 'Pauses before the next block. The rest of the app keeps answering in the meantime.',
      example: 'set text of Text1 to "3", wait 1 second, set text of Text1 to "2"',
    },
    rx_log: {
      title: 'print … in the console',
      text: 'Writes a value in the console, at the bottom of the editor. Handy to understand what your app does.',
      example: 'print score in the console',
    },
    rx_screen_open: {
      title: 'go to screen …',
      text: 'Opens another screen of the app. The back button (or the “go back” block) returns to this one.',
      example: 'when Button1 is clicked: go to screen Screen2',
    },
    rx_screen_back: {
      title: 'go back to the previous screen',
      text: 'Closes the current screen and returns to the one before, as it was left.',
      example: 'when Back is clicked: go back to the previous screen',
    },
    rx_ui_alert: {
      title: 'show the message …',
      text: 'Shows a message in a window, with an OK button. The next blocks wait until OK is tapped.',
      example: 'show the message "Well done!"',
    },
    rx_ui_toast: {
      title: 'short message …',
      text: 'Shows a small message at the bottom of the screen, which goes away by itself after a few seconds.',
      example: 'short message "Saved"',
    },
    rx_ui_confirm: {
      title: 'yes or no answer to …',
      text: 'Asks a question with two buttons. The block is true when the answer is yes, false otherwise.',
      example: 'if yes or no answer to "Play again?" then …',
    },
    rx_ui_prompt: {
      title: 'answer to the question …',
      text: 'Asks to type an answer. The block is the text typed (or nothing when cancelled).',
      example: 'set name to answer to the question "What is your name?"',
    },
    controls_if: {
      title: 'if … do',
      text: 'Runs the blocks only when the condition is true. With the gear, add “else if” and “else”.',
      example: 'if score > 10 do set text of Text1 to "You win!" else …',
    },
    controls_repeat_ext: {
      title: 'repeat … times',
      text: 'Runs the blocks inside the chosen number of times.',
      example: 'repeat 3 times: show the message "Hip hip hooray!"',
    },
    controls_whileUntil: {
      title: 'repeat while …',
      text: 'Repeats the blocks while the condition is true (or until it becomes true).',
      example: 'repeat while lives > 0: …',
    },
    controls_for: {
      title: 'count with … from … to …',
      text: 'Repeats, giving a variable the values from start to end, by the chosen step.',
      example: 'count with i from 1 to 10 by 1: print i in the console',
    },
    controls_forEach: {
      title: 'for each item … in list …',
      text: 'Repeats the blocks once for each item of the list, kept in a variable.',
      example: 'for each item fruit in list shopping: print fruit',
    },
    controls_flow_statements: {
      title: 'break out of loop',
      text: 'Stops the loop right away, or jumps to its next turn.',
      example: 'if found then break out of loop',
    },
    logic_compare: {
      title: '… = …',
      text: 'Compares two values: equal, different, smaller, bigger… The block is true or false.',
      example: 'score ≥ 10',
    },
    logic_operation: {
      title: '… and …',
      text: '“and” is true when both conditions are; “or” when at least one is.',
      example: 'lives > 0 and time < 60',
    },
    logic_negate: {
      title: 'not …',
      text: 'Turns a condition around: true becomes false, false becomes true.',
      example: 'not (list is empty)',
    },
    logic_boolean: {
      title: 'true / false',
      text: 'A truth value, to keep in a variable or to compare.',
      example: 'set done to true',
    },
    logic_null: {
      title: 'null',
      text: 'No value at all.',
      example: 'if answer = null then …',
    },
    logic_ternary: {
      title: 'test … if true … if false …',
      text: 'One value or another depending on the condition, in a single block.',
      example: 'set text to (if score > 10 then "Bravo" else "Again")',
    },
    math_number: {
      title: 'number',
      text: 'A number, whole or decimal.',
      example: '42',
    },
    math_arithmetic: {
      title: '… + …',
      text: 'Adds, subtracts, multiplies, divides or raises two numbers to a power.',
      example: 'score + 1',
    },
    math_random_int: {
      title: 'random integer from … to …',
      text: 'A random whole number, both ends included. Different every time.',
      example: 'random integer from 1 to 6 (a dice)',
    },
    math_single: {
      title: 'square root …',
      text: 'Square root, absolute value, negation, logarithm, power of 10…',
      example: 'square root of 9 → 3',
    },
    math_round: {
      title: 'round …',
      text: 'Rounds a number: to the nearest, up or down.',
      example: 'round 3.6 → 4',
    },
    math_modulo: {
      title: 'remainder of … ÷ …',
      text: 'The remainder of the whole division. Useful to know whether a number is even.',
      example: 'remainder of 7 ÷ 2 → 1',
    },
    math_number_property: {
      title: '… is even',
      text: 'Checks whether a number is even, odd, prime, whole, positive, negative or divisible by another.',
      example: 'if score is even then …',
    },
    math_constrain: {
      title: 'constrain … low … high …',
      text: 'Keeps a number between a lowest and a highest value.',
      example: 'constrain volume low 0 high 100',
    },
    math_random_float: {
      title: 'random fraction',
      text: 'A random decimal number between 0 and 1.',
      example: 'if random fraction < 0.5 then …',
    },
    math_on_list: {
      title: 'sum of list …',
      text: 'Computes over a list of numbers: sum, smallest, biggest, average…',
      example: 'average of list marks',
    },
    math_change: {
      title: 'change … by …',
      text: 'Adds a number to a variable (or takes it away, with a negative number).',
      example: 'change score by 1',
    },
    text: {
      title: '" … "',
      text: 'A text: words, a sentence, an emoji.',
      example: '"Hello!"',
    },
    text_join: {
      title: 'create text with …',
      text: 'Glues pieces of text (or numbers) one after the other.',
      example: 'create text with "Score: " and score',
    },
    text_length: {
      title: 'length of …',
      text: 'The number of characters of a text.',
      example: 'length of "abc" → 3',
    },
    text_isEmpty: {
      title: '… is empty',
      text: 'True when the text holds nothing.',
      example: 'if text of Input1 is empty then …',
    },
    text_indexOf: {
      title: 'find … in …',
      text: 'The position of a piece of text in another (0 when it is not there).',
      example: 'find "b" in "abc" → 2',
    },
    text_charAt: {
      title: 'letter # … of …',
      text: 'One character of a text, by its position (from 1).',
      example: 'letter # 1 of "Rublox" → "R"',
    },
    text_getSubstring: {
      title: 'substring',
      text: 'A part of a text, between two positions.',
      example: 'from letter 1 to letter 3 of "Hello" → "Hel"',
    },
    text_changeCase: {
      title: 'to UPPER CASE …',
      text: 'Puts a text in upper case, lower case or Title Case.',
      example: 'to UPPER CASE "abc" → "ABC"',
    },
    text_trim: {
      title: 'trim spaces …',
      text: 'Removes the spaces at the start and the end of a text.',
      example: '"  abc " → "abc"',
    },
    text_replace: {
      title: 'replace … with … in …',
      text: 'Replaces every piece of text with another.',
      example: 'replace "a" with "o" in "papa" → "popo"',
    },
    lists_create_empty: {
      title: 'empty list',
      text: 'A list that holds nothing yet.',
      example: 'set shopping to empty list',
    },
    lists_create_with: {
      title: 'create list with …',
      text: 'A list with the given items. The gear adds more.',
      example: 'create list with "bread", "milk", "eggs"',
    },
    lists_repeat: {
      title: 'list with … repeated … times',
      text: 'A list holding the same value several times.',
      example: 'list with 0 repeated 5 times',
    },
    lists_length: {
      title: 'length of list …',
      text: 'The number of items of a list.',
      example: 'length of shopping',
    },
    lists_isEmpty: {
      title: 'list … is empty',
      text: 'True when the list holds no item.',
      example: 'if shopping is empty then …',
    },
    lists_indexOf: {
      title: 'find … in list …',
      text: 'The position of an item in the list (0 when it is not there).',
      example: 'find "milk" in shopping → 2',
    },
    lists_getIndex: {
      title: 'item # … of list …',
      text: 'An item of the list, by its position: the first one is 1. When the position does not exist, the console tells you.',
      example: 'item # 1 of shopping → "bread"',
    },
    lists_setIndex: {
      title: 'set item # … of list …',
      text: 'Replaces or inserts an item at a position of the list.',
      example: 'insert at last "butter" in shopping',
    },
    lists_getSublist: {
      title: 'sublist',
      text: 'A part of the list, between two positions.',
      example: 'sublist of shopping from # 1 to # 2',
    },
    lists_split: {
      title: 'make list from text …',
      text: 'Cuts a text into a list with a separator, or glues a list back into a text.',
      example: 'make list from text "a,b,c" with "," → a, b, c',
    },
    lists_sort: {
      title: 'sort list …',
      text: 'Sorts a list in alphabetic or numeric order, ascending or descending.',
      example: 'sort shopping alphabetically',
    },
    colour_picker: {
      title: 'colour',
      text: 'A colour picked from the palette.',
      example: 'set color of Button1 to 🟣',
    },
    colour_random: {
      title: 'random colour',
      text: 'A colour drawn at random, different every time.',
      example: 'set color of Text1 to random colour',
    },
    colour_rgb: {
      title: 'colour with red … green … blue …',
      text: 'A colour made of red, green and blue, from 0 to 100 each.',
      example: 'red 100, green 50, blue 0 → orange',
    },
    colour_blend: {
      title: 'blend …',
      text: 'Mixes two colours, in the chosen ratio.',
      example: 'blend red and blue at 0.5 → purple',
    },
    variables_get: {
      title: 'variable',
      text: 'The value kept in the variable.',
      example: 'set text of Text1 to score',
    },
    variables_set: {
      title: 'set … to …',
      text: 'Keeps a value in a variable. It stays there until another one is set.',
      example: 'set score to 0',
    },
    procedures_defnoreturn: {
      title: 'to do …',
      text: 'A function: blocks kept under a name, started with a single block. The gear adds parameters.',
      example: 'to do “replay”: set score to 0, go to screen Game',
    },
    procedures_defreturn: {
      title: 'to do … return …',
      text: 'A function that computes a value and gives it back to whoever calls it.',
      example: 'to do “double” with n: return n × 2',
    },
    procedures_callnoreturn: {
      title: 'call a function',
      text: 'Runs the blocks of the function, then goes on.',
      example: 'when Replay is clicked: replay',
    },
    procedures_callreturn: {
      title: 'call a function that returns',
      text: 'Runs the function and is the value it returns.',
      example: 'set text of Text1 to double(21)',
    },
  },
  componentSheets: {
    event: 'The blocks inside run when this happens on {{name}}.',
    set: 'Changes a property of {{name}} while the app runs.',
    get: 'The current value of a property of {{name}}.',
    method: 'Something {{name}} knows how to do.',
  },
  glossary: {
    app: {
      term: 'App',
      text: 'A program for a phone. With Rublox, it runs in the browser and installs on the home screen.',
    },
    screen: {
      term: 'Screen',
      text: 'A page of the app. An app can have several and move from one to another.',
    },
    component: {
      term: 'Component',
      text: 'Something placed on a screen: a button, a text, an image… Invisible components (timer, sound) do not show on the screen.',
    },
    property: {
      term: 'Property',
      text: 'A setting of a component: its text, its color, its size. “Set” blocks change it.',
    },
    event: {
      term: 'Event',
      text: 'Something that happens: a click, a screen opening. “When…” blocks answer it.',
    },
    block: {
      term: 'Block',
      text: 'A piece of program. Blocks snap together into instructions.',
    },
    variable: {
      term: 'Variable',
      text: 'A box with a name, where the app keeps a value (a score, a name) to use it later.',
    },
    loop: {
      term: 'Loop',
      text: 'A block that repeats other blocks: a number of times, while a condition is true, or for each item of a list.',
    },
    condition: {
      term: 'Condition',
      text: 'A question whose answer is true or false. The “if” block chooses what to do from the answer.',
    },
    function: {
      term: 'Function',
      text: 'Blocks kept under a name, to use them several times without copying them.',
    },
    parameter: {
      term: 'Parameter',
      text: 'A value given to a function when calling it, so that it adapts.',
    },
    list: {
      term: 'List',
      text: 'Several values kept in order. The first item is number 1.',
    },
    preview: {
      term: 'Preview',
      text: 'The app running next to the editor. It updates on every change.',
    },
    console: {
      term: 'Console',
      text: 'The panel at the bottom of the editor: the app’s messages and errors. Click an error to see the block at fault.',
    },
    slowMotion: {
      term: 'Slow motion',
      text: 'A way to run the app slowly, lighting each block up while it runs.',
    },
    breakpoint: {
      term: 'Breakpoint',
      text: 'A pause put on a block (right-click): in slow motion, the app stops there so that you can look.',
    },
    bug: {
      term: 'Bug',
      text: 'A mistake in a program. Everybody makes them: finding them is debugging.',
    },
    code: {
      term: 'Code',
      text: 'The program written as text. Your blocks become JavaScript, which you can read in the code view.',
    },
  },
}
