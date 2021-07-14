import { DownsamplerInterface } from './worker_types';
import { wasiSnapshotPreview1Emulator } from './wasi_snapshot';
import { WASM_BASE64 } from './downsampler_b64';

type DownsamplerWasmOutput = {
  inputBufferAddress: number;
  inputframeLength: number;
  memory: WebAssembly.Memory;
  objectAddress: number;
  outputBufferAddress: number;
  pvDownsamplerConvertNumSamplesToInputSampleRate: CallableFunction;
  pvDownsamplerInit: CallableFunction;
  pvDownsamplerProcess: CallableFunction;
  pvDownsamplerReset: CallableFunction;
  pvDownsamplerDelete: CallableFunction;
};

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

    const wasmCodeArray = Downsampler.base64ToUint8Array(WASM_BASE64);
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
        this._outputBufferAddress + i * Int16Array.BYTES_PER_ELEMENT,
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

  public getNumRequiredInputSamples(numSample: number): number {
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
    while (arrayBuffer[indexBuffer] === 0) {
      stringBuffer += String.fromCharCode(arrayBuffer[indexBuffer++]);
    }
    return stringBuffer;
  }

  private static base64ToUint8Array(base64String: string): Uint8Array {
    const base64StringDecoded = atob(base64String);
    const binaryArray = new Uint8Array(base64StringDecoded.length);
    for (let i = 0; i < base64StringDecoded.length; i++) {
      binaryArray[i] = base64StringDecoded.charCodeAt(i);
    }
    return binaryArray;
  }
}

export default Downsampler;
