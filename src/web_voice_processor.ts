/*
    Copyright 2018-2021 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

import {
  WorkerCommand,
  DownsamplingWorkerCommandInput,
  DownsamplingWorkerCommandOutput,
} from './worker_types';
import DownsamplingWorker from 'web-worker:./downsampling_worker.ts';
import { browserCompatibilityCheck as check, BrowserFeatures } from './utils';

export type WebVoiceProcessorOptions = {
  engines?: Array<Worker>;
  start?: boolean;
};

/**
 * Obtain microphone permission and audio stream;
 * Downsample audio into 16kHz single-channel PCM for speech recognition.
 * Continuously send audio frames to voice processing engines.
 */
export default class WebVoiceProcessor {
  private _audioContext: AudioContext;
  private _downsamplingWorker: Worker;
  private _engines: Array<Worker>;
  private _isRecording: boolean;
  private _pcmBlob: Blob | null;
  private _audioDumpPromise: Promise<Blob> = null;
  private _audioDumpResolve: any = null;
  private _audioDumpReject: any = null;

  static browserCompatibilityCheck(): BrowserFeatures {
    return check();
  }

  /**
   * Acquires the microphone audio stream (incl. asking permission),
   * and continuously forwards the downsampled audio to speech recognition worker engines.
   *
   * @param {WebVoiceProcessorOptions} options - Startup options including whether to immediately begin
   * processing, and the set of voice processing engines
   * @return {Promise<WebVoiceProcessor>} - the promise from mediaDevices.getUserMedia()
   */
  public static async init(
    options: WebVoiceProcessorOptions,
  ): Promise<WebVoiceProcessor> {
    // Get microphone access and ask user permission
    const microphoneStream: MediaStream = await navigator.mediaDevices.getUserMedia(
      {
        audio: true,
      },
    );

    return new WebVoiceProcessor(microphoneStream, options);
  }

  constructor(
    inputMediaStream: MediaStream,
    options: WebVoiceProcessorOptions,
  ) {
    if (options.engines === undefined) {
      this._engines = [];
    } else {
      this._engines = options.engines;
    }
    this._isRecording = options.start ?? true;

    this._downsamplingWorker = new DownsamplingWorker();

    this._audioContext = new (window.AudioContext ||
      // @ts-ignore window.webkitAudioContext
      window.webkitAudioContext)();
    const audioSource = this._audioContext.createMediaStreamSource(
      inputMediaStream,
    );
    const node = this._audioContext.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = function (event: AudioProcessingEvent): void {
      if (!this._isRecording) {
        return;
      }

      this._downsamplingWorker.postMessage({
        command: WorkerCommand.Process,
        inputFrame: event.inputBuffer.getChannelData(0),
      });
    }.bind(this);

    audioSource.connect(node);
    node.connect(this._audioContext.destination);

    this._downsamplingWorker.postMessage({
      command: WorkerCommand.Init,
      inputSampleRate: audioSource.context.sampleRate,
    });

    this._downsamplingWorker.onmessage = (event: MessageEvent<any>): void => {
      switch (event.data.command) {
        case 'output': {
          for (const engine of this._engines) {
            engine.postMessage({
              command: WorkerCommand.Process,
              inputFrame: event.data.outputFrame,
            });
          }
          break;
        }
        case DownsamplingWorkerCommandOutput.AudioDumpComplete: {
          this._audioDumpResolve(event.data.blob);
          this._audioDumpPromise = null;
          this._audioDumpResolve = null;
          this._audioDumpReject = null;
          break;
        }
      }
    };
  }

  /**
   * Record some sample raw signed 16bit PCM data for some duration, then pack it as a Blob
   *
   * @param {number} durationMs - the duration of the recording in milliseconds
   */
  public async audioDump(durationMs: number = 3000): Promise<Blob> {
    if (this._audioDumpPromise !== null) {
      return Promise.reject('Audio dump already in progress');
    }

    this._downsamplingWorker.postMessage({
      command: DownsamplingWorkerCommandInput.StartAudioDump,
      durationMs: durationMs,
    });

    this._audioDumpPromise = new Promise<Blob>((resolve, reject) => {
      this._audioDumpResolve = resolve;
      this._audioDumpReject = reject;
    });

    return this._audioDumpPromise;
  }

  /**
   * Stop listening to the microphonel release all resources; terminate downsampling worker.
   *
   * @return {Promise<void>} - the promise from AudioContext.close()
   */
  public async release(): Promise<void> {
    this._isRecording = false;
    this._downsamplingWorker.postMessage({ command: WorkerCommand.Reset });
    this._downsamplingWorker.terminate();
    this._downsamplingWorker = null;
    await this._audioContext.close();
    this._audioContext = null;
  }

  public start(): void {
    this._isRecording = true;
  }

  public pause(): void {
    this._isRecording = false;
  }

  public resume(): void {
    this._isRecording = true;
  }

  public pcmBlob(): Blob {
    return this._pcmBlob;
  }

  get audioContext(): AudioContext {
    return this._audioContext;
  }

  get isRecording(): boolean {
    return this._isRecording;
  }
}
