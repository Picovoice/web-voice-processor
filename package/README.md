# Web Voice Processor

[![GitHub release](https://img.shields.io/github/release/Picovoice/web-voice-processor.svg)](https://github.com/Picovoice/web-voice-processor/releases)

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

A library for real-time voice processing in web browsers.

- Uses the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) to access microphone audio.
- Leverages [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Worker) to offload compute-intensive tasks off of the main thread.
- Converts the microphone sampling rate to 16kHz, the _de facto_ standard for voice processing engines.
- Provides a flexible interface to pass in arbitrary voice processing workers.

- [Web Voice Processor](#web-voice-processor)
  - [Browser compatibility](#browser-compatibility)
    - [Browser features](#browser-features)
    - [AudioWorklet & Safari](#audioworklet--safari)
  - [Installation](#installation)
  - [How to use](#how-to-use)
    - [Via ES Modules (Create React App, Angular, Webpack, etc.)](#via-es-modules-create-react-app-angular-webpack-etc)
    - [Via HTML script tag](#via-html-script-tag)
    - [Start listening](#start-listening)
    - [Stop listening](#stop-listening)
  - [Build from source](#build-from-source)

## Browser compatibility

All modern browsers (Chrome/Edge/Opera, Firefox, Safari) are supported, including on mobile. Internet Explorer is _not_ supported.

Using the Web Audio API requires a secure context (HTTPS connection), with the exception of `localhost`, for local development.

This library includes the utility function `browserCompatibilityCheck` which can be used to perform feature detection on the current browser and return an object
indicating browser capabilities.

ESM:

```javascript
import { browserCompatibilityCheck } from '@picovoice/web-voice-processor';
browserCompatibilityCheck();
```

IIFE:

```javascript
window.WebVoiceProcessor.browserCompatibilityCheck();
```

### Browser features

- '\_picovoice' : whether all Picovoice requirements are met
- 'AudioWorklet' (not currently used; intended for the future)
- 'isSecureContext' (required for microphone permission for non-localhost)
- 'mediaDevices' (basis for microphone enumeration / access)
- 'WebAssembly' (required for all Picovoice engines)
- 'webKitGetUserMedia' (legacy predecessor to getUserMedia)
- 'Worker' (required for downsampling and for all engine processing)

### AudioWorklet & Safari

This library does _not_ use the modern [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet) due to lack of support in Safari and Safari Mobile.

## Installation

```console
npm install @picovoice/web-voice-processor
```

(or)

```console
yarn add @picovoice/web-voice-processor
```

## How to use

### Via ES Modules (Create React App, Angular, Webpack, etc.)

```javascript
import { WebVoiceProcessor } from '@picovoice/web-voice-processor';
```

### Via HTML script tag

Add the following to your HTML:

```html
<script src="@picovoice/web-voice-processor/dist/iife/index.min.js"></script>
```

The IIFE version of the library adds `WebVoiceProcessor` to the `window` global scope.

### Start listening

Start up the WebVoiceProcessor with the `init` async static factory method:

```javascript
let engines = []; // list of voice processing web workers (see below)
let handle = await WebVoiceProcessor.WebVoiceProcessor.init({
  engines: engines,
});
```

This is async due to its [Web Audio API microphone request](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). The promise will be rejected if the user refuses permission, no suitable devices are found, etc. Your calling code should anticipate the possibility of rejection. When the promise resolves, the WebVoiceProcessor instance is ready.

`engines` is an array of voice processing [Web Workers](<(https://developer.mozilla.org/en-US/docs/Web/API/Worker)>)
implementing the following interface within their `onmessage` method:

```javascript
onmessage = function (e) {
    switch (e.data.command) {

        ...

        case 'process':
            process(e.data.inputFrame);
            break;

        ...

    }
};
```

where `e.data.inputFrame` is an `Int16Array` of 512 audio samples.

If you wish to initialize a new WebVoiceProcessor, and not immediately start listening, include `start: false` in the init options object argument; then call `start()` on the instance when ready.

```javascript
const handle = await WebVoiceProcessor.WebVoiceProcessor.init({
  engines: engines,
  start: false,
});
handle.start();
```

### Stop listening

Pause/Resume processing (microphone and Web Audio context will still be active):

```javascript
handle.pause();
handle.resume();
```

Close the microphone [MediaStream](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream) and release resources:

```javascript
handle.release();
```

This method is async as it is closing the [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) internally.

## Build from source

Use `yarn` or `npm` to build WebVoiceProcessor:

```console
yarn
yarn build
```

(or)

```console
npm install
npm run-script build
```

The build script outputs minified and non-minified versions of the IIFE and ESM formats to the `dist` folder. It also will output the TypeScript type definitions.
