/*
    Copyright 2018-2021 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

export enum WorkerCommand {
  Process = 'process',
  Init = 'init',
  Reset = 'reset',
  Pause = 'pause',
  Resume = 'resume',
  Release = 'release',
}

export type DownsamplingWorkerMessageInput = {
  command: WorkerCommand | DownsamplingWorkerCommandInput;
  frameLength?: number;
  inputFrame?: Int16Array;
  inputSampleRate?: number;
  outputSampleRate?: number;
  durationMs?: number;
};

export type DownsamplingWorkerMessageOutput = {
  command: WorkerCommand | DownsamplingWorkerMessageOutput;
  outputFrame?: Int16Array;
  blob?: Blob;
};

export enum DownsamplingWorkerCommandInput {
  StartAudioDump = 'start_audio_dump',
}

export enum DownsamplingWorkerCommandOutput {
  AudioDumpComplete = 'audio_dump_complete',
  Blob = 'blob',
}
