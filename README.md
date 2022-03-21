# Web Voice Processor

[![GitHub release](https://img.shields.io/github/release/Picovoice/web-voice-processor.svg)](https://github.com/Picovoice/web-voice-processor/releases)

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

A library for real-time voice processing in web browsers.

- Uses the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) to access microphone audio.
- Leverages [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Worker) to offload compute-intensive tasks off of the main thread.
- Converts the microphone sampling rate to 16kHz, the _de facto_ standard for voice processing engines.
- Provides a flexible interface to pass in arbitrary voice processing workers.

For more detailed information, refer to the [package's readme](package/README.md).

## Build from source

### Generates base64 wasm file

Use `yarn` to generate necessary files for the package:

```console
yarn
yarn build
```

### Build the package

Go to the `package` directory. Use `yarn` to build WebVoiceProcessor:

```console
yarn
yarn build
```

The build script outputs minified and non-minified versions of the IIFE and ESM formats to the `dist` folder. It also will output the TypeScript type definitions.

### Test the package

For testing the output of the downsampler module, Go to the root directory first and run the following command:

```console
python3 package/test/selenium_test.py
```

## Demo

Go to the `demo` directory. Use `yarn` to install the dependencies, and the `start` script to start a local web server hosting the demo.

```console
yarn
yarn start
```

Open `localhost:5000` in your web browser, as hinted at in the output:

```console
Available on:
  http://localhost:5000
Hit CTRL-C to stop the server
```

You will see the VU meter responding to microphone volume in real time.
