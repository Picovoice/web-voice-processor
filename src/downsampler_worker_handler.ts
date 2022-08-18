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
        let outputBuffer = new Int16Array(inputFrame.length);
        const processed = downsampler.process(
          inputFrame,
          inputFrame.length,
          outputBuffer,
        );
        outputBuffer = outputBuffer.slice(0, processed);
        self.postMessage({
          command: 'ok',
          result: outputBuffer,
        }, [outputBuffer.buffer]);
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
