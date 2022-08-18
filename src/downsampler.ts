/*
    Copyright 2021 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

/* eslint camelcase: 0 */

import { arrayBufferToStringAtIndex, base64ToUint8Array } from '@picovoice/web-utils';
import { wasiSnapshotPreview1Emulator } from './wasi_snapshot';

const PV_STATUS_SUCCESS = 10000;

type pv_downsampler_convert_num_samples_to_input_sample_rate_type = (objectAddress: number, frameLength: number) => number;
type pv_downsampler_init_type = (inputFrequency: number, outputFrequency: number, order: number, objectAddressAddress: number) => number;
type pv_downsampler_process_type = (objectAddress: number, inputBufferAddress: number, inputBufferSize: number, outputBufferAddress: number) => number;
type pv_downsampler_reset_type = (objectAddress: number) => void;
type pv_downsampler_delete_type = (objectAddress: number) => number;

type DownsamplerWasmOutput = {
  inputBufferAddress: number;
  inputFrameLength: number;
  memory: WebAssembly.Memory;
  objectAddress: number;
  outputBufferAddress: number;
  pvDownsamplerConvertNumSamplesToInputSampleRate: pv_downsampler_convert_num_samples_to_input_sample_rate_type;
  pvDownsamplerInit: pv_downsampler_init_type;
  pvDownsamplerProcess: pv_downsampler_process_type;
  pvDownsamplerReset: pv_downsampler_reset_type;
  pvDownsamplerDelete: pv_downsampler_delete_type;
  frameLength: number;
  version: string;
};

class Downsampler {
  private readonly _pvDownsamplerConvertNumSamplesToInputSampleRate: pv_downsampler_convert_num_samples_to_input_sample_rate_type;
  private readonly _pvDownsamplerDelete: pv_downsampler_delete_type;
  private readonly _pvDownsamplerProcess: pv_downsampler_process_type;
  private readonly _pvDownsamplerReset: pv_downsampler_reset_type;

  private readonly _inputBufferAddress: number;
  private readonly _objectAddress: number;
  private readonly _outputBufferAddress: number;

  private _wasmMemory: WebAssembly.Memory;
  private _memoryBuffer: Int16Array;
  private _memoryBufferView: DataView;

  private readonly _frameLength: number;

  private static _wasm: string;
  public static _version: string;

  private constructor(handleWasm: DownsamplerWasmOutput) {
    Downsampler._version = handleWasm.version;

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

    this._frameLength = handleWasm.frameLength;
  }

  public static setWasm(wasm: string): void {
    if (this._wasm === undefined) {
      this._wasm = wasm;
    }
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
    // A WebAssembly page has a constant size of 64KiB. -> 4MiB ~= 64 pages
    // minimum memory requirements for init: 2 pages
    const memory = new WebAssembly.Memory({ initial: 64 });

    const memoryBufferUint8 = new Uint8Array(memory.buffer);

    const pvConsoleLogWasm = function(index: number): void {
      // eslint-disable-next-line no-console
      console.log(arrayBufferToStringAtIndex(memoryBufferUint8, index));
    };

    const pvAssertWasm = function(
      expr: number,
      line: number,
      fileNameAddress: number,
    ): void {
      if (expr === 0) {
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

    const wasmCodeArray = base64ToUint8Array(this._wasm);
    const { instance } = await WebAssembly.instantiate(
      wasmCodeArray,
      importObject,
    );

    const alignedAlloc = instance.exports.aligned_alloc as CallableFunction;
    const pvDownsamplerInit = instance.exports.pv_downsampler_init as pv_downsampler_init_type;
    const pvDownsamplerConvertNumSamplesToInputSampleRate =
      instance.exports.pv_downsampler_convert_num_samples_to_input_sample_rate as
        pv_downsampler_convert_num_samples_to_input_sample_rate_type;
    const pvDownsamplerVersion = instance.exports.pv_downsampler_version as CallableFunction;

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

    const versionAddress = await pvDownsamplerVersion();
    const version = arrayBufferToStringAtIndex(
      memoryBufferUint8,
      versionAddress,
    );

    if (status !== PV_STATUS_SUCCESS) {
      throw new Error(`pv_downsampler_init failed with status ${status}`);
    }
    const memoryBufferView = new DataView(memory.buffer);
    const objectAddress = memoryBufferView.getInt32(objectAddressAddress, true);

    const inputFrameLength = pvDownsamplerConvertNumSamplesToInputSampleRate(
      objectAddress,
      frameLength,
    );
    const inputBufferAddress = alignedAlloc(
      Int16Array.BYTES_PER_ELEMENT,
      (inputFrameLength + 1) * Int16Array.BYTES_PER_ELEMENT,
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
      .pv_downsampler_reset as pv_downsampler_reset_type;
    const pvDownsamplerProcess = instance.exports
      .pv_downsampler_process as pv_downsampler_process_type;
    const pvDownsamplerDelete = instance.exports
      .pv_downsampler_delete as pv_downsampler_delete_type;

    return {
      inputBufferAddress: inputBufferAddress,
      inputFrameLength: inputFrameLength,
      memory: memory,
      objectAddress: objectAddress,
      outputBufferAddress: outputBufferAddress,
      pvDownsamplerConvertNumSamplesToInputSampleRate,
      pvDownsamplerInit: pvDownsamplerInit,
      pvDownsamplerProcess: pvDownsamplerProcess,
      pvDownsamplerReset: pvDownsamplerReset,
      pvDownsamplerDelete: pvDownsamplerDelete,
      frameLength: frameLength,
      version: version,
    };
  }

  public process(
    inputFrame: Int16Array | Float32Array,
    inputBufferSize: number,
    outputBuffer: Int16Array,
  ): number {
    if (inputFrame.length > this._frameLength) {
      throw new Error(`InputFrame length '${inputFrame.length}' must be smaller than ${this._frameLength}.`);
    }
    if (inputBufferSize > this._frameLength) {
      inputBufferSize = this._frameLength;
    }

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
      inputBuffer = inputFrame;
    } else {
      throw new Error(`Invalid inputFrame type: ${typeof inputFrame}. Expected Float32Array or Int16Array.`);
    }

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
        this._outputBufferAddress + i * Int16Array.BYTES_PER_ELEMENT,
        true,
      );
    }
    return processedSamples;
  }

  public reset(): void {
    this._pvDownsamplerReset(this._objectAddress);
  }

  public release(): void {
    this._pvDownsamplerDelete(this._objectAddress);
  }

  get version(): string {
    return Downsampler._version;
  }

  public getNumRequiredInputSamples(numSample: number): number {
    return this._pvDownsamplerConvertNumSamplesToInputSampleRate(
      this._objectAddress,
      numSample,
    );
  }
}

export default Downsampler;
