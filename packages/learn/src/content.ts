import { getComponentDef } from '@rublox/catalog'
import type { UiMode } from '@rublox/schema'
import countdown from '../../../content/challenges/countdown/challenge.json' with { type: 'json' }
import countdownEn from '../../../content/challenges/countdown/en.json' with { type: 'json' }
import countdownFr from '../../../content/challenges/countdown/fr.json' with { type: 'json' }
import counter from '../../../content/challenges/counter/challenge.json' with { type: 'json' }
import counterEn from '../../../content/challenges/counter/en.json' with { type: 'json' }
import counterFr from '../../../content/challenges/counter/fr.json' with { type: 'json' }
import headsTails from '../../../content/challenges/heads-tails/challenge.json' with {
  type: 'json',
}
import headsTailsEn from '../../../content/challenges/heads-tails/en.json' with { type: 'json' }
import headsTailsFr from '../../../content/challenges/heads-tails/fr.json' with { type: 'json' }
import helperFunction from '../../../content/challenges/helper-function/challenge.json' with {
  type: 'json',
}
import helperFunctionEn from '../../../content/challenges/helper-function/en.json' with {
  type: 'json',
}
import helperFunctionFr from '../../../content/challenges/helper-function/fr.json' with {
  type: 'json',
}
import addressBookEn from '../../../content/tutorials/address-book/en.json' with { type: 'json' }
import addressBookFr from '../../../content/tutorials/address-book/fr.json' with { type: 'json' }
import addressBook from '../../../content/tutorials/address-book/tutorial.json' with {
  type: 'json',
}
import familyChatEn from '../../../content/tutorials/family-chat/en.json' with { type: 'json' }
import familyChatFr from '../../../content/tutorials/family-chat/fr.json' with { type: 'json' }
import familyChat from '../../../content/tutorials/family-chat/tutorial.json' with { type: 'json' }
import firstButtonEn from '../../../content/tutorials/first-button/en.json' with { type: 'json' }
import firstButtonFr from '../../../content/tutorials/first-button/fr.json' with { type: 'json' }
import firstButton from '../../../content/tutorials/first-button/tutorial.json' with {
  type: 'json',
}
import magicDiceEn from '../../../content/tutorials/magic-dice/en.json' with { type: 'json' }
import magicDiceFr from '../../../content/tutorials/magic-dice/fr.json' with { type: 'json' }
import magicDice from '../../../content/tutorials/magic-dice/tutorial.json' with { type: 'json' }
import myPlacesEn from '../../../content/tutorials/my-places/en.json' with { type: 'json' }
import myPlacesFr from '../../../content/tutorials/my-places/fr.json' with { type: 'json' }
import myPlaces from '../../../content/tutorials/my-places/tutorial.json' with { type: 'json' }
import quizEn from '../../../content/tutorials/quiz/en.json' with { type: 'json' }
import quizFr from '../../../content/tutorials/quiz/fr.json' with { type: 'json' }
import quiz from '../../../content/tutorials/quiz/tutorial.json' with { type: 'json' }
import twoScreensEn from '../../../content/tutorials/two-screens/en.json' with { type: 'json' }
import twoScreensFr from '../../../content/tutorials/two-screens/fr.json' with { type: 'json' }
import twoScreens from '../../../content/tutorials/two-screens/tutorial.json' with { type: 'json' }
import weatherEn from '../../../content/tutorials/weather/en.json' with { type: 'json' }
import weatherFr from '../../../content/tutorials/weather/fr.json' with { type: 'json' }
import weather from '../../../content/tutorials/weather/tutorial.json' with { type: 'json' }
import type { Challenge, ChallengeTexts, Tutorial, TutorialTexts } from './model.ts'

// Content is data (`content/`, SPEC § 6.2): a tutorial is a `tutorial.json` (steps, checks,
// targets) and one text file per language. Adding one = a folder + one line below.
function tutorial(data: unknown, fr: unknown, en: unknown): Tutorial {
  return {
    ...(data as Omit<Tutorial, 'texts'>),
    texts: { fr: fr as TutorialTexts, en: en as TutorialTexts },
  }
}

function challenge(data: unknown, fr: unknown, en: unknown): Challenge {
  return {
    ...(data as Omit<Challenge, 'texts'>),
    texts: { fr: fr as ChallengeTexts, en: en as ChallengeTexts },
  }
}

/** Every tutorial, including those whose components do not exist yet. */
export const ALL_TUTORIALS: readonly Tutorial[] = [
  tutorial(firstButton, firstButtonFr, firstButtonEn),
  tutorial(magicDice, magicDiceFr, magicDiceEn),
  tutorial(quiz, quizFr, quizEn),
  tutorial(twoScreens, twoScreensFr, twoScreensEn),
  // J5: data and services.
  tutorial(weather, weatherFr, weatherEn),
  tutorial(addressBook, addressBookFr, addressBookEn),
  tutorial(myPlaces, myPlacesFr, myPlacesEn),
  tutorial(familyChat, familyChatFr, familyChatEn),
]

export const ALL_CHALLENGES: readonly Challenge[] = [
  challenge(counter, counterFr, counterEn),
  challenge(countdown, countdownFr, countdownEn),
  challenge(headsTails, headsTailsFr, headsTailsEn),
  challenge(helperFunction, helperFunctionFr, helperFunctionEn),
]

const available = (item: { requires: string[] }) =>
  item.requires.every((type) => getComponentDef(type) !== undefined)

const byOrder = <T extends { mode: UiMode; order: number }>(a: T, b: T) =>
  a.mode === b.mode ? a.order - b.order : a.mode === 'junior' ? -1 : 1

/** Tutorials whose components all exist in the catalog, Junior first. */
export const TUTORIALS: readonly Tutorial[] = ALL_TUTORIALS.filter(available).sort(byOrder)
export const CHALLENGES: readonly Challenge[] = ALL_CHALLENGES.filter(available).sort(byOrder)

export function getTutorial(id: string): Tutorial | undefined {
  return TUTORIALS.find((t) => t.id === id)
}

export function getChallenge(id: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id)
}
