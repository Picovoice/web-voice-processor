/*
    Copyright 2018-2022 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

export enum WvpState {
  STARTED,
  STOPPED,
}

export type WvpMessageEvent = {
  command: 'process',
  inputFrame: Int16Array
};

export type PvEngine = {
  onmessage?: ((e: MessageEvent) => any) | null;
  postMessage?: (e: any) => void;
  worker?: {
    onmessage?: ((e: MessageEvent) => any) | null;
    postMessage?: (e: any) => void;
  }
}

export type WebVoiceProcessorOptions = {
  /** Size of pcm frames (default: 512) */
  frameLength?: number;
  /** Which sample rate to convert to (default: 16000) */
  outputSampleRate?: number;
  /** Microphone id to use (can be fetched with mediaDevices.enumerateDevices) */
  deviceId?: string | null;
  /** Filter order (default: 50) */
  filterOrder?: number
};

export type DownsamplerWorkerInitRequest = {
  command: 'init';
  wasm: string;
  inputSampleRate: number;
  outputSampleRate: number;
  frameLength: number;
  filterOrder: number;
};

export type DownsamplerWorkerProcessRequest = {
  command: 'process';
  inputFrame: Float32Array | Int16Array;
};

export type DownsamplerWorkerResetRequest = {
  command: 'reset';
};

export type DownsamplerWorkerReleaseRequest = {
  command: 'release';
};

export type DownsamplerWorkerNumRequiredInputSamplesRequest = {
  command: 'numRequiredInputSamples';
  numSample: number;
};

export type DownsamplerWorkerRequest =
  | DownsamplerWorkerInitRequest
  | DownsamplerWorkerProcessRequest
  | DownsamplerWorkerResetRequest
  | DownsamplerWorkerReleaseRequest
  | DownsamplerWorkerNumRequiredInputSamplesRequest;

export type DownsamplerWorkerFailureResponse = {
  command: 'failed' | 'error';
  message: string;
};

export type DownsamplerWorkerInitResponse = DownsamplerWorkerFailureResponse | {
  command: 'ok';
  version: string;
};

export type DownsamplerWorkerProcessResponse = DownsamplerWorkerFailureResponse | {
  command: 'ok';
  result: Int16Array;
};

export type DownsamplerWorkerResetResponse = DownsamplerWorkerFailureResponse | {
  command: 'ok';
};

export type DownsamplerWorkerReleaseResponse = DownsamplerWorkerFailureResponse | {
  command: 'ok';
};

export type DownsamplerWorkerNumRequiredInputSamplesResponse = DownsamplerWorkerFailureResponse | {
  command: 'ok';
  result: number;
};

export type DownsamplerWorkerResponse =
  DownsamplerWorkerInitResponse |
  DownsamplerWorkerProcessResponse |
  DownsamplerWorkerResetResponse |
  DownsamplerWorkerReleaseResponse;
