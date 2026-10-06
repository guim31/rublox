import { CATEGORY_COLORS } from '@rublox/blocks/colors'
import { getComponentDef } from '@rublox/catalog'
import {
  Box,
  Columns3,
  Image,
  type LucideIcon,
  Rows3,
  Smartphone,
  SquareMousePointer,
  TextCursorInput,
  Type,
} from 'lucide-react'

/**
 * Lucide icons named by the catalog (`icon`). Imported one by one to keep the bundle small:
 * a new component type adds its icon here.
 */
const ICONS: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  'columns-3': Columns3,
  'rows-3': Rows3,
  'square-mouse-pointer': SquareMousePointer,
  type: Type,
  'text-cursor-input': TextCursorInput,
  image: Image,
}

export function ComponentIcon({
  type,
  size = 16,
  className,
}: {
  type: string
  size?: number
  className?: string
}) {
  const Icon = ICONS[getComponentDef(type)?.icon ?? ''] ?? Box
  return <Icon size={size} className={className} aria-hidden="true" />
}

export const COMPONENT_COLOR = CATEGORY_COLORS.components
