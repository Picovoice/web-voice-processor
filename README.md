# Web Voice Processor

[![GitHub release](https://img.shields.io/github/release/Picovoice/web-voice-processor.svg)](https://github.com/Picovoice/web-voice-processor/releases)

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

A library for real-time voice processing in web browsers.

- Uses the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) to access microphone audio.
- Leverages [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Worker) to offload compute-intensive tasks off of the main thread.
- Converts the microphone sampling rate to 16kHz, the _de facto_ standard for voice processing engines.
- Provides a flexible interface to pass in arbitrary voice processing workers.

- [Web Voice Processor](#web-voice-processor)
  - [Build from source](#build-from-source)
  - [Demo](#demo)
    - [Install & run](#install--run)


## Build from source

Go to the `package` directory. Use `yarn` or `npm` to build WebVoiceProcessor:

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

## Demo

This is a basic demo to show how to use [@picovoice/web-voice-processor](https://www.npmjs.com/package/@picovoice/web-voice-processor).

### Install & run

Use `yarn` or `npm` to install the dependencies, and the `start` script to start a local web server hosting the demo.

```console
yarn
yarn start
```

(or)

```console
npm
npm run start
```

Open `localhost:5000` in your web browser, as hinted at in the output:

```console
   ┌──────────────────────────────────────────────────┐
   │                                                  │
   │   Serving!                                       │
   │                                                  │
   │   - Local:            http://localhost:5000      │
   │   - On Your Network:  http://192.168.1.69:5000   │
   │                                                  │
   │   Copied local address to clipboard!             │
   │                                                  │
   └──────────────────────────────────────────────────┘
```