/*
    Copyright 2018-2023 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

import { Mutex } from 'async-mutex';

import { base64ToUint8Array } from '@picovoice/web-utils';

import ResamplerWorker from './resampler_worker';
import recorderProcessor from './audio_worklet/recorder_processor.js';

import { PvEngine, WebVoiceProcessorOptions, WvpState } from './types';

import { AudioDumpEngine } from './engines/audio_dump_engine';

/**
 * WebVoiceProcessor Error Class
 */
export class WvpError extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}

/**
 * Obtain microphone permission and audio stream;
 * Down sample audio into 16kHz single-channel PCM for speech recognition (via ResamplerWorker).
 * Continuously send audio frames to voice processing engines.
 */
export class WebVoiceProcessor {
  private _mutex = new Mutex();

  private _audioContext: AudioContext | null = null;
  private _microphoneStream: MediaStream | null = null;
  private _recorderNode: AudioWorkletNode | null = null;
  private _resamplerWorker: ResamplerWorker | null = null;

  private readonly _engines: Set<PvEngine>;
  private _options: WebVoiceProcessorOptions = {};
  private _state: WvpState;

  private static _instance: WebVoiceProcessor | undefined;

  private constructor() {
    this._engines = new Set();
    this._options = {};
    this._state = WvpState.STOPPED;
  }

  /**
   * Gets the WebVoiceProcessor singleton instance.
   *
   * @return WebVoiceProcessor singleton.
   */
  private static instance(): WebVoiceProcessor {
    if (!this._instance) {
      this._instance = new WebVoiceProcessor();
    }
    return this._instance;
  }

  /**
   * Record some sample raw signed 16-bit PCM data for some duration, then pack it as a Blob.
   *
   * @param durationMs the duration of the recording, in milliseconds
   * @return the data in Blob format, wrapped in a promise
   */
  public static async audioDump(durationMs: number = 3000): Promise<Blob> {
    const audioDumpEngine = new AudioDumpEngine();
    await this.subscribe(audioDumpEngine);
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
   * @param engines The engine(s) to subscribe.
   */
  public static async subscribe(engines: PvEngine | PvEngine[]): Promise<void> {
    for (const engine of (Array.isArray(engines) ? engines : [engines])) {
      if (!engine) {
        throw new WvpError("InvalidEngine", "Null or undefined engine.");
      }

      if (engine.worker) {
        if (engine.worker.postMessage && typeof engine.worker.postMessage === 'function') {
          this.instance()._engines.add(engine);
        } else {
          throw new WvpError("InvalidEngine", "Engine must have a 'onmessage' handler.");
        }
      } else {
        if (engine.postMessage && typeof engine.postMessage === 'function') {
          this.instance()._engines.add(engine);
        } else if (engine.onmessage && typeof engine.onmessage === 'function') {
          this.instance()._engines.add(engine);
        } else {
          throw new WvpError("InvalidEngine", "Engine must have a 'onmessage' handler.");
        }
      }
    }

    if (this.instance()._engines.size > 0 && this.instance()._state !== WvpState.STARTED) {
      await this.instance().start();
    }
  }

  /**
   * Unsubscribe an engine.
   * @param engines The engine(s) to unsubscribe.
   */
  public static async unsubscribe(engines: PvEngine | PvEngine[]): Promise<void> {
    for (const engine of (Array.isArray(engines) ? engines : [engines])) {
      this.instance()._engines.delete(engine);
    }

    if (this.instance()._engines.size === 0 && this.instance()._state !== WvpState.STOPPED) {
      await this.instance().stop();
    }
  }

  /**
   * Removes all engines and stops recording audio.
   */
  static async reset(): Promise<void> {
    this.instance()._engines.clear();
    await this.instance().stop();
  }

  /**
   * Set new WebVoiceProcessor options.
   * If forceUpdate is not set to true, all engines must be unsubscribed and subscribed
   * again in order for the recorder to take the new changes.
   * Using forceUpdate might allow a small gap where audio frames is not received.
   *
   * @param options WebVoiceProcessor recording options.
   * @param forceUpdate Flag to force update recorder with new options.
   */
  static setOptions(options: WebVoiceProcessorOptions, forceUpdate = false): void {
    this.instance()._options = options;
    if (forceUpdate) {
      this.instance().stop().then(async () => {
        await this.instance().start();
      });
    }
  }

  /**
   * Gets the current audio context.
   */
  static get audioContext(): AudioContext | null {
    return this.instance()._audioContext;
  }

  /**
   * Flag to check if it is currently recording.
   */
  static get isRecording(): boolean {
    return this.instance()._state === WvpState.STARTED;
  }

  /**
   * Resumes or starts audio context. Also initializes resampler, capture device and other configurations
   * based on `options`.
   */
  private start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._mutex
        .runExclusive(async () => {
          try {
            if (this._audioContext === null || this._state === WvpState.STOPPED || this.isReleased) {
              const { audioContext, microphoneStream, recorderNode, resamplerWorker } = await this.setupRecorder(this._options);
              this._audioContext = audioContext;
              this._microphoneStream = microphoneStream;
              this._recorderNode = recorderNode;
              this._resamplerWorker = resamplerWorker;

              recorderNode.port.onmessage = (event: MessageEvent): void => {
                resamplerWorker.process(event.data.buffer[0]);
              };
              this._state = WvpState.STARTED;
            }

            if (this._audioContext !== null && this.isSuspended) {
              await this._audioContext.resume();
            }
          } catch (error: any) {
            if (error && error.name) {
              if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
                throw new WvpError(
                  'PermissionError',
                  'Failed to record audio: microphone permissions denied.'
                );
              } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
                throw new WvpError(
                  'DeviceMissingError',
                  'Failed to record audio: audio recording device was not found.'
                );
              } else if (error.name === 'NotReadableError') {
                throw new WvpError(
                  'DeviceReadError',
                  'Failed to record audio: audio recording device is not working correctly.'
                );
              }
            } else {
              throw error;
            }
          }
        })
        .then(() => {
          resolve();
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }

  /**
   * Stops and closes resources used. Furthermore, terminates and stops any other
   * instance created initially.
   * AudioContext is kept alive to be used when starting again.
   */
  private stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._mutex
        .runExclusive(async () => {
          if (this._audioContext !== null && this._state !== WvpState.STOPPED) {
            this._resamplerWorker?.terminate();
            this._recorderNode?.port.close();
            this._microphoneStream?.getAudioTracks().forEach(track => {
              track.stop();
            });

            this._state = WvpState.STOPPED;
          }
        })
        .then(() => {
          resolve();
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }

  /**
   * Flag to check if audio context has been suspended.
   */
  private get isSuspended(): boolean {
    return this._audioContext?.state === "suspended";
  }

  /**
   * Flag to check if audio context has been released.
   */
  private get isReleased(): boolean {
    return this._audioContext?.state === "closed";
  }

  private recorderCallback(inputFrame: Int16Array): void {
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

  private async getAudioContext(): Promise<AudioContext> {
    if (this._audioContext === null || this.isReleased) {
      this._audioContext = new AudioContext();
      if (this._options.customRecorderProcessorURL) {
        await this._audioContext.audioWorklet.addModule(this._options.customRecorderProcessorURL);
      } else {
        const objectURL = URL.createObjectURL(new Blob([base64ToUint8Array(recorderProcessor).buffer], {type: 'application/javascript'}));
        await this._audioContext.audioWorklet.addModule(objectURL);
      }
    }
    return this._audioContext;
  }

  private async setupRecorder(
    options: WebVoiceProcessorOptions,
  ) {
    if (navigator.mediaDevices === undefined) {
      throw new WvpError("DeviceDisabledError", "Audio recording is not allowed or disabled.");
    }

    const {
      outputSampleRate = 16000,
      frameLength = 512,
      deviceId = null,
      filterOrder = 50,
    } = options;
    const numberOfChannels = 1;

    const audioContext = await this.getAudioContext();

    // Get microphone access and ask user permission
    const microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
      },
    });

    const audioSource = audioContext.createMediaStreamSource(microphoneStream);

    const resamplerWorker = await ResamplerWorker.create(
      audioSource.context.sampleRate,
      outputSampleRate,
      filterOrder,
      frameLength,
      this.recorderCallback.bind(this),
    );

    const recorderNode = new window.AudioWorkletNode(
      audioContext,
      'recorder-processor',
      {
        processorOptions: {
          frameLength,
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
      resamplerWorker
    };
  }
}
