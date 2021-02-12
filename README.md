# Web Voice Processor

[![GitHub release](https://img.shields.io/github/release/Picovoice/web-voice-processor.svg)](https://github.com/Picovoice/web-voice-processor/releases)

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

This is a library for real-time voice processing in web browsers.

- Uses the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) to access microphone audio.
- Leverages [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Worker) to offload compute-intensive tasks off of the main thread.
- Converts the microphone sampling rate to 16kHz, the _de facto_ standard for voice processing engines.
- Provides a flexible interface to pass in arbitrary voice processing workers.

## Browser compatibility

All modern browsers (Chrome/Edge/Opera, Firefox, Safari) are supported, including on mobile. Internet Explorer is _not_ supported.

Using the Web Audio API requires a secure context (HTTPS connection), with the exception of `localhost`, for local development.

This library includes the static method `browserCompatibilityCheck` which can be used to perform feature detection on the current browser and return an object indicating browser capabilities.

```javascript
WebVoiceProcessor.browserCompatibilityCheck();
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

```bash
npm install @picovoice/web-voice-processor
```

(or)

```bash
yarn add @picovoice/web-voice-processor
```

## How to use

### Via ES Modules (Create React App, Angular, Webpack, etc.)

```javascript
import WebVoiceProcessor from '@picovoice/web-voice-processor';
```

### Via HTML <script> tag

Add the following to your HTML:

```html
<script src="@picovoice/web-voice-processor/dist/iife/index.js"></script>
```

The library adds `WebVoiceProcessor` to the window global scope.

### Start listening

Start up the WebVoiceProcessor with the `initWithWorkerEngines` async static factory method:

```javascript
let handle = await WebVoiceProcessor.initWithWorkerEngines(engines);
```

This is async due to its Web Audio API microphone request. The promise will be rejected if the user rejects permissions, no devices are found, etc. Your calilng code should handle this rejection. When the promsie resolves, the WebVoiceProcessor instance is active.

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

If you wish to initialize it and not immediately start listening, pass start=false and then call `start()` on the instance when ready.

```javascript
var handle = await WebVoiceProcessor.initWithWorkerEngines(engines, false);
handle.start();
```

### Stop listening

Pause/Resume processing (microphone and Web Audio context will still be active):

```javascript
handle.pause();
handle.resume();
```

Close the microphone MediaStream and release resources:

```javascript
handle.release();
```

This method is async as it is closing the AudioContext internally.
