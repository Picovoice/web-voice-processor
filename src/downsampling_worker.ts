/*
    Copyright 2018-2021 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

import { WorkerCommand } from './worker_types';

type DownsamplingWorkerMessage = {
  command: WorkerCommand;
  frameLength?: number;
  inputFrame?: Int16Array;
  inputSampleRate?: number;
  outputSampleRate?: number;
};

const PV_FRAME_LENGTH = 512;
const PV_SAMPLE_RATE = 16000;
const S_INT16_MAX = 32767;

let _inputSampleRate: number;
let _outputSampleRate: number;
let _frameLength: number;
let _inputBuffer: Array<number> = [];

function init(
  inputSampleRate: number,
  outputSampleRate: number = PV_SAMPLE_RATE,
  frameLength: number = PV_FRAME_LENGTH,
): void {
  _inputSampleRate = inputSampleRate;
  _outputSampleRate = outputSampleRate;
  _frameLength = frameLength;

  console.assert(Number.isInteger(_inputSampleRate));
  console.assert(Number.isInteger(_outputSampleRate));
  console.assert(Number.isInteger(_frameLength));

  _inputBuffer = [];
}

function processAudio(inputFrame: Int16Array): void {
  for (let i = 0; i < inputFrame.length; i++) {
    _inputBuffer.push(inputFrame[i] * S_INT16_MAX);
  }

  while (
    (_inputBuffer.length * _outputSampleRate) / _inputSampleRate >
    _frameLength
  ) {
    const outputFrame = new Int16Array(_frameLength);
    let sum = 0;
    let num = 0;
    let outputIndex = 0;
    let inputIndex = 0;

    while (outputIndex < _frameLength) {
      sum = 0;
      num = 0;
      while (
        inputIndex <
        Math.min(
          _inputBuffer.length,
          ((outputIndex + 1) * _inputSampleRate) / _outputSampleRate,
        )
      ) {
        sum += _inputBuffer[inputIndex];
        num++;
        inputIndex++;
      }
      outputFrame[outputIndex] = sum / num;
      outputIndex++;
    }

    postMessage(outputFrame, undefined);

    _inputBuffer = _inputBuffer.slice(inputIndex);
  }
}

function reset(): void {
  _inputBuffer = [];
}

onmessage = function (event: MessageEvent<DownsamplingWorkerMessage>): void {
  switch (event.data.command) {
    case WorkerCommand.Init:
      init(
        event.data.inputSampleRate,
        event.data.outputSampleRate,
        event.data.frameLength,
      );
      break;
    case WorkerCommand.Process:
      processAudio(event.data.inputFrame);
      break;
    case WorkerCommand.Reset:
      reset();
      break;
    default:
      console.warn(
        `Unhandled message in downsampling_worker.ts: ${event.data.command}`,
      );
      break;
  }
};
