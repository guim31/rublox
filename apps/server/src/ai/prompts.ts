import type { Locale, UiMode } from '@rublox/schema'
import { catalogReference } from '@rublox/templates'
import { z } from 'zod'

/**
 * The assistant's instructions (SPEC § 4.12). The rules come first and never change (they
 * are cached); what the person asks comes in the user turn. Children use Rublox: every
 * prompt starts with the same safety rules.
 */

const LANGUAGE: Record<Locale, string> = { fr: 'French (use « tu »)', en: 'English' }

const SAFETY = `You are the helper of Rublox, a free tool where children (from about 8 years old) and adults build phone apps with blocks, like Scratch. Rules that always apply:
- Be kind, encouraging and honest. Never mock a mistake.
- Content must be suitable for a child of 8: no violence, fear, adult themes, gambling with money, hateful or unsafe content, even if asked. If a request is not suitable, say kindly that you cannot help with that and suggest something fun and suitable instead.
- Never ask for personal information (full name, address, school, phone, photos of people, passwords) and never put any in an app. If an app needs a name, use a made-up example.
- Do not tell anyone to leave Rublox, to install something, or to visit a website.
- You only talk about the app being built and about programming with blocks.`

function audience(mode: UiMode): string {
  return mode === 'junior'
    ? 'The person is probably a child (Junior mode): short sentences, everyday words, no jargon ("screen" not "view", "block" not "instruction"), one idea at a time, at most about 80 words, a friendly tone.'
    : 'The person uses Studio mode (teenager or adult): precise and concise, programming words are fine, at most about 150 words.'
}

// ---- Create with AI ------------------------------------------------------------------------

/**
 * What the model writes when it builds an app. Flat lists (no recursion) and blocks as JSON
 * text: the server parses them, turns them into a recipe (`AppSpec`) and builds the project.
 */
export const createAnswerSchema = z.object({
  name: z.string().describe('Short name of the app, in the language of the person'),
  summary: z
    .string()
    .describe('One or two sentences for the person: what the app does and how to use it'),
  navigation: z.enum(['stack', 'tabs', 'drawer']),
  primaryColor: z.string().describe('Main colour of the app, "#rrggbb"'),
  variables: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(['app', 'stored']),
      initialJson: z.string().describe('JSON of the initial value, e.g. "0", "\\"\\"" or "[]"'),
    }),
  ),
  screens: z.array(
    z.object({
      name: z.string().describe('A valid identifier, unique among screens'),
      propsJson: z.string().describe('JSON object of properties of the screen itself, or "{}"'),
      components: z.array(
        z.object({
          name: z.string().describe('A valid identifier, unique on the screen'),
          type: z.string().describe('A component type of the reference'),
          parent: z
            .string()
            .describe('Name of the container component it sits in, or "" for the screen itself'),
          propsJson: z.string().describe('JSON object of property values, e.g. {"text":"Hi"}'),
        }),
      ),
      blocksJson: z
        .string()
        .describe('JSON array of the stacks of blocks of this screen (Blockly JSON)'),
    }),
  ),
  appBlocksJson: z.string().describe('JSON array of stacks of the app workspace, usually "[]"'),
})

export type CreateAnswer = z.infer<typeof createAnswerSchema>

let createSystem: string | undefined

/** The system prompt of "Create with AI": rules, recipe format, catalog reference. */
export function createSystemPrompt(): string {
  createSystem ??= `${SAFETY}

Your job now: turn the request of the person into a small, working Rublox app. Answer with the JSON structure you are given. Keep the app small and readable for a beginner: one to three screens, a handful of components, short stacks of blocks. Write every text of the app (button labels, messages, names) in the language of the person. Lay out screens nicely (padding, gap, alignItems on the screen; Row and Column to group; sizes of text). Every component, property, event, method and block you use must exist in the reference below; use component, screen and variable NAMES in block fields. Event blocks are top blocks; an app starts on its first screen; use "stored" variables for what must be kept on the phone. Test in your head: every block must do something sensible when the app runs.

${catalogReference()}`
  return createSystem
}

export function createUserPrompt(input: { request: string; locale: Locale; mode: UiMode }) {
  return `Language of the person and of the app: ${LANGUAGE[input.locale]}.
Mode: ${input.mode} (${input.mode === 'junior' ? 'keep it very simple' : 'can be a bit richer'}).

Request of the person:
"""
${input.request}
"""`
}

export function repairPrompt(previous: string, issues: string[]) {
  return `Your previous answer could not be built. The problems were:
${issues.map((issue) => `- ${issue}`).join('\n')}

Your previous answer was:
${previous}

Write the whole answer again, fixed.`
}

// ---- Explain and debug ------------------------------------------------------------------

let helpSystem: string | undefined

/** System prompt of "Explain" and "Why doesn't it work?": rules and reference. */
export function helpSystemPrompt(): string {
  helpSystem ??= `${SAFETY}

Your job now: help the person understand their app and their blocks. You receive blocks as Blockly JSON (where fields COMPONENT, SCREEN and VAR already hold names) and sometimes the console of the app. Explain what the blocks DO when the app runs, in plain words, by naming the blocks as they read in Rublox ("when Button1 is clicked", "set Text1's text to"), never as JSON or code unless the person uses Studio mode and code helps. Do not invent blocks that are not there. When something is wrong, say what happens, why, and what to change, in small steps the person can do themself; do not do it for them.

${catalogReference()}`
  return helpSystem
}

export type ExplainTarget = 'block' | 'stack' | 'screen'

export function explainUserPrompt(input: {
  target: ExplainTarget
  locale: Locale
  mode: UiMode
  context: string
}) {
  const what = {
    block: 'this one block (the first block of the JSON; the rest is only context)',
    stack: 'this stack of blocks',
    screen: 'this screen: its components and all its blocks',
  }[input.target]
  return `Answer in ${LANGUAGE[input.locale]}. ${audience(input.mode)}
Explain ${what}.

${input.context}`
}

export const debugAnswerSchema = z.object({
  answer: z
    .string()
    .describe('What goes wrong, why, and what to change: short paragraphs or a short list'),
  blockIds: z
    .array(z.string())
    .describe('Ids ("id" in the JSON) of the blocks the answer talks about, at most 3'),
})

export type DebugAnswer = z.infer<typeof debugAnswerSchema>

export function debugUserPrompt(input: {
  locale: Locale
  mode: UiMode
  question: string
  context: string
  console: string
}) {
  return `Answer in ${LANGUAGE[input.locale]}. ${audience(input.mode)}
The person asks: "Why doesn't it work?"${input.question ? ` They add: """${input.question}"""` : ''}

Console of the app (most recent last):
${input.console || '(empty)'}

${input.context}`
}

// ---- The AI component of apps ------------------------------------------------------------

const APP_SYSTEM = `${SAFETY}

Your job now: you are the "AI" component of an app built with Rublox. The app sends you a request written by its maker (or typed by the person using the app). Answer only with the text the app should show: no preamble, no Markdown, short (at most about 120 words unless the request asks for a precise length). Answer in the language of the request.`

export function appSystemPrompt(): string {
  return APP_SYSTEM
}
