import { isValidName } from '@rublox/schema'

/**
 * A JavaScript string literal for any text: quotes, backslashes, line breaks, `</script>`,
 * `${…}` and invisible characters all stay inside the string.
 */
export function quote(text: string): string {
  let out = "'"
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (char === '\\') out += '\\\\'
    else if (char === "'") out += "\\'"
    else if (char === '\n') out += '\\n'
    else if (char === '\r') out += '\\r'
    else if (char === '\t') out += '\\t'
    else if (
      code < 0x20 ||
      code === 0x7f ||
      code === 0x2028 ||
      code === 0x2029 ||
      (code >= 0xe000 && code <= 0xf8ff) ||
      (code >= 0xd800 && code <= 0xdfff)
    ) {
      out += `\\u${code.toString(16).padStart(4, '0')}`
    } else out += char
  }
  return `${out}'`
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** `app.score`, or `app['mon score']` when the name is not an identifier. */
export function member(object: string, name: string): string {
  return isValidName(name) || /^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(name)
    ? `${object}.${name}`
    : `${object}[${quote(name)}]`
}
