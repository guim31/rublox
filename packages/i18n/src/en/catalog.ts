import type { Messages } from '../types.ts'

export const catalog: Messages['catalog'] = {
  studio: {
    list: {
      linesHint: 'One item per line.',
      item: 'Item {{n}}',
      up: 'Move up',
      down: 'Move down',
      remove: 'Remove this item',
      add: 'Add an item',
      noImage: 'No image',
      fields: { title: 'Title', subtitle: 'Subtitle', image: 'Image', button: 'Button' },
    },
    icon: { none: 'No icon', search: 'Search an icon', choose: 'Icons' },
    asset: {
      none: 'No file',
      url: 'or an https: address',
      tooBig: 'This file is too heavy.',
      upload: {
        image: 'Upload an image',
        sound: 'Upload a sound',
        video: 'Upload a video',
        lottie: 'Upload a Lottie animation (.json)',
      },
      wrongKind: {
        image: 'This file is not an image.',
        sound: 'This file is not a sound.',
        video: 'This file is not a video.',
        lottie: 'This file is not a Lottie animation (.json).',
      },
    },
  },
  runtime: {
    storageFull: 'Stored variables cannot be kept on this device (storage full or blocked).',
    unavailable: 'This browser cannot do this: {{feature}}.',
    denied:
      'You refused access to {{what}}. To allow it, open the browser settings for this site, then try again.',
    failed: 'That did not work: {{message}}',
    noSource: 'First choose a file in the inspector.',
    what: {
      camera: 'the camera',
      microphone: 'the microphone',
      location: 'your location',
      motion: 'the phone’s motion',
      notifications: 'notifications',
      clipboard: 'the clipboard',
    },
    scanner: {
      title: 'Point at a QR code',
      cancel: 'Cancel',
      starting: 'Opening the camera…',
    },
    camera: {
      off: 'Camera off',
    },
    lottie: 'Animation',
    web: 'Web page',
    webHint: 'An https:// address will show here.',
    video: 'Video',
    noItems: 'No items',
    choose: 'Choose…',
    tabs: 'Navigation',
    menu: 'Menu',
    closeMenu: 'Close the menu',
  },
  blocks: {
    appCall: 'call function',
    appCallValue: 'result of function',
    appCallTooltip: 'Runs a function of the "App" workspace: every screen shares it.',
    missingFunction: 'function not found in the App workspace',
    appFunctions: 'App functions',
    noAppFunctions:
      'Create a function in the "App" workspace (screen picker) to use it on every screen.',
    createVariable: 'Create a variable',
    createStoredVariable: 'Create a stored variable',
    appVariables: 'App variables (reset when the app starts)',
    storedVariables: 'Stored variables (kept on the phone)',
    storedPrompt: 'Name of the new stored variable:',
    nameTaken: 'This name is taken or not valid: choose another one.',
    eventValue: 'event value %1',
    eventValueTooltip:
      'What the event brings (the item tapped, the new value…). Use it inside the "when…" block that provides it.',
    eventValueOutside: 'Put this block inside a "when…" block that provides this value.',
  },
}
