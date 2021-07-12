/*
    Copyright 2018-2021 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

import {
  DownsamplingWorkerRequest,
  DownsamplerWasmOutput,
  DownsamplerInterface,
} from './worker_types';
import { wasiSnapshotPreview1Emulator } from './wasi_snapshot';
import { WASM_BASE64 } from './downsampler_base64';

class Downsampler implements DownsamplerInterface {
  private _pvDownsamplerConvertNumSamplesToInputSampleRate: CallableFunction;
  private _pvDownsamplerDelete: CallableFunction;
  private _pvDownsamplerProcess: CallableFunction;
  private _pvDownsamplerReset: CallableFunction;

  private _inputBufferAddress: number;
  private _objectAddress: number;
  private _outputBufferAddress: number;
  private _wasmMemory: WebAssembly.Memory;

  private _memoryBuffer: Int16Array;
  private _memoryBufferView: DataView;

  private constructor(handleWasm: DownsamplerWasmOutput) {
    this._pvDownsamplerConvertNumSamplesToInputSampleRate =
      handleWasm.pvDownsamplerConvertNumSamplesToInputSampleRate;
    this._pvDownsamplerReset = handleWasm.pvDownsamplerReset;
    this._pvDownsamplerProcess = handleWasm.pvDownsamplerProcess;
    this._pvDownsamplerDelete = handleWasm.pvDownsamplerDelete;

    this._wasmMemory = handleWasm.memory;
    this._inputBufferAddress = handleWasm.inputBufferAddress;
    this._objectAddress = handleWasm.objectAddress;
    this._outputBufferAddress = handleWasm.outputBufferAddress;

    this._memoryBuffer = new Int16Array(handleWasm.memory.buffer);
    this._memoryBufferView = new DataView(handleWasm.memory.buffer);
  }

  public static async create(
    inputFrequency: number,
    outputFrequency: number,
    order: number,
    frameLength: number,
  ): Promise<Downsampler> {
    const wasmOutput = await Downsampler.initWasm(
      inputFrequency,
      outputFrequency,
      order,
      frameLength,
    );

    return new Downsampler(wasmOutput);
  }

  private static async initWasm(
    inputFrequency: number,
    outputFrequency: number,
    order: number,
    frameLength: number,
  ): Promise<DownsamplerWasmOutput> {
    const memory = new WebAssembly.Memory({ initial: 100, maximum: 100 });

    const pvConsoleLogWasm = function (index: number): void {
      const memoryBufferUint8 = new Uint8Array(memory.buffer);
      console.log(
        Downsampler.arrayBufferToStringAtIndex(memoryBufferUint8, index),
      );
    };
    const pvAssertWasm = function (
      expr: number,
      line: number,
      fileNameAddress: number,
    ): void {
      if (expr === 0) {
        const memoryBufferUint8 = new Uint8Array(memory.buffer);
        const fileName = Downsampler.arrayBufferToStringAtIndex(
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
    const { instance } = await WebAssembly.instantiate(
      wasmCodeArray,
      importObject,
    );

    const alignedAlloc = instance.exports.aligned_alloc as CallableFunction;
    const pvDownsamplerInit = instance.exports
      .pv_downsampler_init as CallableFunction;
    const pvDownsamplerConvertNumSamplesToInputSampleRate = instance.exports
      .pv_downsampler_convert_num_samples_to_input_sample_rate as CallableFunction;

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

    const inputframeLength = pvDownsamplerConvertNumSamplesToInputSampleRate(
      objectAddress,
      frameLength,
    );
    const inputBufferAddress = alignedAlloc(
      Int16Array.BYTES_PER_ELEMENT,
      inputframeLength * Int16Array.BYTES_PER_ELEMENT,
    );
    if (inputBufferAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }
    const outputBufferAddress = alignedAlloc(
      Int16Array.BYTES_PER_ELEMENT,
      frameLength * Int16Array.BYTES_PER_ELEMENT,
    );
    if (outputBufferAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }

    const pvDownsamplerReset = instance.exports
      .pvDownsamplerReset as CallableFunction;
    const pvDownsamplerProcess = instance.exports
      .pv_downsampler_process as CallableFunction;
    const pvDownsamplerDelete = instance.exports
      .pv_downsampler_delete as CallableFunction;

    return {
      inputBufferAddress: inputBufferAddress,
      inputframeLength: inputframeLength,
      memory: memory,
      objectAddress: objectAddress,
      outputBufferAddress: outputBufferAddress,
      pvDownsamplerConvertNumSamplesToInputSampleRate:
        pvDownsamplerConvertNumSamplesToInputSampleRate,
      pvDownsamplerInit: pvDownsamplerInit,
      pvDownsamplerProcess: pvDownsamplerProcess,
      pvDownsamplerReset: pvDownsamplerReset,
      pvDownsamplerDelete: pvDownsamplerDelete,
    };
  }

  public process(
    inputBuffer: Int16Array,
    inputBufferSize: number,
    outputBuffer: Int16Array,
  ): number {
    this._memoryBuffer.set(
      inputBuffer,
      this._inputBufferAddress / Int16Array.BYTES_PER_ELEMENT,
    );

    const processedSamples = this._pvDownsamplerProcess(
      this._objectAddress,
      this._inputBufferAddress,
      inputBufferSize,
      this._outputBufferAddress,
    );
    for (let i = 0; i < processedSamples; i++) {
      outputBuffer[i] = this._memoryBufferView.getInt16(
        this._outputBufferAddress + (i * Int16Array.BYTES_PER_ELEMENT),
        true,
      );
    }
    return processedSamples;
  }

  public reset(): void {
    this._pvDownsamplerReset(this._objectAddress);
  }

  public delete(): void {
    this._pvDownsamplerDelete(this._objectAddress);
  }

  public getrequiredNumInputSamples(numSample: number): number {
    return this._pvDownsamplerConvertNumSamplesToInputSampleRate(
      this._objectAddress,
      numSample,
    );
  }

  private static arrayBufferToStringAtIndex(
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
}

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
  console.assert(Number.isInteger(inputSampleRate));
  console.assert(Number.isInteger(outputSampleRate));
  console.assert(Number.isInteger(frameLength));

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
  console.assert(inputFrame.constructor === Float32Array);
  _inputBuffer = new Int16Array(inputFrame.length);
  for (let i = 0; i < inputFrame.length; i++) {
    if (inputFrame[i] < 0) {
      _inputBuffer[i] = 0x8000 * inputFrame[i];
    } else {
      _inputBuffer[i] = 0x7fff * inputFrame[i];
    }
  }

  while (_inputBuffer.length > 0) {
    const NumInputSamples =
      _downsampler.getrequiredNumInputSamples(_outputframeLength);
    const NumInputSamplesToRead = Math.min(
      NumInputSamples,
      _inputBuffer.length,
    );
    _outputBuffer = new Int16Array(_outputframeLength);
    const processedSamples = _downsampler.process(
      _inputBuffer.slice(0, NumInputSamplesToRead),
      NumInputSamplesToRead,
      _outputBuffer,
    );

    if (_audioDumpActive) {
      const NumSamplesToCopy = Math.min(
        processedSamples,
        _audioDumpNumSamples - _audioDumpBufferIndex,
      );
      _audioDumpBuffer.set(
        _outputBuffer.slice(0, NumSamplesToCopy),
        _audioDumpBufferIndex,
      );
      _audioDumpBufferIndex += NumSamplesToCopy;

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
    _inputBuffer = _inputBuffer.slice(NumInputSamplesToRead);
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
