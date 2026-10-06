import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Our design tokens add font sizes (`text-ui…`), heights and radii that tailwind-merge must
// not mistake for colours.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['ui', 'ui-sm', 'ui-lg', 'ui-xl'] }],
      'font-weight': [{ font: ['strong'] }],
    },
  },
})

/** Joins class names, letting later Tailwind classes override earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
