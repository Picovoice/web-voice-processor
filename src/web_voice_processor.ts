/*
    Copyright 2018-2022 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

import { base64ToUint8Array } from '@picovoice/web-utils';

import DownsamplerWorker from './downsampler_worker';
import recorderProcessor from './audio_worklet/recorder_processor.js';

import { PvEngine, WebVoiceProcessorOptions } from './types';

import { AudioDumpEngine } from './engines/audio_dump_engine';
import VuMeterWorker from 'web-worker:./engines/vu_meter_worker.ts';

// @ts-ignore window.webkitAudioContext
window.AudioContext = window.AudioContext || window.webkitAudioContext;

/**
 * Obtain microphone permission and audio stream;
 * Down sample audio into 16kHz single-channel PCM for speech recognition (via DownsamplerWorker).
 * Continuously send audio frames to voice processing engines.
 */
export class WebVoiceProcessor {
  private _audioContext: AudioContext | null = null;
  private _microphoneStream: MediaStream | null = null;
  private _recorderNode: AudioWorkletNode | null = null;
  private _downsamplerWorker: DownsamplerWorker | null = null;

  private readonly _engines: Set<PvEngine>;
  private _options: WebVoiceProcessorOptions;

  private _vuMeterCallback?: (dB: number) => void;
  private _vuMeterWorker?: Worker;

  private static _instance: WebVoiceProcessor | undefined;

  private constructor(options: WebVoiceProcessorOptions) {
    this._engines = new Set();
    this._options = options;
    this._vuMeterCallback = options.vuMeterCallback;
  }

  /**
   * Gets the WebVoiceProcessor singleton instance.
   *
   * @param options Startup options.
   * @return WebVoiceProcessor singleton.
   */
  public static async instance(
    options: WebVoiceProcessorOptions = {},
  ): Promise<WebVoiceProcessor> {
    if (!this._instance) {
      this._instance = new WebVoiceProcessor(options);
    } else {
      this._instance._options = options;
      this._instance._vuMeterCallback = options.vuMeterCallback;
    }
    return this._instance;
  }

  /**
   * Record some sample raw signed 16-bit PCM data for some duration, then pack it as a Blob.
   *
   * @param durationMs the duration of the recording, in milliseconds
   * @return the data in Blob format, wrapped in a promise
   */
  public async audioDump(durationMs: number = 3000): Promise<Blob> {
    const audioDumpEngine = new AudioDumpEngine();
    this.subscribe(audioDumpEngine);
    return new Promise<Blob>(resolve => {
      // @ts-ignore
      this.audioDumpEngine = audioDumpEngine;
      setTimeout(() => {
        this.unsubscribe(audioDumpEngine);
        resolve(audioDumpEngine.onend());
      }, durationMs);
    });
  }

  /**
   * Subscribe an engine. A subscribed engine will receive audio frames via
   * `.postMessage({command: 'process', inputFrame: inputFrame})`.
   * @param engine The engine to unsubscribe.
   */
  public subscribe(engine: PvEngine): void {
    if (engine.worker) {
      if (engine.worker.postMessage && typeof engine.worker.postMessage === 'function') {
        this._engines.add(engine);
      } else {
        throw new Error("Engine must have a 'onmessage' handler.");
      }
    } else {
      if (engine.postMessage && typeof engine.postMessage === 'function') {
        this._engines.add(engine);
      } else if (engine.onmessage && typeof engine.onmessage === 'function') {
        this._engines.add(engine);
      } else {
        throw new Error("Engine must have a 'onmessage' handler.");
      }
    }
  }

  /**
   * Unsubscribe an engine.
   * @param engine The engine to unsubscribe.
   */
  public unsubscribe(engine: PvEngine): void {
    this._engines.delete(engine);
  }

  /**
   * Resumes or starts audio context. Also initializes downsampler, capture device and other configurations
   * based on `options`.
   */
  public async start(): Promise<void> {
    if (this._audioContext === null || this._audioContext.state === "closed") {
      const { audioContext, microphoneStream, recorderNode, downsamplerWorker } = await this.setupRecorder(this._options);
      this._audioContext = audioContext;
      this._microphoneStream = microphoneStream;
      this._recorderNode = recorderNode;
      this._downsamplerWorker = downsamplerWorker;

      recorderNode.port.onmessage = (event: MessageEvent): void => {
        this.recorderCallback(event.data.buffer);
      };

      if (this._vuMeterCallback) {
        this.setupVuMeter();
      }
    }

    if (this._audioContext.state === "suspended") {
      await this._audioContext.resume();
    }
  }

  /**
   * Sets audio context in a suspended state. Engines will stop receiving frames
   * during this time.
   */
  public async pause(): Promise<void> {
    if (this._audioContext !== null && this._audioContext.state === "running") {
      await this._audioContext.suspend();
    }
  }

  /**
   * Closes audio context completely. Furthermore, terminates and stops any other
   * instance created initially.
   */
  public async stop(): Promise<void> {
    if (this._audioContext !== null && this._audioContext.state !== "closed") {
      this._downsamplerWorker?.terminate();
      this._microphoneStream?.getAudioTracks().forEach(track => {
        track.stop();
      });
      await this._audioContext.close();

      if (this._vuMeterWorker) {
        this.unsubscribe(this._vuMeterWorker);
        this._vuMeterWorker.terminate();
      }
    }
  }

  /**
   * Gets the current audio context.
   */
  get audioContext(): AudioContext | null {
    return this._audioContext;
  }

  /**
   * Flag to check if it is currently recording.
   */
  get isRecording(): boolean {
    return this._audioContext?.state === "running";
  }

  /**
   * Flag to check if audio context has been released.
   */
  get isReleased(): boolean {
    return this._audioContext?.state === "closed";
  }

  private setupVuMeter(): void {
    this._vuMeterWorker = new VuMeterWorker();
    this.subscribe(this._vuMeterWorker);
    this._vuMeterWorker.onmessage = (e: MessageEvent): void => {
      if (this._vuMeterCallback) {
        this._vuMeterCallback(e.data);
      }
    };
  }

  private async recorderCallback(inputFrames: Array<Float32Array>): Promise<void> {
    if (this._downsamplerWorker === null) {
      return;
    }

    const inputFrame = await this._downsamplerWorker.process(inputFrames[0]);
    console.log(inputFrame);
    for (const engine of this._engines) {
      if (engine.worker && engine.worker.postMessage) {
        engine.worker.postMessage({
          command: 'process',
          inputFrame: inputFrame
        });
      } else if (engine.postMessage) {
        engine.postMessage({
          command: 'process',
          inputFrame: inputFrame
        });
      } else if (engine.onmessage) {
        engine.onmessage({
          data: {
            command: 'process',
            inputFrame: inputFrame
          }
        } as MessageEvent);
      }
    }
  }

  private async setupRecorder(
    options: WebVoiceProcessorOptions,
  ) {
    const {
      outputSampleRate = 16000,
      frameLength = 512,
      deviceId = null,
      filterOrder = 50,
    } = options;
    const numberOfChannels = 1;

    const audioContext = new AudioContext();

    // Get microphone access and ask user permission
    const microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
      },
    });

    const audioSource = audioContext.createMediaStreamSource(microphoneStream);

    const objectURL = URL.createObjectURL(new Blob([base64ToUint8Array(recorderProcessor).buffer], {type: 'application/javascript'}));
    await audioContext.audioWorklet.addModule(objectURL);

    const downsamplerWorker = await DownsamplerWorker.create(
      audioSource.context.sampleRate,
      outputSampleRate,
      filterOrder,
      frameLength,
    );

    const recorderNode = new window.AudioWorkletNode(
      audioContext,
      'recorder-processor',
      {
        processorOptions: {
          numberOfChannels
        }
      }
    );

    audioSource.connect(recorderNode);
    recorderNode.connect(audioContext.destination);

    return {
      audioContext,
      microphoneStream,
      recorderNode,
      downsamplerWorker
    };
  }
}
