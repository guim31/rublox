import { Star } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { cssColor } from '../theme.ts'
import { type Renderer, type RendererProps, rootAttributes } from './types.ts'

function fontSize(p: RendererProps, fallback = 16): number {
  return Number(p.props.fontSize) || fallback
}

/** A labelled box (checkbox or switch). */
function Toggle({
  p,
  type,
  field: key,
}: {
  p: RendererProps
  type: 'Checkbox' | 'Switch'
  field: 'checked' | 'on'
}) {
  const id = useId()
  const value = p.props[key] === true
  const color = cssColor(p.props.color) ?? 'var(--rx-primary)'
  const disabled = p.props.disabled === true
  return (
    <div
      {...rootAttributes(p, type)}
      className="rx-toggle"
      style={{ fontSize: fontSize(p), opacity: disabled ? 0.5 : undefined, ...p.style }}
    >
      <input
        id={id}
        type="checkbox"
        role={type === 'Switch' ? 'switch' : undefined}
        className={type === 'Switch' ? 'rx-switch' : 'rx-checkbox'}
        checked={value}
        disabled={disabled}
        readOnly={p.design}
        tabIndex={p.design ? -1 : undefined}
        style={{ '--rx-accent': color } as React.CSSProperties}
        onChange={(event) => {
          if (p.design) return
          p.setValue(key, event.target.checked)
          p.emit('change', { [key]: event.target.checked })
        }}
      />
      <label htmlFor={id}>{String(p.props.text ?? '')}</label>
    </div>
  )
}

export const CheckboxRenderer: Renderer = (p) => <Toggle p={p} type="Checkbox" field="checked" />
export const SwitchRenderer: Renderer = (p) => <Toggle p={p} type="Switch" field="on" />

export const SliderRenderer: Renderer = (p) => {
  const min = Number(p.props.min) || 0
  const max = Number.isFinite(Number(p.props.max)) ? Number(p.props.max) : 100
  const value = Math.min(
    Math.max(Number(p.props.value) || 0, Math.min(min, max)),
    Math.max(min, max),
  )
  return (
    <div {...rootAttributes(p, 'Slider')} className="rx-slider" style={p.style}>
      <input
        type="range"
        aria-label={p.name}
        min={min}
        max={max}
        step={Number(p.props.step) || 'any'}
        value={value}
        disabled={p.props.disabled === true}
        readOnly={p.design}
        tabIndex={p.design ? -1 : undefined}
        style={
          {
            '--rx-accent': cssColor(p.props.color) ?? 'var(--rx-primary)',
            '--rx-fill': `${max > min ? ((value - min) / (max - min)) * 100 : 0}%`,
          } as React.CSSProperties
        }
        onChange={(event) => {
          if (p.design) return
          const next = Number(event.target.value)
          p.setValue('value', next)
          p.emit('change', { value: next })
        }}
      />
    </div>
  )
}

export const DropdownRenderer: Renderer = (p) => {
  const options = Array.isArray(p.props.options) ? p.props.options.map(String) : []
  const selected = String(p.props.selected ?? '')
  const index = options.indexOf(selected) + 1
  // Keep "selected position" in step with "selected", whoever changed it (a block, a tap).
  const setValue = useRef(p.setValue)
  setValue.current = p.setValue
  const { design } = p
  useEffect(() => {
    if (!design) setValue.current('selectedIndex', index)
  }, [design, index])
  return (
    <div
      {...rootAttributes(p, 'Dropdown')}
      className="rx-field"
      style={{ background: 'var(--rx-background)', ...p.style }}
    >
      <select
        className="rx-field-input rx-select"
        aria-label={String(p.props.placeholder || p.name)}
        value={index ? selected : ''}
        disabled={p.props.disabled === true}
        tabIndex={p.design ? -1 : undefined}
        style={{ fontSize: fontSize(p) }}
        onChange={(event) => {
          if (p.design) return
          const value = event.target.value
          p.setValue('selected', value)
          p.emit('change', { value, index: options.indexOf(value) + 1 })
        }}
      >
        <option value="" disabled>
          {String(p.props.placeholder ?? '')}
        </option>
        {options.map((option, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: options may repeat
          <option key={i} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

function Picker(p: RendererProps, type: 'DatePicker' | 'TimePicker') {
  return (
    <div
      {...rootAttributes(p, type)}
      className="rx-field"
      style={{ background: 'var(--rx-background)', ...p.style }}
    >
      <input
        type={type === 'DatePicker' ? 'date' : 'time'}
        className="rx-field-input"
        aria-label={p.name}
        value={String(p.props.value ?? '')}
        min={type === 'DatePicker' ? String(p.props.min ?? '') || undefined : undefined}
        max={type === 'DatePicker' ? String(p.props.max ?? '') || undefined : undefined}
        disabled={p.props.disabled === true}
        readOnly={p.design}
        tabIndex={p.design ? -1 : undefined}
        style={{ fontSize: fontSize(p) }}
        onChange={(event) => {
          if (p.design) return
          p.setValue('value', event.target.value)
          p.emit('change', { value: event.target.value })
        }}
      />
    </div>
  )
}

export const DatePickerRenderer: Renderer = (p) => Picker(p, 'DatePicker')
export const TimePickerRenderer: Renderer = (p) => Picker(p, 'TimePicker')

export const RatingRenderer: Renderer = (p) => {
  const max = Math.max(1, Math.round(Number(p.props.max) || 5))
  const value = Math.round(Number(p.props.value) || 0)
  const size = Number(p.props.size) || 32
  const color = cssColor(p.props.color) ?? '#f5b400'
  const readOnly = p.design || p.props.readOnly === true
  return (
    <fieldset
      {...rootAttributes(p, 'Rating')}
      aria-label={p.name}
      className="rx-rating"
      style={p.style}
    >
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1
        return (
          <button
            key={n}
            type="button"
            aria-pressed={n <= value}
            aria-label={`${n} / ${max}`}
            tabIndex={p.design ? -1 : undefined}
            disabled={readOnly && !p.design}
            onClick={() => {
              if (readOnly) return
              const next = n === value ? 0 : n
              p.setValue('value', next)
              p.emit('change', { value: next })
            }}
          >
            <Star
              size={size}
              color={color}
              fill={n <= value ? color : 'none'}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </button>
        )
      })}
    </fieldset>
  )
}
