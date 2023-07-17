/*
  Copyright 2022 Picovoice Inc.

  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.

  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

import VmWorker from 'web-worker:./vu_meter_worker.ts';

export class VuMeterEngine {
  private readonly _vuMeterCallback: (dB: number) => void;
  private readonly _worker: Worker;

  constructor(vuMeterCallback: (db: number) => void) {
    this._vuMeterCallback = vuMeterCallback;
    this._worker = new VmWorker();
    this._worker.onmessage = (e: MessageEvent): void => {
      this._vuMeterCallback(e.data);
    };
  }

  get worker(): Worker {
    return this._worker;
  }
}
