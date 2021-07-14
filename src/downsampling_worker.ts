/*
    Copyright 2018-2021 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

import { DownsamplingWorkerRequest } from './worker_types';

import Downsampler from './downsampler';

const PV_FRAME_LENGTH = 512;
const PV_SAMPLE_RATE = 16000;
const PV_FILTER_ORDER = 50;

let _downsampler: Downsampler;
let _outputframeLength: number;
let _inputBuffer: Int16Array;
let _outputBuffer: Int16Array;

let _audioDumpActive: boolean;
let _audioDumpBuffer: Int16Array;
let _audioDumpBufferIndex: number;
let _audioDumpNumSamples: number;

async function init(
  inputSampleRate: number,
  outputSampleRate: number = PV_SAMPLE_RATE,
  frameLength: number = PV_FRAME_LENGTH,
): Promise<void> {
  if (!Number.isInteger(inputSampleRate)) {
    throw new Error(`Invalid inputSampleRate value: ${inputSampleRate}. Expected integer.`);
  }
  if (!Number.isInteger(outputSampleRate)) {
    throw new Error(`Invalid outputSampleRate value: ${outputSampleRate}. Expected integer.`);
  }
  if (!Number.isInteger(frameLength)) {
    throw new Error(`Invalid frameLength value: ${frameLength}. Expected integer.`);
  }

  _outputframeLength = frameLength;

  _downsampler = await Downsampler.create(
    inputSampleRate,
    outputSampleRate,
    PV_FILTER_ORDER,
    _outputframeLength,
  );

  postMessage(
    {
      command: 'ds-ready',
    },
    undefined as any,
  );
}

function startAudioDump(durationMs: number = 3000): void {
  _audioDumpNumSamples = (durationMs * PV_SAMPLE_RATE) / 1000;
  _audioDumpActive = true;
  _audioDumpBufferIndex = 0;
  _audioDumpBuffer = new Int16Array(_audioDumpNumSamples);
}

function processAudio(inputFrame: Float32Array): void {
  if (inputFrame.constructor !== Float32Array) {
    throw new Error(`Invalid inputFrame type: ${typeof inputFrame}. Expected Float32Array.`);
  }
  _inputBuffer = new Int16Array(inputFrame.length);
  for (let i = 0; i < inputFrame.length; i++) {
    if (inputFrame[i] < 0) {
      _inputBuffer[i] = 0x8000 * inputFrame[i];
    } else {
      _inputBuffer[i] = 0x7fff * inputFrame[i];
    }
  }

  while (_inputBuffer.length > 0) {
    const numInputSamples =
      _downsampler.getNumRequiredInputSamples(_outputframeLength);
    const numInputSamplesToRead = Math.min(
      numInputSamples,
      _inputBuffer.length,
    );
    _outputBuffer = new Int16Array(_outputframeLength);
    const processedSamples = _downsampler.process(
      _inputBuffer.slice(0, numInputSamplesToRead),
      numInputSamplesToRead,
      _outputBuffer,
    );

    if (_audioDumpActive) {
      const numSamplesToCopy = Math.min(
        processedSamples,
        _audioDumpNumSamples - _audioDumpBufferIndex,
      );
      _audioDumpBuffer.set(
        _outputBuffer.slice(0, numSamplesToCopy),
        _audioDumpBufferIndex,
      );
      _audioDumpBufferIndex += numSamplesToCopy;

      if (_audioDumpBufferIndex === _audioDumpNumSamples) {
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
    _outputBuffer = new Int16Array(_outputframeLength);
    _inputBuffer = _inputBuffer.slice(numInputSamplesToRead);
  }
}

function reset(): void {
  _downsampler.reset();
  _outputBuffer = new Int16Array(_outputframeLength);
}

onmessage = function (event: MessageEvent<DownsamplingWorkerRequest>): void {
  switch (event.data.command) {
    case 'init':
      init(
        event.data.inputSampleRate,
        event.data.outputSampleRate,
        event.data.frameLength,
      );
      break;
    case 'process':
      processAudio(event.data.inputFrame);
      break;
    case 'reset':
      reset();
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
