/*
    Copyright 2018-2022 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

// @ts-ignore
declare const self: ServiceWorkerGlobalScope;

import {ResamplerWorkerRequest} from './types';
import Resampler from './resampler';

let accumulator: BufferAccumulator | null = null;
let resampler: Resampler | null = null;

class BufferAccumulator {
  private readonly _frameLength: number;
  private readonly _inputBufferLength: number;

  private _buffer: Int16Array;

  private _copied: number;

  constructor(frameLength: number, inputBufferLength: number) {
    this._frameLength = frameLength;
    this._inputBufferLength = inputBufferLength;
    this._buffer = new Int16Array(frameLength);
    this._copied = 0;
  }

  public process(frames: Int16Array | Float32Array): void {
    let remaining = frames.length;

    while (remaining > 0) {
      const toProcess = Math.min(remaining, this._inputBufferLength);
      const outputBuffer = new Int16Array(this._frameLength);
      const processedSamples = resampler?.process(frames.slice(0, toProcess), outputBuffer) ?? 0;

      const toCopy = Math.min(processedSamples, this._frameLength - this._copied);
      this._buffer.set(outputBuffer.slice(0, toCopy), this._copied);
      if (toCopy < processedSamples) {
        self.postMessage({
          command: 'ok',
          result: this._buffer,
        });
        this._copied = 0;
        this._buffer = new Int16Array(this._frameLength);
        this._buffer.set(outputBuffer.slice(toCopy, processedSamples), 0);
        this._copied = processedSamples - toCopy;
      } else {
        this._copied += toCopy;
      }
      frames = frames.slice(toProcess, frames.length);
      remaining -= toProcess;
    }
  }
}

onmessage = async function (event: MessageEvent<ResamplerWorkerRequest>): Promise<void> {
  switch (event.data.command) {
    case 'init':
      if (resampler !== null) {
        self.postMessage({
          command: 'error',
          message: 'Resampler already initialized',
        });
        return;
      }
      try {
        Resampler.setWasm(event.data.wasm);
        resampler = await Resampler.create(
          event.data.inputSampleRate,
          event.data.outputSampleRate,
          event.data.filterOrder,
          event.data.frameLength,
        );
        accumulator = new BufferAccumulator(
          resampler.frameLength,
          resampler.inputBufferLength);

        self.postMessage({
          command: 'ok',
          version: resampler.version,
        });
      } catch (e: any) {
        self.postMessage({
          command: 'error',
          message: e.message,
        });
      }
      break;
    case 'process':
      if (resampler === null) {
        self.postMessage({
          command: 'error',
          message: 'Resampler not initialized',
        });
        return;
      }
      try {
        const {inputFrame} = event.data;
        accumulator?.process(inputFrame);
      } catch (e: any) {
        self.postMessage({
          command: 'error',
          message: e.message,
        });
        return;
      }
      break;
    case 'reset':
      if (resampler === null) {
        self.postMessage({
          command: 'error',
          message: 'Resampler not initialized',
        });
        return;
      }
      resampler.reset();
      self.postMessage({
        command: 'ok',
      });
      break;
    case 'release':
      if (resampler === null) {
        self.postMessage({
          command: 'error',
          message: 'Resampler not initialized',
        });
        return;
      }
      resampler.release();
      resampler = null;
      accumulator = null;
      self.postMessage({
        command: 'ok',
      });
      break;
    case 'numRequiredInputSamples':
      if (resampler === null) {
        self.postMessage({
          command: 'error',
          message: 'Resampler not initialized',
        });
        return;
      }
      try {
        self.postMessage({
          command: 'ok',
          result: resampler.getNumRequiredInputSamples(event.data.numSample),
        });
      } catch (e: any) {
        self.postMessage({
          command: 'error',
          message: e.message,
        });
      }
      break;
    default:
      // @ts-ignore
      // eslint-disable-next-line no-console
      console.warn(`Unhandled message in resampler_worker.ts: ${event.data.command}`);
      break;
  }
};
