/*
    Copyright 2018-2021 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

import {
  WorkerCommand,
  DownsamplingWorkerCommandInput,
  DownsamplingWorkerMessageInput,
  DownsamplingWorkerCommandOutput,
} from './worker_types';

const PV_FRAME_LENGTH = 512;
const PV_SAMPLE_RATE = 16000;
const S_INT16_MAX = 32767;

let _inputSampleRate: number;
let _outputSampleRate: number;
let _frameLength: number;
let _inputBuffer: Array<number> = [];

let _audioDumpActive: boolean;
let _audioDumpBuffer: Int16Array;
let _audioDumpBufferIndex: number;
let _audioDumpNumFrames: number;

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

function startAudioDump(durationMs: number): void {
  _audioDumpNumFrames = durationMs * (PV_FRAME_LENGTH / PV_SAMPLE_RATE);
  _audioDumpActive = true;
  _audioDumpBufferIndex = 0;
  _audioDumpBuffer = new Int16Array(_audioDumpNumFrames * _frameLength);
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

    if (_audioDumpActive) {
      _audioDumpBuffer.set(outputFrame, _audioDumpBufferIndex * _frameLength);
      _audioDumpBufferIndex++;

      if (_audioDumpBufferIndex === _audioDumpNumFrames) {
        _audioDumpActive = false;
        // Done collecting frames, create a Blob and send it to main thread
        const pcmBlob = new Blob([_audioDumpBuffer], {
          type: 'application/octet-stream',
        });

        postMessage(
          {
            command: DownsamplingWorkerCommandOutput.AudioDumpComplete,
            blob: pcmBlob,
          },
          undefined,
        );
      }
    }

    postMessage(
      {
        command: 'output',
        outputFrame: outputFrame,
      },
      undefined,
    );

    _inputBuffer = _inputBuffer.slice(inputIndex);
  }
}

function reset(): void {
  _inputBuffer = [];
}

onmessage = function (
  event: MessageEvent<DownsamplingWorkerMessageInput>,
): void {
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
    case DownsamplingWorkerCommandInput.StartAudioDump:
      startAudioDump(event.data.durationMs);
      break;
    default:
      console.warn(
        `Unhandled message in downsampling_worker.ts: ${event.data.command}`,
      );
      break;
  }
};
