# WebVoiceProcessor - Demo

This is a basic demo to show how to use WebVoiceProcessor. It passes in a worker that returns the volume level of the downsampled signal. It also allows you to dump raw PCM data that has passed through the resampler.

## Install / run

Use `yarn` or `npm` to install the dependencies, and the `start` script to start a local web server hosting the demo.

```bash
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

### Audio Dump

Press the "Start Audio Dump" button to activate web voice processor's audio dump feature. When it's ready, you can click "Download raw PCM" to download the data. You can use a tool like Audacity to open this file (signed 16-bit, 16000Hz).
