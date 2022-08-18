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
    - [AudioWorklet & Safari](#audioworklet---safari)
  - [Installation](#installation)
  - [How to use](#how-to-use)
    - [Via ES Modules (Create React App, Angular, Webpack, etc.)](#via-es-modules--create-react-app--angular--webpack--etc-)
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
- 'Worker' (required for downsampler and for all engine processing)

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

Get the WebVoiceProcessor with the `instance` async static method. This will return the singleton instance:

```javascript
let options = {
  frameLength: 512,
  outputSampleRate: 16000,
  deviceId: null,
  filterOrder: 50,
  vuMeterCallback: undefined,
}; // optional options

let handle = await WebVoiceProcessor.WebVoiceProcessor.instance(options);
```

WebVoiceProcessor follows the subscribe/unsubscribe pattern. Every engine that is subscribed will be receiving audio
frames as soon as it is ready:

```javascript
const worker = new Worker('${WORKER_PATH}');
const engine = {
  onmessage: function(e) {
    /// ... handle inputFrame
  }
}

handle.subscribe(engine);
handle.subscribe(worker);

handle.unsubscribe(engine);
handle.unsubscribe(worker);
```

An `engine` is either a [Web Workers](<(https://developer.mozilla.org/en-US/docs/Web/API/Worker)>) or an object
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

For examples of using engines, look at [src/engines](/package/src/engines).

To start recording, call `start` after getting the instance. This will start the Audio Context, get microphone permissions
and start recording.

```javascript
await handle.start();
```

This is async due to its [Web Audio API microphone request](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). The promise will be rejected if the user refuses permission, no suitable devices are found, etc. Your calling code should anticipate the possibility of rejection. When the promise resolves, the WebVoiceProcessor is running.

### Pause listening

Pause processing (microphone and Web Audio context will still be active):

```javascript
await handle.pause();
```

### Stop Listening

Close the microphone [MediaStream](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream). This will free all
used resources including microphone's resources and audio context.

```javascript
await handle.stop();
```

### Options

To update the audio settings in `WebVoiceProcessor`, call the `instance` function with new `options`. 
Then call `stop`, and `start` so it can start recording audio with the new settings.
This step is required since the `audioContext` has to be recreated to reflect the changes.

### VuMeter

`WebVoiceProcessor` includes a built-in engine which returns the [VU meter](https://en.wikipedia.org/wiki/VU_meter).
To capture the VU meter value, create a callback and pass it in the `options` parameter:

```javascript
function vuMeterCallback(dB) {
  console.log(dB)
}

const handle = await window.WebVoiceProcessor.WebVoiceProcessor.instance({vuMeterCallback});
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
