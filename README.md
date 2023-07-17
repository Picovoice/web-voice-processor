# Web Voice Processor

[![GitHub release](https://img.shields.io/github/release/Picovoice/web-voice-processor.svg)](https://github.com/Picovoice/web-voice-processor/releases)
[![GitHub](https://img.shields.io/github/license/Picovoice/web-voice-processor)](https://github.com/Picovoice/web-voice-processor/releases)
[![npm](https://img.shields.io/npm/v/@picovoice/web-voice-processor?label=npm%20%5Bweb%5D)](https://www.npmjs.com/package/@picovoice/web-voice-processor)

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

A library for real-time voice processing in web browsers.

- Uses the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) to access microphone audio.
- Leverages [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Worker) to offload compute-intensive tasks off of the main thread.
- Converts the microphone sampling rate to 16kHz, the _de facto_ standard for voice processing engines.
- Provides a flexible interface to pass in arbitrary voice processing workers.

- [Web Voice Processor](#web-voice-processor)
  - [Browser compatibility](#browser-compatibility)
    - [Browser features](#browser-features)
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
- 'Worker' (required for resampler and for all engine processing)

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
<script src="@picovoice/web-voice-processor/dist/iife/index.js"></script>
```

The IIFE version of the library adds `WebVoiceProcessor` to the `window` global scope.

### Start listening

WebVoiceProcessor follows the subscribe/unsubscribe pattern. WebVoiceProcessor
will automatically start recording audio as soon as an engine is subscribed.

```javascript
const worker = new Worker('${WORKER_PATH}');
const engine = {
  onmessage: function(e) {
    /// ... handle inputFrame
  }
}

await WebVoiceProcessor.subscribe(engine);
await WebVoiceProcessor.subscribe(worker);
// or
await WebVoiceProcessor.subscribe([engine, worker]);
```

An `engine` is either a [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Worker) or an object
implementing the following interface within their `onmessage` method:

```javascript
onmessage = function (e) {
    switch (e.data.command) {
        case 'process':
            process(e.data.inputFrame);
            break;
    }
};
```

where `e.data.inputFrame` is an `Int16Array` of `frameLength` audio samples.

For examples of using engines, look at [src/engines](src/engines).

This is async due to its [Web Audio API microphone request](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). The promise will be rejected if the user refuses permission, no suitable devices are found, etc. Your calling code should anticipate the possibility of rejection. When the promise resolves, the WebVoiceProcessor is running.

### Stop Listening

Unsubscribing the engines initially subscribed will stop audio recorder.

```javascript
await WebVoiceProcessor.unsubscribe(engine);
await WebVoiceProcessor.unsubscribe(worker);
//or
await WebVoiceProcessor.unsubscribe([engine, worker]);
```

### Reset

Use the `reset` function to remove all engines and stop recording audio.

```javascript
await WebVoiceProcessor.reset();
```

### Options

To update the audio settings in `WebVoiceProcessor`, use the `setOptions` function:

```javascript
// Override default options
let options = {
  frameLength: 512,
  outputSampleRate: 16000,
  deviceId: null,
  filterOrder: 50
};

WebVoiceProcessor.setOptions(options);
```

### VuMeter

`WebVoiceProcessor` includes a built-in engine which returns the [VU meter](https://en.wikipedia.org/wiki/VU_meter).
To capture the VU meter value, create a VuMeterEngine instance and subscribe it to the engine:

```javascript
function vuMeterCallback(dB) {
  console.log(dB)
}

const vuMeterEngine = new VuMeterEngine(vuMeterCallback);
WebVoiceProcessor.subscribe(vuMeterEngine);
```

The `vuMeterCallback` should expected a number in terms of [dBFS](https://en.wikipedia.org/wiki/DBFS) within the range of [-96, 0].

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
