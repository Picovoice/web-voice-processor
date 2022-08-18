/*
  Copyright 2022 Picovoice Inc.

  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.

  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

class RecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const { numberOfChannels = 1 } = options?.processorOptions;

    this._numberOfChannels = numberOfChannels;
  }

  process(inputs, outputs, parameters) {
    let input = inputs[0]; // get first input
    if (input.length === 0) {
      return true;
    }

    this.port.postMessage({
      buffer: input.slice(0, this._numberOfChannels)
    });
    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
