# Web Voice Processor

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

This is a library for real-time voice processing in web browsers.

* Uses [Worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker) to offload compute-intensive work to background
threads.
* Converts the microphone sampling rate to 16000 which is used by (almost all) voice processing engines.
* Provides a flexible interface to pass in arbitrary voice processing workers.

## Compatibility

The library makes use of [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API), which is
supported on all modern browsers except Internet Explorer.

## How to Install

```bash
npm install web-voice-processor
```

## How to Use

Add the following to your HTML

```html
<script src="{PATH_TO_WEB_VOICE_PROCESSOR_JS}"></script>
```

Replace `{PATH_TO_WEB_VOICE_PROCESSOR_JS}` with the path to [src/web_voice_processor.js](/src/web_voice_processor.js).

The library adds `WebVoiceProcessor` as a singleton to the global scope.

### Start Processing

Start processing

```javascript
window.WebVoiceProcessor.start(engines, downsamplerScript, errorCallback)
```

`engines` is a list of voice processing [Workers]((https://developer.mozilla.org/en-US/docs/Web/API/Worker))
implementing the following interface within their `onmessage` method


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

`downsamplerScript` is the path to [downsampling_worker.js](/src/downsampling_worker.js) relative to HTML file.

The `errorCallback` is executed if audio acquisition fails.

### Stop Processing

Stop processing

```javascript
window.WebVoiceProcessor.stop()
```

