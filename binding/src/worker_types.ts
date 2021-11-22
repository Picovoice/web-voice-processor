/*
    Copyright 2018-2021 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

export type WorkerRequestVoid = {
  command: 'reset' | 'pause' | 'resume' | 'release';
};

export type DownsamplingWorkerRequestProcess = {
  command: 'process';
  inputFrame: Float32Array;
};

export type DownsamplingWorkerRequestInit = {
  command: 'init';
  inputSampleRate: number;
  outputSampleRate?: number;
  frameLength?: number;
};

export type DownsamplingWorkerResponseReady = {
  command: 'ds-ready';
};

export type DownsamplingWorkerResponseFrame = {
  command: 'output';
  outputFrame: Int16Array;
};

export type DownsamplingWorkerRequestAudioDump = {
  command: 'start_audio_dump';
  durationMs?: number;
};

export type DownsamplingWorkerResponseAudioDumpComplete = {
  command: 'audio_dump_complete';
  blob: Blob;
};

export type DownsamplingWorkerRequest =
  | DownsamplingWorkerRequestInit
  | DownsamplingWorkerRequestAudioDump
  | DownsamplingWorkerRequestProcess
  | WorkerRequestVoid;

export type DownsamplingWorkerResponse =
  | DownsamplingWorkerResponseFrame
  | DownsamplingWorkerResponseReady
  | DownsamplingWorkerResponseAudioDumpComplete;

export interface DownsamplingWorker extends Omit<Worker, 'postMessage'> {
  postMessage(command: DownsamplingWorkerRequest): void;
}

export interface DownsamplerInterface {
  /** Release all resources acquired by Downsampler */
  delete(): void;
  /** Get the number of required input samples given the desired number of output samples */
  getNumRequiredInputSamples(numSample: number): number;
  /** Decrease the sample rate of the inputBuffer and put the output signal into outputBuffer;
   * returns the num of processed samples from the input signal*/
  process(
    inputBuffer: Int16Array,
    inputBufferSize: number,
    outputBuffer: Int16Array,
  ): number;
  /** Reset Downsampler and clear all internal states */
  reset(): void;
  /** The version of Downsampler */
  readonly version: string;
}
