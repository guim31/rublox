import { CATEGORY_COLORS } from '@rublox/blocks/colors'
import { getComponentDef } from '@rublox/catalog'
import {
  AudioLines,
  Battery,
  Bell,
  Box,
  Brush,
  Calendar,
  Camera,
  Clipboard as ClipboardIcon,
  Clock,
  Columns3,
  FileText,
  Globe,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  ListCollapse,
  List as ListIcon,
  ListVideo,
  Loader,
  LoaderCircle,
  type LucideIcon,
  MapPin,
  Mic,
  Minus,
  Move3d,
  MoveVertical,
  Music,
  QrCode,
  Rows3,
  ScanLine,
  Share2,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Speech,
  SquareCheck,
  SquareDashed,
  SquareMousePointer,
  Star,
  StarHalf,
  TextCursorInput,
  Timer,
  ToggleRight,
  Type,
  Vibrate,
  Video as VideoIcon,
  Wifi,
} from 'lucide-react'

/**
 * Lucide icons named by the catalog (`icon`). Imported one by one to keep the bundle small:
 * a new component type adds its icon here.
 */
const ICONS: Record<string, LucideIcon> = {
  'audio-lines': AudioLines,
  battery: Battery,
  bell: Bell,
  brush: Brush,
  calendar: Calendar,
  camera: Camera,
  clipboard: ClipboardIcon,
  clock: Clock,
  'columns-3': Columns3,
  'file-text': FileText,
  globe: Globe,
  image: ImageIcon,
  images: Images,
  'layout-grid': LayoutGrid,
  list: ListIcon,
  'list-collapse': ListCollapse,
  'list-video': ListVideo,
  loader: Loader,
  'loader-circle': LoaderCircle,
  'map-pin': MapPin,
  mic: Mic,
  minus: Minus,
  'move-3d': Move3d,
  'move-vertical': MoveVertical,
  music: Music,
  'qr-code': QrCode,
  'rows-3': Rows3,
  'scan-line': ScanLine,
  'share-2': Share2,
  'sliders-horizontal': SlidersHorizontal,
  smartphone: Smartphone,
  sparkles: Sparkles,
  speech: Speech,
  'square-check': SquareCheck,
  'square-dashed': SquareDashed,
  'square-mouse-pointer': SquareMousePointer,
  star: Star,
  'star-half': StarHalf,
  'text-cursor-input': TextCursorInput,
  timer: Timer,
  'toggle-right': ToggleRight,
  type: Type,
  vibrate: Vibrate,
  video: VideoIcon,
  wifi: Wifi,
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
