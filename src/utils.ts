/*
    Copyright 2021 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

export type BrowserFeatures = {
  _picovoice: boolean;
  AudioWorklet: boolean;
  isSecureContext: boolean;
  mediaDevices: boolean;
  WebAssembly: boolean;
  webKitGetUserMedia: boolean;
  Worker: boolean;
};

/**
 * Check for browser compatibility with Picovoice: WebAssembly, Web Audio API, etc.
 *
 * @return {object} of keys/values of compatibilty details, with special key '_picovoice' offering a yes/no answer.
 */
export function browserCompatibilityCheck(): BrowserFeatures {
  const compatibility = {};

  // Are we in a secure context? Microphone access requires HTTPS (with the exception of localhost, for development)
  compatibility['isSecureContext'] = window.isSecureContext;

  // Web Audio API
  compatibility['mediaDevices'] = navigator.mediaDevices !== undefined;
  compatibility['webkitGetUserMedia'] =
    // @ts-ignore
    navigator.webkitGetUserMedia !== undefined;

  // Web Workers
  compatibility['Worker'] = window.Worker !== undefined;

  // WebAssembly
  compatibility['WebAssembly'] = typeof WebAssembly === 'object';

  // AudioWorklet (not yet used, due to lack of Safari support)
  compatibility['AudioWorklet'] = typeof AudioWorklet === 'function';

  // Picovoice requirements met?
  compatibility['_picovoice'] =
    compatibility['mediaDevices'] &&
    compatibility['WebAssembly'] &&
    compatibility['Worker'];

  return compatibility as BrowserFeatures;
}
