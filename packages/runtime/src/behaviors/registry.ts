import { aiBehavior } from './ai.ts'
import {
  canvasBehavior,
  dataGridBehavior,
  dataListBehavior,
  listViewBehavior,
  lottieBehavior,
  soundBehavior,
  timerBehavior,
  videoBehavior,
  webViewBehavior,
} from './basic.ts'
import { chartBehavior, googleSheetBehavior, mapBehavior } from './data-behaviors.ts'
import {
  audioRecorderBehavior,
  cameraBehavior,
  cameraViewBehavior,
  clipboardBehavior,
  notifierBehavior,
  photoPickerBehavior,
  qrScannerBehavior,
  shareBehavior,
  speechRecognitionBehavior,
  textToSpeechBehavior,
  vibratorBehavior,
} from './device-behaviors.ts'
import { batteryBehavior, locationBehavior, motionBehavior, networkBehavior } from './sensors.ts'
import { textInputBehavior } from './text-input.ts'
import type { Behavior } from './types.ts'

/**
 * How each component type behaves while the app runs (SPEC § 6.3), next to its rendering in
 * `RENDERERS`. Types that only show their properties have none.
 */
export const BEHAVIORS: Record<string, Behavior> = {
  TextInput: textInputBehavior,
  ListView: listViewBehavior,
  DataList: dataListBehavior,
  DataGrid: dataGridBehavior,
  Video: videoBehavior,
  Lottie: lottieBehavior,
  WebView: webViewBehavior,
  CameraView: cameraViewBehavior,
  Canvas: canvasBehavior,
  Location: locationBehavior,
  Motion: motionBehavior,
  Battery: batteryBehavior,
  Network: networkBehavior,
  Timer: timerBehavior,
  Sound: soundBehavior,
  AudioRecorder: audioRecorderBehavior,
  TextToSpeech: textToSpeechBehavior,
  SpeechRecognition: speechRecognitionBehavior,
  Vibrator: vibratorBehavior,
  Camera: cameraBehavior,
  PhotoPicker: photoPickerBehavior,
  Share: shareBehavior,
  Clipboard: clipboardBehavior,
  Notifier: notifierBehavior,
  QrScanner: qrScannerBehavior,
  Map: mapBehavior,
  Chart: chartBehavior,
  GoogleSheet: googleSheetBehavior,
  AI: aiBehavior,
}
