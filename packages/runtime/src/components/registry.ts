import { ButtonRenderer } from './button.tsx'
import { CanvasRenderer } from './canvas.tsx'
import {
  BoxRenderer,
  ColumnRenderer,
  DividerRenderer,
  GridRenderer,
  RowRenderer,
  ScreenRenderer,
  SpacerRenderer,
} from './containers.tsx'
import {
  ProgressBarRenderer,
  QrCodeRenderer,
  RichTextRenderer,
  SpinnerRenderer,
} from './display.tsx'
import { GameSceneRenderer, JoystickRenderer, SceneTextRenderer, SpriteRenderer } from './game.tsx'
import { IconRenderer } from './icon.tsx'
import { ImageRenderer } from './image.tsx'
import {
  CheckboxRenderer,
  DatePickerRenderer,
  DropdownRenderer,
  RatingRenderer,
  SliderRenderer,
  SwitchRenderer,
  TimePickerRenderer,
} from './inputs.tsx'
import { DataGridRenderer, DataListRenderer, ListViewRenderer } from './lists.tsx'
import { CameraViewRenderer, LottieRenderer, VideoRenderer, WebViewRenderer } from './media.tsx'
import { NonVisualRenderer } from './non-visual.tsx'
import { TextRenderer } from './text.tsx'
import { TextInputRenderer } from './text-input.tsx'
import type { Renderer } from './types.ts'

/** The React rendering of each catalog type (SPEC § 6.3). A test checks none is missing. */
export const RENDERERS: Record<string, Renderer> = {
  Screen: ScreenRenderer,
  Row: RowRenderer,
  Column: ColumnRenderer,
  Box: BoxRenderer,
  Grid: GridRenderer,
  Spacer: SpacerRenderer,
  Divider: DividerRenderer,
  Button: ButtonRenderer,
  Text: TextRenderer,
  TextInput: TextInputRenderer,
  Image: ImageRenderer,
  Icon: IconRenderer,
  Checkbox: CheckboxRenderer,
  Switch: SwitchRenderer,
  Slider: SliderRenderer,
  Dropdown: DropdownRenderer,
  DatePicker: DatePickerRenderer,
  TimePicker: TimePickerRenderer,
  Rating: RatingRenderer,
  ProgressBar: ProgressBarRenderer,
  Spinner: SpinnerRenderer,
  RichText: RichTextRenderer,
  QrCode: QrCodeRenderer,
  ListView: ListViewRenderer,
  DataList: DataListRenderer,
  DataGrid: DataGridRenderer,
  Video: VideoRenderer,
  Lottie: LottieRenderer,
  WebView: WebViewRenderer,
  CameraView: CameraViewRenderer,
  Canvas: CanvasRenderer,
  // Non-visual components: listed under the screen in the editor, nothing in the app.
  Location: NonVisualRenderer,
  Motion: NonVisualRenderer,
  Battery: NonVisualRenderer,
  Network: NonVisualRenderer,
  Timer: NonVisualRenderer,
  Sound: NonVisualRenderer,
  AudioRecorder: NonVisualRenderer,
  TextToSpeech: NonVisualRenderer,
  SpeechRecognition: NonVisualRenderer,
  Vibrator: NonVisualRenderer,
  Camera: NonVisualRenderer,
  PhotoPicker: NonVisualRenderer,
  Share: NonVisualRenderer,
  Clipboard: NonVisualRenderer,
  Notifier: NonVisualRenderer,
  QrScanner: NonVisualRenderer,
  GameScene: GameSceneRenderer,
  Sprite: SpriteRenderer,
  SceneText: SceneTextRenderer,
  Joystick: JoystickRenderer,
}
