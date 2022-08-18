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

    const { numberOfChannels = 1, frameLength = 512 } = options?.processorOptions;

    this._numberOfChannels = numberOfChannels;
    this._frameLength = frameLength;

    this._copied = 0;
    this._recorderBuffer = new Array(numberOfChannels).fill(new Float32Array(frameLength));
  }

  process(inputs, outputs, parameters) {
    let input = inputs[0]; // get first input
    if (input.length === 0) {
      return true;
    }

    let remaining = input[0].length;
    while (remaining > 0) {
      const toCopy = Math.min(remaining, this._frameLength - this._copied);

      for (let ch = 0; ch < this._numberOfChannels; ch++) {
        this._recorderBuffer[ch].set(input[ch].slice(0, toCopy), this._copied);
      }

      remaining -= toCopy;
      this._copied += toCopy;

      if (this._copied >= this._frameLength) {
        this.port.postMessage({
          buffer: this._recorderBuffer
        });
        this._copied = 0;
      }
    }

    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
