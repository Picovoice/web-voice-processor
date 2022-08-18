/*
  Copyright 2022 Picovoice Inc.

  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.

  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

import { WvpMessageEvent } from '../types';

const INT_16_MAX = 32767;
const EPSILON = 1e-9;

const process = (frames: Int16Array): number => {
  const sum = [...frames].reduce(
    (accumulator, frame) => accumulator + frame ** 2,
    0,
  );
  const rms = (sum / frames.length) / INT_16_MAX / INT_16_MAX;
  return 10 * Math.log10(Math.max(rms, EPSILON));
};

onmessage = (e: MessageEvent<WvpMessageEvent>): void => {
  switch (e.data.command) {
    case 'process':
      postMessage(process(e.data.inputFrame));
      break;
    default:
  }
};
