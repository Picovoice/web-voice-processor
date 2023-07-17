/*
  Copyright 2023 Picovoice Inc.

  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.

  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

class KoalaProcessor extends AudioWorkletProcessor {
  constructor(options = {processorOptions: {}}) {
    super();

    const { numberOfChannels = 1 } = options.processorOptions;

    this._numberOfChannels = numberOfChannels;
  }

  process(inputs, outputs, parameters) {
    console.log('k', inputs)
    let input = inputs[0]; // get first input
    if (input.length === 0) {
      return true;
    }

    const temp = new Float32Array(128);
    for (let i = 0; i < temp.length; i++) {
      temp[i] = 7;
    }

    this.port.postMessage({
      buffer: temp.buffer
    });
    return true;
  }
}

registerProcessor('koala-processor', KoalaProcessor);
