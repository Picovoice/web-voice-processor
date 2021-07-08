/*
    Copyright 2018-2021 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

import { DownsamplingWorkerRequest, DownsamplingWorkerWasm } from './worker_types';
import { wasiSnapshotPreview1Emulator } from './wasi_snapshot';
import { WASM_BASE64 } from './downsampler_base64';

function arrayBufferToStringAtIndex(
  arrayBuffer: Uint8Array,
  index: number,
): string {
  let stringBuffer = '';
  let indexBuffer = index;
  while (true) {
    if (arrayBuffer[indexBuffer] === 0) {
      break;
    }
    stringBuffer += String.fromCharCode(arrayBuffer[indexBuffer++]);
  }
  return stringBuffer;
}

const PV_FRAME_LENGTH = 512;
const PV_SAMPLE_RATE = 16000;
const S_INT16_MAX = 32767;

let _inputBuffer: Int16Array;
let _inputSampleRate: number;
let _outputSampleRate: number;
let _outputframeLength: number;
let _outputFrame: Int16Array;
let _outputIndex: number;

let _downsamplerWasm: DownsamplingWorkerWasm;
let _downsamplerFilterOrder: number;

let _audioDumpActive: boolean;
let _audioDumpBuffer: Int16Array;
let _audioDumpBufferIndex: number;
let _audioDumpNumFrames: number;

async function initDownsamplerWasm(
  inputFrequency: number,
  outputFrequency: number = PV_SAMPLE_RATE,
  order: number = 30,
  frameLength: number = PV_FRAME_LENGTH): Promise<DownsamplingWorkerWasm> {
  const memory = new WebAssembly.Memory({ initial: 100, maximum: 100 });

  const pvConsoleLogWasm = function (index: number): void {
    const memoryBufferUint8 = new Uint8Array(memory.buffer);
    console.log(arrayBufferToStringAtIndex(memoryBufferUint8, index));
  };
  const pvAssertWasm = function (
    expr: number,
    line: number,
    fileNameAddress: number,
  ): void {
    if (expr === 0) {
      const memoryBufferUint8 = new Uint8Array(memory.buffer);
      const fileName = arrayBufferToStringAtIndex(
        memoryBufferUint8,
        fileNameAddress,
      );
      throw new Error(`assertion failed at line ${line} in "${fileName}"`);
    }
  };

  const importObject = {
    // eslint-disable-next-line camelcase
    wasi_snapshot_preview1: wasiSnapshotPreview1Emulator,
    env: {
      memory: memory,
      // eslint-disable-next-line camelcase
      pv_console_log_wasm: pvConsoleLogWasm,
      // eslint-disable-next-line camelcase
      pv_assert_wasm: pvAssertWasm,
    },
  };

  const wasmBase64 = atob(WASM_BASE64);
  const wasmCodeArray = new Uint8Array(wasmBase64.length);
  for (let i = 0; i < wasmBase64.length; i++) {
    wasmCodeArray[i] = wasmBase64.charCodeAt(i);
  }
  const { instance } = await WebAssembly.instantiate(wasmCodeArray, importObject);

  // const {
  //   aligned_alloc,
  //   free,
  //   pv_downsampler_init,
  //   pv_downsampler_get_output_size,
  //   pv_downsampler_process,
  // } = instance.exports;
  const alignedAlloc = instance.exports.aligned_alloc as CallableFunction;
  const pvDownsamplerInit = instance.exports.pv_downsampler_init as CallableFunction;
  const pvDownsamplerConvertNumSamplesToInputSampleRate = instance.exports.pv_downsampler_convert_num_samples_to_input_sample_rate as CallableFunction;

  const objectAddressAddress = alignedAlloc(
    Int32Array.BYTES_PER_ELEMENT,
    Int32Array.BYTES_PER_ELEMENT,
  );
  if (objectAddressAddress === 0) {
    throw new Error('malloc failed: Cannot allocate memory');
  }
  const status = pvDownsamplerInit(
    inputFrequency,
    outputFrequency,
    order,
    objectAddressAddress,
  );
  if (status !== 0) {
    throw new Error(`pv_downsampler_init failed with status ${status}`);
  }
  const memoryBufferView = new DataView(memory.buffer);
  const objectAddress = memoryBufferView.getInt32(objectAddressAddress, true);

  const inputframeLength = pvDownsamplerConvertNumSamplesToInputSampleRate(objectAddress, frameLength);
  const inputBufferAddress = alignedAlloc(
    Int16Array.BYTES_PER_ELEMENT,
    inputframeLength * Int16Array.BYTES_PER_ELEMENT);
  if (inputBufferAddress === 0) {
    throw new Error('malloc failed: Cannot allocate memory');
  }
  const outputBufferAddress = alignedAlloc(
    Int16Array.BYTES_PER_ELEMENT,
    frameLength * Int16Array.BYTES_PER_ELEMENT);
  if (outputBufferAddress === 0) {
    throw new Error('malloc failed: Cannot allocate memory');
  }

  return {
    exports: instance.exports,
    inputBufferAddress: inputBufferAddress,
    inputframeLength: inputframeLength,
    memory: memory,
    objectAddress: objectAddress,
    outputBufferAddress: outputBufferAddress,
  };
}

async function init(
  inputSampleRate: number,
  outputSampleRate: number = PV_SAMPLE_RATE,
  frameLength: number = PV_FRAME_LENGTH,
): Promise<void> {
  _inputSampleRate = inputSampleRate;
  _outputSampleRate = outputSampleRate;
  _outputframeLength = frameLength;

  console.assert(Number.isInteger(_inputSampleRate));
  console.assert(Number.isInteger(_outputSampleRate));
  console.assert(Number.isInteger(_outputframeLength));

  _downsamplerFilterOrder = 30;
  _downsamplerWasm = await initDownsamplerWasm(_inputSampleRate, _outputSampleRate, _downsamplerFilterOrder, _outputframeLength);

  _outputFrame = new Int16Array(_outputframeLength);
  _outputIndex = 0;
}

function startAudioDump(durationMs: number = 3000): void {
  _audioDumpNumFrames = durationMs * (PV_FRAME_LENGTH / PV_SAMPLE_RATE);
  _audioDumpActive = true;
  _audioDumpBufferIndex = 0;
  _audioDumpBuffer = new Int16Array(_audioDumpNumFrames * _outputframeLength);
}

function processAudio(inputFrame: Float32Array): void {
  _inputBuffer = new Int16Array(inputFrame.length);
  for (let i = 0; i < inputFrame.length; i++) {
    if (inputFrame[i] < 0) {
      _inputBuffer[i] = 0x8000 * inputFrame[i];
    } else {
      _inputBuffer[i] = 0x7FFF * inputFrame[i];
    }
  }
  const pvDownsamplerConvertNumSamplesToInputSampleRate = _downsamplerWasm.exports.pv_downsampler_convert_num_samples_to_input_sample_rate as CallableFunction;
  const pvDownsamplerProcess = _downsamplerWasm.exports.pv_downsampler_process as CallableFunction;
  const memoryBuffer = new Int16Array(_downsamplerWasm.memory.buffer);
  const memoryBufferView = new DataView(_downsamplerWasm.memory.buffer);

  while (_inputBuffer.length > 0) {
    const numSampleToRead = pvDownsamplerConvertNumSamplesToInputSampleRate(_downsamplerWasm.objectAddress, _outputframeLength);
    const actualNumSampleToRead = Math.min(numSampleToRead, _inputBuffer.length);
    memoryBuffer.set(_inputBuffer.slice(0, actualNumSampleToRead), _downsamplerWasm.inputBufferAddress / Int16Array.BYTES_PER_ELEMENT);
    const processedSample = pvDownsamplerProcess(_downsamplerWasm.objectAddress, _downsamplerWasm.inputBufferAddress, actualNumSampleToRead, _downsamplerWasm.outputBufferAddress);
    for (let i = 0; i < processedSample; i++) {
      _outputFrame[_outputIndex++] = memoryBufferView.getInt16(_downsamplerWasm.outputBufferAddress + i * Int16Array.BYTES_PER_ELEMENT, true);
      if (_outputIndex === _outputframeLength) {
        if (_audioDumpActive) {
          _audioDumpBuffer.set(_outputFrame, _audioDumpBufferIndex * _outputframeLength);
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
            outputFrame: _outputFrame,
          },
          undefined as any,
        );
        _outputFrame = new Int16Array(_outputframeLength);
        _outputIndex = 0;
      }
    }
    _inputBuffer = _inputBuffer.slice(actualNumSampleToRead);
  }
}

function reset(): void {
  // inputBuffer = [];
  const pvDownsamplerReset = _downsamplerWasm.exports.pv_downsampler_reset as CallableFunction;
  pvDownsamplerReset(_downsamplerWasm.objectAddress);
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
