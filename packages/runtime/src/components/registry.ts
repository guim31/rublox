import { ButtonRenderer } from './button.tsx'
import { ColumnRenderer, RowRenderer, ScreenRenderer } from './containers.tsx'
import { ImageRenderer } from './image.tsx'
import { TextRenderer } from './text.tsx'
import { TextInputRenderer } from './text-input.tsx'
import type { Renderer } from './types.ts'

/** The React rendering of each catalog type (SPEC § 6.3). A test checks none is missing. */
export const RENDERERS: Record<string, Renderer> = {
  Screen: ScreenRenderer,
  Row: RowRenderer,
  Column: ColumnRenderer,
  Button: ButtonRenderer,
  Text: TextRenderer,
  TextInput: TextInputRenderer,
  Image: ImageRenderer,
}
