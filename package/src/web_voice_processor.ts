/*
    Copyright 2018-2022 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

import { DownsamplingWorker, DownsamplingWorkerResponse } from './worker_types';
import DownsamplerWorkerFactory from './downsampler_worker_factory';

export type WebVoiceProcessorOptions = {
  /** Engines to feed downsampled audio to */
  engines?: Array<Worker>;
  /** Immediately start the microphone? */
  start?: boolean;
  /** Size of pcm frames (default: 512) */
  frameLength?: number;
  /** Which sample rate to convert to (default: 16000) */
  outputSampleRate?: number;
  /** Microphone id to use (can be fetched with mediaDevices.enumerateDevices) */
  deviceId?: string | null;
};

/**
 * Obtain microphone permission and audio stream;
 * Downsample audio into 16kHz single-channel PCM for speech recognition (via DownsamplingWorker).
 * Continuously send audio frames to voice processing engines.
 */
export class WebVoiceProcessor {
  private _audioContext: AudioContext;
  private _audioDumpPromise: Promise<Blob> | null = null;
  private _audioDumpReject: any = null;
  private _audioDumpResolve: any = null;
  private _audioSource: MediaStreamAudioSourceNode;
  private _downsamplingWorker: DownsamplingWorker;
  private _engines: Array<Worker>;
  private _isRecording: boolean;
  private _isReleased = false;
  private _mediaStream: MediaStream;
  private _options: WebVoiceProcessorOptions;

  private static async _initMic(
    options: WebVoiceProcessorOptions,
  ): Promise<any> {

    // Get microphone access and ask user permission
    const microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: options.deviceId ? { exact: options.deviceId } : undefined,
      },
    });

    const audioContext = new (window.AudioContext ||
      // @ts-ignore window.webkitAudioContext
      window.webkitAudioContext)();
    const audioSource = audioContext.createMediaStreamSource(microphoneStream);

    const downsamplingWorker = await DownsamplerWorkerFactory.create(
      audioSource.context.sampleRate,
      options.outputSampleRate,
      options.frameLength,
    );

    return [
      microphoneStream,
      audioContext,
      audioSource,
      downsamplingWorker,
    ]
  }

  private async _setupAudio(): Promise<any> {
    const node = this._audioContext.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = (event: AudioProcessingEvent): void => {
      if (this._isRecording) {
        this._downsamplingWorker.postMessage({
          command: 'process',
          inputFrame: event.inputBuffer.getChannelData(0),
        });
      }
    };

    this._audioSource.connect(node);
    node.connect(this._audioContext.destination);

    this._downsamplingWorker.onmessage = (
      event: MessageEvent<DownsamplingWorkerResponse>,
    ): void => {
      switch (event.data.command) {
        case 'output': {
          for (const engine of this._engines) {
            engine.postMessage({
              command: 'process',
              inputFrame: event.data.outputFrame,
            });
          }
          break;
        }
        case 'audio_dump_complete': {
          this._audioDumpResolve(event.data.blob);
          this._audioDumpPromise = null;
          this._audioDumpResolve = null;
          this._audioDumpReject = null;
          break;
        }
        default: {
          console.warn(`Received unexpected command: ${event.data.command}`);
          break;
        }
      }
    };
  }

  /**
   * Acquires the microphone audio stream (incl. asking permission),
   * and continuously forwards the downsampled audio to speech recognition worker engines.
   *
   * @param options Startup options including whether to immediately begin
   * processing, and the set of voice processing engines
   * @return the promise from mediaDevices.getUserMedia()
   */

  public static async init(
    options: WebVoiceProcessorOptions,
  ): Promise<WebVoiceProcessor> {
    const [microphoneStream, audioContext, audioSource, downsamplingWorker] = await this._initMic(options);

    return new WebVoiceProcessor(
      microphoneStream,
      audioContext,
      audioSource,
      downsamplingWorker,
      options,
    );
  }

  private constructor(
    inputMediaStream: MediaStream,
    audioContext: AudioContext,
    audioSource: MediaStreamAudioSourceNode,
    downsamplingWorker: DownsamplingWorker,
    options: WebVoiceProcessorOptions,
  ) {
    this._options = options;

    if (options.engines === undefined) {
      this._engines = [];
    } else {
      this._engines = options.engines;
    }
    this._isRecording = options.start ?? true;

    this._mediaStream = inputMediaStream;
    this._downsamplingWorker = downsamplingWorker;
    this._audioContext = audioContext;
    this._audioSource = audioSource;

    this._setupAudio();
  }

  /**
   * Record some sample raw signed 16-bit PCM data for some duration, then pack it as a Blob.
   *
   * @param durationMs the duration of the recording, in milliseconds
   * @return the data in Blob format, wrapped in a promise
   */

  public async audioDump(durationMs: number = 3000): Promise<Blob> {
    if (this._audioDumpPromise !== null) {
      return Promise.reject('Audio dump already in progress');
    }

    this._downsamplingWorker.postMessage({
      command: 'start_audio_dump',
      durationMs: durationMs,
    });

    this._audioDumpPromise = new Promise<Blob>((resolve, reject) => {
      this._audioDumpResolve = resolve;
      this._audioDumpReject = reject;
    });

    return this._audioDumpPromise;
  }

  /**
   * Stop listening to the microphone & release all resources; terminate downsampling worker.
   *
   * @return the promise from AudioContext.close()
   */

  public async release(): Promise<void> {
    if (!this._isReleased) {
      this._isReleased = true;
      this._isRecording = false;
      this._downsamplingWorker.postMessage({ command: 'release' });
      this._downsamplingWorker.terminate();

      this._mediaStream.getTracks().forEach(function (track) {
        track.stop();
      });

      await this._audioContext.close();
    }
  }

  public async stop(): Promise<void> {
    return this.release();
  }

  public pause(): void {
    this._isRecording = false;
    this._downsamplingWorker.postMessage({ command: 'reset' });
  }

  public async start(): Promise<void> {
    this._isRecording = true;
    if (this._isReleased) {
      this._isReleased = false;
      this._isRecording = true;
      const [microphoneStream, audioContext, audioSource, downsamplingWorker] = await WebVoiceProcessor._initMic(this._options)

      this._mediaStream = microphoneStream;
      this._downsamplingWorker = downsamplingWorker;
      this._audioContext = audioContext;
      this._audioSource = audioSource;

      this._setupAudio();
    }
  }

  get audioContext(): AudioContext | null {
    return this._audioContext;
  }

  get audioSource(): MediaStreamAudioSourceNode {
    return this._audioSource;
  }

  get mediaStream(): MediaStream {
    return this._mediaStream;
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  get isReleased(): boolean {
    return this._isReleased;
  }
}
