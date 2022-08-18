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

import { DownsamplerWorkerRequest } from './types';
import Downsampler from './downsampler';

class BufferAccumulator {
  private readonly _frameLength: number;
  private readonly _buffer: Int16Array;

  private _copied: number;

  constructor(frameLength = 512) {
    this._frameLength = frameLength;
    this._buffer = new Int16Array(frameLength);
    this._copied = 0;
  }

  public process(frames: Int16Array): void {
    let remaining = frames.length;

    while (remaining > 0) {
      const toCopy = Math.min(remaining, this._frameLength - this._copied);
      this._buffer.set(frames.slice(0, toCopy), this._copied);

      frames = frames.slice(toCopy, frames.length);
      remaining -= toCopy;
      this._copied += toCopy;

      if (this._copied >= this._frameLength) {
        self.postMessage({
          command: 'ok',
          result: this._buffer,
        });
        this._copied = 0;
      }
    }
  }
}

let accumulator: BufferAccumulator | null = null;
let downsampler: Downsampler | null = null;
onmessage = async function(event: MessageEvent<DownsamplerWorkerRequest>): Promise<void> {
  switch (event.data.command) {
    case 'init':
      if (downsampler !== null) {
        self.postMessage({
          command: 'error',
          message: 'Downsampler already initialized',
        });
        return;
      }
      try {
        Downsampler.setWasm(event.data.wasm);
        downsampler = await Downsampler.create(
          event.data.inputSampleRate,
          event.data.outputSampleRate,
          event.data.filterOrder,
          event.data.frameLength,
        );
        accumulator = new BufferAccumulator(event.data.frameLength);
        self.postMessage({
          command: 'ok',
          version: downsampler.version,
        });
      } catch (e: any) {
        self.postMessage({
          command: 'error',
          message: e.message,
        });
      }
      break;
    case 'process':
      if (downsampler === null) {
        self.postMessage({
          command: 'error',
          message: 'Downsampler not initialized',
        });
        return;
      }
      try {
        const { inputFrame } = event.data;
        const outputBuffer = new Int16Array(inputFrame.length);
        const processed = downsampler.process(
          inputFrame,
          inputFrame.length,
          outputBuffer,
        );
        accumulator?.process(outputBuffer.slice(0, processed));
      } catch (e: any) {
        self.postMessage({
          command: 'error',
          message: e.message,
        });
        return;
      }
      break;
    case 'reset':
      if (downsampler === null) {
        self.postMessage({
          command: 'error',
          message: 'Downsampler not initialized',
        });
        return;
      }
      downsampler.reset();
      self.postMessage({
        command: 'ok',
      });
      break;
    case 'release':
      if (downsampler === null) {
        self.postMessage({
          command: 'error',
          message: 'Downsampler not initialized',
        });
        return;
      }
      downsampler.release();
      downsampler = null;
      accumulator = null;
      self.postMessage({
        command: 'ok',
      });
      break;
    case 'numRequiredInputSamples':
      if (downsampler === null) {
        self.postMessage({
          command: 'error',
          message: 'Downsampler not initialized',
        });
        return;
      }
      try {
        self.postMessage({
          command: 'ok',
          result: downsampler.getNumRequiredInputSamples(event.data.numSample),
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
      console.warn(`Unhandled message in downsampler_worker.ts: ${event.data.command}`);
      break;
  }
};
