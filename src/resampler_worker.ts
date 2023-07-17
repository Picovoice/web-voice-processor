/*
    Copyright 2021-2022 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

import ResampleWorker from 'web-worker:./resampler_worker_handler.ts';

import {
  ResamplerWorkerInitResponse,
  ResamplerWorkerNumRequiredInputSamplesResponse,
  ResamplerWorkerProcessResponse,
  ResamplerWorkerReleaseResponse,
  ResamplerWorkerResetResponse,
} from './types';

export default class ResamplerWorker {
  private readonly _worker: Worker;
  private readonly _version: string;

  private static _wasm: string;

  private constructor(worker: Worker, version: string) {
    this._worker = worker;
    this._version = version;
  }

  public static setWasm(wasm: string): void {
    if (this._wasm === undefined) {
      this._wasm = wasm;
    }
  }

  public static async create(
    inputSampleRate: number,
    outputSampleRate: number,
    filterOrder: number,
    frameLength: number,
    resampleCallback: (inputFrame: Int16Array) => void,
  ): Promise<ResamplerWorker> {
    const worker = new ResampleWorker();
    const returnPromise: Promise<ResamplerWorker> = new Promise((resolve, reject) => {
      // @ts-ignore - block from GC
      this.worker = worker;
      worker.onmessage = (event: MessageEvent<ResamplerWorkerInitResponse>): void => {
        switch (event.data.command) {
          case 'ok':
            worker.onmessage = (ev: MessageEvent<ResamplerWorkerProcessResponse>): void => {
              switch (ev.data.command) {
                case 'ok':
                  resampleCallback(ev.data.result);
                  break;
                case 'failed':
                case 'error':
                  // eslint-disable-next-line no-console
                  console.error(ev.data.message);
                  break;
                default:
                  // @ts-ignore
                  // eslint-disable-next-line no-console
                  console.error(`Unrecognized command: ${event.data.command}`);
              }
            };
            resolve(new ResamplerWorker(worker, event.data.version));
            break;
          case 'failed':
          case 'error':
            reject(event.data.message);
            break;
          default:
            // @ts-ignore
            reject(`Unrecognized command: ${event.data.command}`);
        }
      };
    });

    worker.postMessage({
      command: 'init',
      wasm: this._wasm,
      inputSampleRate: inputSampleRate,
      outputSampleRate: outputSampleRate,
      filterOrder: filterOrder,
      frameLength: frameLength,
    });

    return returnPromise;
  }

  public process(inputFrame: Int16Array | Float32Array): void {
    this._worker.postMessage({
      command: 'process',
      inputFrame: inputFrame,
    }, [inputFrame.buffer]);
  }

  public reset(): Promise<void> {
    const returnPromise: Promise<void> = new Promise((resolve, reject) => {
      this._worker.onmessage = (event: MessageEvent<ResamplerWorkerResetResponse>): void => {
        switch (event.data.command) {
          case 'ok':
            resolve();
            break;
          case 'failed':
          case 'error':
            reject(event.data.message);
            break;
          default:
            // @ts-ignore
            reject(`Unrecognized command: ${event.data.command}`);
        }
      };
    });

    this._worker.postMessage({
      command: 'reset'
    });

    return returnPromise;
  }

  public release(): Promise<void> {
    const returnPromise: Promise<void> = new Promise((resolve, reject) => {
      this._worker.onmessage = (event: MessageEvent<ResamplerWorkerReleaseResponse>): void => {
        switch (event.data.command) {
          case 'ok':
            resolve();
            break;
          case 'failed':
          case 'error':
            reject(event.data.message);
            break;
          default:
            // @ts-ignore
            reject(`Unrecognized command: ${event.data.command}`);
        }
      };
    });

    this._worker.postMessage({
      command: 'release'
    });

    return returnPromise;
  }

  public terminate(): void {
    this._worker.terminate();
  }

  public getNumRequiredInputSamples(numSample: number): Promise<number> {
    const returnPromise: Promise<number> = new Promise((resolve, reject) => {
      this._worker.onmessage = (event: MessageEvent<ResamplerWorkerNumRequiredInputSamplesResponse>): void => {
        switch (event.data.command) {
          case 'ok':
            resolve(event.data.result);
            break;
          case 'failed':
          case 'error':
            reject(event.data.message);
            break;
          default:
            // @ts-ignore
            reject(`Unrecognized command: ${event.data.command}`);
        }
      };
    });

    this._worker.postMessage({
      command: 'numRequiredInputSamples',
      numSample: numSample,
    });

    return returnPromise;
  }
}
