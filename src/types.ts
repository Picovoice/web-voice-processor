/*
    Copyright 2018-2024 Picovoice Inc.

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
  filterOrder?: number;
  /** Custom made recorder processor */
  customRecorderProcessorURL?: string;
};

export type ResamplerWorkerInitRequest = {
  command: 'init';
  wasm: string;
  inputSampleRate: number;
  outputSampleRate: number;
  frameLength: number;
  filterOrder: number;
};

export type ResamplerWorkerProcessRequest = {
  command: 'process';
  inputFrame: Float32Array | Int16Array;
};

export type ResamplerWorkerResetRequest = {
  command: 'reset';
};

export type ResamplerWorkerReleaseRequest = {
  command: 'release';
};

export type ResamplerWorkerNumRequiredInputSamplesRequest = {
  command: 'numRequiredInputSamples';
  numSample: number;
};

export type ResamplerWorkerRequest =
  | ResamplerWorkerInitRequest
  | ResamplerWorkerProcessRequest
  | ResamplerWorkerResetRequest
  | ResamplerWorkerReleaseRequest
  | ResamplerWorkerNumRequiredInputSamplesRequest;

export type ResamplerWorkerFailureResponse = {
  command: 'failed' | 'error';
  message: string;
};

export type ResamplerWorkerInitResponse = ResamplerWorkerFailureResponse | {
  command: 'ok';
  version: string;
};

export type ResamplerWorkerProcessResponse = ResamplerWorkerFailureResponse | {
  command: 'ok';
  result: Int16Array;
};

export type ResamplerWorkerResetResponse = ResamplerWorkerFailureResponse | {
  command: 'ok';
};

export type ResamplerWorkerReleaseResponse = ResamplerWorkerFailureResponse | {
  command: 'ok';
};

export type ResamplerWorkerNumRequiredInputSamplesResponse = ResamplerWorkerFailureResponse | {
  command: 'ok';
  result: number;
};

export type ResamplerWorkerResponse =
  ResamplerWorkerInitResponse |
  ResamplerWorkerProcessResponse |
  ResamplerWorkerResetResponse |
  ResamplerWorkerReleaseResponse;
