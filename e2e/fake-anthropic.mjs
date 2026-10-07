// A fake Claude API (Messages) for the end-to-end tests: the AI server of
// `playwright.config.ts` points `ANTHROPIC_BASE_URL` here, so that the real SDK code path runs
// without any key nor network. It answers from fixtures, according to the system prompt.
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'

const port = Number(process.argv[2] ?? 4329)
const create = readFileSync(new URL('./fixtures/ai-create.json', import.meta.url), 'utf8')

/** Answers kept short: the studio shows them in its panel. */
function answer(body) {
  const system = (body.system ?? []).map((block) => block.text ?? '').join('\n')
  const prompt = JSON.stringify(body.messages ?? [])
  if (system.includes('turn the request of the person into a small, working Rublox app')) {
    return create
  }
  if (system.includes('component of an app built with Rublox')) {
    return prompt.includes('blague')
      ? 'Pourquoi les chats aiment-ils les ordinateurs ? Pour la souris !'
      : 'Bonjour !'
  }
  if (prompt.includes('Why doesn') || prompt.includes('doesn’t it work')) {
    return JSON.stringify({
      answer:
        'Le bouton « Tirer » change bien le texte, mais la liste des prénoms est vide.\n\n- Écris des prénoms séparés par des virgules.\n- Touche le bouton à nouveau.',
      blockIds: [],
    })
  }
  return 'Quand on touche le bouton « Tirer », l’appli choisit un prénom au hasard dans la liste et l’affiche en grand.'
}

createServer((request, response) => {
  if (request.method !== 'POST' || !request.url?.startsWith('/v1/messages')) {
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(
      JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'not found' } }),
    )
    return
  }
  let raw = ''
  request.on('data', (chunk) => {
    raw += chunk
  })
  request.on('end', () => {
    const body = JSON.parse(raw || '{}')
    const text = answer(body)
    response.writeHead(200, { 'content-type': 'application/json', 'request-id': 'req_fake' })
    response.end(
      JSON.stringify({
        id: `msg_fake_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        model: body.model,
        content: [{ type: 'text', text }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 1200,
          output_tokens: Math.ceil(text.length / 4),
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      }),
    )
  })
}).listen(port, '127.0.0.1', () => {
  console.log(`fake Claude API on http://127.0.0.1:${port}`)
})
