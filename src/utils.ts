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
 * @return object with compatibilty details, with special key '_picovoice' offering a yes/no answer.
 */

export function browserCompatibilityCheck(): BrowserFeatures {
  // Are we in a secure context? Microphone access requires HTTPS (with the exception of localhost, for development)
  const _isSecureContext = window.isSecureContext;

  // Web Audio API
  const _mediaDevices = navigator.mediaDevices !== undefined;
  const _webkitGetUserMedia =
    // @ts-ignore
    navigator.webkitGetUserMedia !== undefined;

  // Web Workers
  const _Worker = window.Worker !== undefined;

  // WebAssembly
  const _WebAssembly = typeof WebAssembly === 'object';

  // AudioWorklet (not yet used, due to lack of Safari support)
  const _AudioWorklet = typeof AudioWorklet === 'function';

  // Picovoice requirements met?
  const _picovoice = _mediaDevices && _WebAssembly && _Worker;

  return {
    _picovoice: _picovoice,
    AudioWorklet: _AudioWorklet,
    isSecureContext: _isSecureContext,
    mediaDevices: _mediaDevices,
    WebAssembly: _WebAssembly,
    webKitGetUserMedia: _webkitGetUserMedia,
    Worker: _Worker,
  };
}

/**
 * Convert a null terminated phrase stored inside an array buffer to a string
 *
 * @param arrayBuffer input array buffer
 * @param index the index at which the phrase is stored
 * @return retrieved string
 */

export function arrayBufferToStringAtIndex(
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

/**
 * Decode a base64 string and stored it in a Uint8Array array
 *
 * @param base64String input base64 string
 * @return decoded array
 */

export function base64ToUint8Array(base64String: string): Uint8Array {
  const base64StringDecoded = atob(base64String);
  const binaryArray = new Uint8Array(base64StringDecoded.length);
  for (let i = 0; i < base64StringDecoded.length; i++) {
    binaryArray[i] = base64StringDecoded.charCodeAt(i);
  }
  return binaryArray;
}
