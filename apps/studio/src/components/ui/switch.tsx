import { Switch as Radix } from 'radix-ui'
import { cn } from '../../lib/cn.ts'

export function Switch({
  checked,
  onChange,
  label,
  id,
  className,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  id?: string
  className?: string
  disabled?: boolean
}) {
  return (
    <Radix.Root
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      aria-label={label}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center disabled:cursor-not-allowed disabled:opacity-50 rounded-full bg-surface-3 transition-colors data-[state=checked]:bg-primary junior:h-7 junior:w-12',
        className,
      )}
    >
      <Radix.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-1 transition-transform data-[state=checked]:translate-x-[18px] junior:size-6 junior:data-[state=checked]:translate-x-[22px]" />
    </Radix.Root>
  )
}
