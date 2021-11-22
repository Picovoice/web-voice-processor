/*
    Copyright 2021 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

import DsWorker from 'web-worker:./downsampling_worker.ts';

import {
  DownsamplingWorkerResponse,
  DownsamplingWorker,
} from './worker_types';

export default class DownsamplerWorkerFactory {
  private constructor() {}

  public static async create(
    inputFrequency: number,
    outputFrequency?: number,
    frameLength?: number,
  ): Promise<Worker> {
    const downsamplingWorker = new DsWorker() as DownsamplingWorker;

    downsamplingWorker.postMessage({
      command: 'init',
      inputSampleRate: inputFrequency,
      outputSampleRate: outputFrequency,
      frameLength: frameLength,
    });

    const workerPromise = new Promise<Worker>((resolve, reject) => {
      downsamplingWorker.onmessage = function (
        event: MessageEvent<DownsamplingWorkerResponse>,
      ): void {
        if (event.data.command === 'ds-ready') {
          resolve(downsamplingWorker);
        } else if (event.data.command === 'ds-failed') {
          reject(event.data.message);
        }
      };
    });
    return workerPromise;
  }
}
