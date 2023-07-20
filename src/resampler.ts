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

type pv_resampler_convert_num_samples_to_input_sample_rate_type = (objectAddress: number, frameLength: number) => number;
type pv_resampler_convert_num_samples_to_output_sample_rate_type = (objectAddress: number, frameLength: number) => number;
type pv_resampler_init_type = (inputFrequency: number, outputFrequency: number, order: number, objectAddressAddress: number) => number;
type pv_resampler_process_type = (objectAddress: number, inputBufferAddress: number, inputBufferSize: number, outputBufferAddress: number) => number;
type pv_resampler_reset_type = (objectAddress: number) => void;
type pv_resampler_delete_type = (objectAddress: number) => number;
type pv_resampler_version_type = () => number;
type aligned_alloc_type = (alignment: number, size: number) => number;

type ResamplerWasmOutput = {
  cAlignedAlloc: aligned_alloc_type;
  frameLength: number;
  inputBufferAddress: number;
  inputFrameLength: number;
  memory: WebAssembly.Memory;
  objectAddress: number;
  outputBufferAddress: number;
  pvResamplerConvertNumSamplesToInputSampleRate: pv_resampler_convert_num_samples_to_input_sample_rate_type;
  pvResamplerConvertNumSamplesToOutputSampleRate: pv_resampler_convert_num_samples_to_output_sample_rate_type;
  pvResamplerDelete: pv_resampler_delete_type;
  pvResamplerInit: pv_resampler_init_type;
  pvResamplerProcess: pv_resampler_process_type;
  pvResamplerReset: pv_resampler_reset_type;
  version: string;
};

class Resampler {
  private readonly _pvResamplerConvertNumSamplesToInputSampleRate: pv_resampler_convert_num_samples_to_input_sample_rate_type;
  private readonly _pvResamplerConvertNumSamplesToOutputSampleRate: pv_resampler_convert_num_samples_to_output_sample_rate_type;
  private readonly _pvResamplerDelete: pv_resampler_delete_type;
  private readonly _pvResamplerProcess: pv_resampler_process_type;
  private readonly _pvResamplerReset: pv_resampler_reset_type;

  private readonly _cAlignedAlloc: aligned_alloc_type;

  private readonly _inputBufferAddress: number;
  private readonly _objectAddress: number;
  private readonly _outputBufferAddress: number;

  private _wasmMemory: WebAssembly.Memory;

  private readonly _frameLength: number;
  private readonly _inputBufferLength: number;

  private static _wasm: string;
  public static _version: string;

  private constructor(handleWasm: ResamplerWasmOutput) {
    Resampler._version = handleWasm.version;

    this._pvResamplerConvertNumSamplesToInputSampleRate =
      handleWasm.pvResamplerConvertNumSamplesToInputSampleRate;
    this._pvResamplerConvertNumSamplesToOutputSampleRate =
      handleWasm.pvResamplerConvertNumSamplesToOutputSampleRate;
    this._pvResamplerReset = handleWasm.pvResamplerReset;
    this._pvResamplerProcess = handleWasm.pvResamplerProcess;
    this._pvResamplerDelete = handleWasm.pvResamplerDelete;

    this._cAlignedAlloc = handleWasm.cAlignedAlloc;

    this._wasmMemory = handleWasm.memory;
    this._inputBufferAddress = handleWasm.inputBufferAddress;
    this._objectAddress = handleWasm.objectAddress;
    this._outputBufferAddress = handleWasm.outputBufferAddress;

    this._frameLength = handleWasm.frameLength;
    this._inputBufferLength = handleWasm.inputFrameLength;
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
  ): Promise<Resampler> {
    const wasmOutput = await Resampler.initWasm(
      inputFrequency,
      outputFrequency,
      order,
      frameLength,
    );

    return new Resampler(wasmOutput);
  }

  private static async initWasm(
    inputFrequency: number,
    outputFrequency: number,
    order: number,
    frameLength: number,
  ): Promise<ResamplerWasmOutput> {
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

    const cAlignedAlloc = instance.exports.aligned_alloc as aligned_alloc_type;

    const pvResamplerInit = instance.exports.pv_resampler_init as pv_resampler_init_type;
    const pvResamplerConvertNumSamplesToInputSampleRate =
      instance.exports.pv_resampler_convert_num_samples_to_input_sample_rate as
        pv_resampler_convert_num_samples_to_input_sample_rate_type;
    const pvResamplerConvertNumSamplesToOutputSampleRate =
      instance.exports.pv_resampler_convert_num_samples_to_output_sample_rate as
        pv_resampler_convert_num_samples_to_output_sample_rate_type;
    const pvResamplerVersion = instance.exports.pv_resampler_version as pv_resampler_version_type;

    const objectAddressAddress = cAlignedAlloc(
      Int32Array.BYTES_PER_ELEMENT,
      Int32Array.BYTES_PER_ELEMENT,
    );
    if (objectAddressAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }
    const status = pvResamplerInit(
      inputFrequency,
      outputFrequency,
      order,
      objectAddressAddress,
    );

    const versionAddress = pvResamplerVersion();
    const version = arrayBufferToStringAtIndex(
      memoryBufferUint8,
      versionAddress,
    );

    if (status !== PV_STATUS_SUCCESS) {
      throw new Error(`pv_resampler_init failed with status ${status}`);
    }
    const memoryBufferView = new DataView(memory.buffer);
    const objectAddress = memoryBufferView.getInt32(objectAddressAddress, true);

    const inputFrameLength = pvResamplerConvertNumSamplesToInputSampleRate(objectAddress, frameLength) + 1;

    const inputBufferAddress = cAlignedAlloc(
      Int16Array.BYTES_PER_ELEMENT,
      inputFrameLength * Int16Array.BYTES_PER_ELEMENT,
    );
    if (inputBufferAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }
    const outputBufferAddress = cAlignedAlloc(
      Int16Array.BYTES_PER_ELEMENT,
      frameLength * Int16Array.BYTES_PER_ELEMENT,
    );
    if (outputBufferAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }

    const pvResamplerReset = instance.exports
      .pv_resampler_reset as pv_resampler_reset_type;
    const pvResamplerProcess = instance.exports
      .pv_resampler_process as pv_resampler_process_type;
    const pvResamplerDelete = instance.exports
      .pv_resampler_delete as pv_resampler_delete_type;

    return {
      cAlignedAlloc: cAlignedAlloc,
      frameLength: frameLength,
      inputBufferAddress: inputBufferAddress,
      inputFrameLength: inputFrameLength,
      memory: memory,
      objectAddress: objectAddress,
      outputBufferAddress: outputBufferAddress,
      pvResamplerConvertNumSamplesToInputSampleRate,
      pvResamplerConvertNumSamplesToOutputSampleRate,
      pvResamplerDelete: pvResamplerDelete,
      pvResamplerInit: pvResamplerInit,
      pvResamplerProcess: pvResamplerProcess,
      pvResamplerReset: pvResamplerReset,
      version: version,
    };
  }

  public process(
    inputFrame: Int16Array | Float32Array,
    outputBuffer: Int16Array,
  ): number {
    if (inputFrame.length > this._inputBufferLength) {
      throw new Error(`InputFrame length '${inputFrame.length}' must be smaller than ${this._inputBufferLength}.`);
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

    const memoryBuffer = new Int16Array(this._wasmMemory.buffer);

    memoryBuffer.set(
      inputBuffer,
      this._inputBufferAddress / Int16Array.BYTES_PER_ELEMENT,
    );

    const processedSamples = this._pvResamplerProcess(
      this._objectAddress,
      this._inputBufferAddress,
      inputFrame.length,
      this._outputBufferAddress,
    );

    const memoryBufferView = new DataView(this._wasmMemory.buffer);

    for (let i = 0; i < processedSamples; i++) {
      outputBuffer[i] = memoryBufferView.getInt16(
        this._outputBufferAddress + i * Int16Array.BYTES_PER_ELEMENT,
        true,
      );
    }
    return processedSamples;
  }

  public reset(): void {
    this._pvResamplerReset(this._objectAddress);
  }

  public release(): void {
    this._pvResamplerDelete(this._objectAddress);
  }


  get inputBufferLength(): number {
    return this._inputBufferLength;
  }

  get frameLength(): number {
    return this._frameLength;
  }

  get version(): string {
    return Resampler._version;
  }

  public getNumRequiredInputSamples(numSample: number): number {
    return this._pvResamplerConvertNumSamplesToInputSampleRate(
      this._objectAddress,
      numSample,
    );
  }

  public getNumRequiredOutputSamples(numSample: number): number {
    return this._pvResamplerConvertNumSamplesToOutputSampleRate(
      this._objectAddress,
      numSample,
    );
  }
}

export default Resampler;
