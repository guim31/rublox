import { useMemo, useRef } from 'react'
import type { FocusHandle } from '../behaviors/text-input.ts'
import { type Renderer, rootAttributes, useExpose } from './types.ts'

const INPUT_TYPES = {
  text: 'text',
  password: 'password',
  number: 'text',
  email: 'email',
} as const

export const TextInputRenderer: Renderer = (p) => {
  const kind = String(p.props.inputType ?? 'text')
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const handle = useMemo<FocusHandle>(() => ({ focus: () => field.current?.focus() }), [])
  useExpose(p, handle)
  const common = {
    ref: field,
    value: String(p.props.text ?? ''),
    placeholder: String(p.props.placeholder ?? ''),
    disabled: p.props.disabled === true,
    readOnly: p.design,
    tabIndex: p.design ? -1 : undefined,
    'aria-label': String(p.props.placeholder || p.name),
    className: 'rx-input-field',
    style: { fontSize: Number(p.props.fontSize) || 16 },
    onChange: (event: { target: { value: string } }) => {
      p.setValue('text', event.target.value)
      p.emit('change')
    },
  }
  return (
    <div
      {...rootAttributes(p, 'TextInput')}
      className="rx-input"
      style={{ background: 'var(--rx-background)', ...p.style }}
    >
      {kind === 'multiline' ? (
        <textarea rows={3} {...common} />
      ) : (
        <input
          {...common}
          type={INPUT_TYPES[kind as keyof typeof INPUT_TYPES] ?? 'text'}
          inputMode={kind === 'number' ? 'decimal' : undefined}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !p.design) p.emit('submit')
          }}
        />
      )}
    </div>
  )
}
