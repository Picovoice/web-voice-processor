/*
    Copyright 2018-2021 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

import {DownsamplingWorkerRequest} from './worker_types';

import Downsampler from './downsampler';

const PV_FRAME_LENGTH = 512;
const PV_SAMPLE_RATE = 16000;
const PV_FILTER_ORDER = 50;

let _downsampler: Downsampler;
let _outputframeLength: number;
let _oldInputBuffer: Int16Array;
let _outputBuffer: Int16Array;

let _audioDumpActive: boolean;
let _audioDumpBuffer: Int16Array;
let _audioDumpBufferIndex: number;
let _audioDumpNumFrames: number;

async function init(
  inputSampleRate: number,
  outputSampleRate: number = PV_SAMPLE_RATE,
  frameLength: number = PV_FRAME_LENGTH,
  filterOrder: number = PV_FILTER_ORDER,
): Promise<void> {
  if (!Number.isInteger(inputSampleRate)) {
    throw new Error(
      `Invalid inputSampleRate value: ${inputSampleRate}. Expected integer.`,
    );
  }
  if (!Number.isInteger(outputSampleRate)) {
    throw new Error(
      `Invalid outputSampleRate value: ${outputSampleRate}. Expected integer.`,
    );
  }
  if (!Number.isInteger(frameLength)) {
    throw new Error(
      `Invalid frameLength value: ${frameLength}. Expected integer.`,
    );
  }

  _outputframeLength = frameLength;
  _oldInputBuffer = new Int16Array([]);

  try {
    _downsampler = await Downsampler.create(
      inputSampleRate,
      outputSampleRate,
      filterOrder,
      _outputframeLength,
    );

    postMessage(
      {
        command: 'ds-ready',
      },
      undefined as any,
    );
  } catch (error) {
    const errorMessage = error.toString();
    postMessage(
      {
        command: 'ds-failed',
        message: errorMessage,
      },
      undefined as any,
    );
  }
}

function startAudioDump(durationMs: number = 3000): void {
  _audioDumpNumFrames = Math.floor(
    (durationMs * PV_SAMPLE_RATE) / 1000 / PV_FRAME_LENGTH,
  );
  _audioDumpActive = true;
  _audioDumpBufferIndex = 0;
  _audioDumpBuffer = new Int16Array(_audioDumpNumFrames * _outputframeLength);
}

function processAudio(inputFrame: Float32Array | Int16Array): void {
  let inputBuffer = new Int16Array(inputFrame.length);
  if (inputFrame.constructor === Float32Array) {
    for (let i = 0; i < inputFrame.length; i++) {
      if (inputFrame[i] < 0) {
        inputBuffer[i] = 0x8000 * inputFrame[i];
      } else {
        inputBuffer[i] = 0x7fff * inputFrame[i];
      }
    }
  } else if (inputFrame.constructor === Int16Array) {
    inputBuffer = inputFrame
  } else {
    throw new Error(
        `Invalid inputFrame type: ${typeof inputFrame}. Expected Float32Array or Int16Array.`,
    );
  }

  let inputBufferExtended = new Int16Array(
    _oldInputBuffer.length + inputBuffer.length,
  );
  inputBufferExtended.set(_oldInputBuffer);
  inputBufferExtended.set(inputBuffer, _oldInputBuffer.length);
  _oldInputBuffer = new Int16Array([]);

  while (inputBufferExtended.length > 0) {
    // +1 is for the extra needed sample for the interpolation
    const numInputSamples = _downsampler.getNumRequiredInputSamples(_outputframeLength) + 1;
    if (numInputSamples > inputBufferExtended.length) {
      _oldInputBuffer = new Int16Array(inputBufferExtended.length);
      _oldInputBuffer.set(inputBufferExtended);
      inputBufferExtended = inputBufferExtended.slice(
        inputBufferExtended.length,
      );
    } else {
      _outputBuffer = new Int16Array(_outputframeLength);
      _downsampler.process(
        inputBufferExtended.slice(0, numInputSamples),
        numInputSamples,
        _outputBuffer,
      );
      if (_audioDumpActive) {
        _audioDumpBuffer.set(
          _outputBuffer,
          _audioDumpBufferIndex * _outputframeLength,
        );
        _audioDumpBufferIndex++;

        if (_audioDumpBufferIndex === _audioDumpNumFrames) {
          _audioDumpActive = false;
          // Done collecting frames, create a Blob and send it to main thread
          const pcmBlob = new Blob([_audioDumpBuffer], {
            type: 'application/octet-stream',
          });

          postMessage(
            {
              command: 'audio_dump_complete',
              blob: pcmBlob,
            },
            undefined as any,
          );
        }
      }

      postMessage(
        {
          command: 'output',
          outputFrame: _outputBuffer,
        },
        undefined as any,
      );
      inputBufferExtended = inputBufferExtended.slice(numInputSamples);
    }
  }
}

function reset(): void {
  _downsampler.reset();
  _oldInputBuffer = new Int16Array([]);
}

function release(): void {
  _downsampler.delete();
}

onmessage = function (event: MessageEvent<DownsamplingWorkerRequest>): void {
  switch (event.data.command) {
    case 'init':
      init(
        event.data.inputSampleRate,
        event.data.outputSampleRate,
        event.data.frameLength,
        event.data.filterOrder,
      );
      break;
    case 'process':
      processAudio(event.data.inputFrame);
      break;
    case 'reset':
      reset();
      break;
    case 'release':
      release();
      break;
    case 'start_audio_dump':
      startAudioDump(event.data.durationMs);
      break;
    default:
      console.warn(
        `Unhandled message in downsampling_worker.ts: ${event.data.command}`,
      );
      break;
  }
};
