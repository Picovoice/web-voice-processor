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
  | DownsamplingWorkerResponseAudioDumpComplete;

export interface DownsamplingWorker extends Omit<Worker, 'postMessage'> {
  postMessage(command: DownsamplingWorkerRequest): void;
}

export type DownsamplingWorkerWasm = {
  exports: WebAssembly.Exports,
  memory: WebAssembly.Memory,
  objectAddress: number,
  inputBufferAddress: number,
  outputBufferAddress: number,
  inputframeLength: number
}
