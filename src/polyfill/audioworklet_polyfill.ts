/*
  Copyright 2021 Picovoice Inc.

  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.

  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

type ProcessorPolyfill = {
  port?: {
    onmessage?: (event: MessageEvent<{ buffer: Float32Array[] }>) => void;
  }
};

if (typeof window !== "undefined") {
// @ts-ignore window.webkitAudioContext
  window.AudioContext = window.AudioContext || window.webkitAudioContext;

  if (typeof AudioWorkletNode !== 'function' || !('audioWorklet' in AudioContext.prototype)) {
    if (AudioContext) {
      // @ts-ignore
      AudioContext.prototype.audioWorklet = {
        // eslint-disable-next-line
        addModule: async function (moduleURL: string | URL, options?: WorkletOptions): Promise<void> {
          return;
        },
      };

      // @ts-ignore
      // eslint-disable-next-line no-native-reassign
      window.AudioWorkletNode = function (context: AudioContext, processorName: string, options: any): ScriptProcessorNode {
        const {numberOfChannels = 1, frameLength = 512} = options && options.processorOptions;
        const scriptProcessor: ScriptProcessorNode & ProcessorPolyfill = context.createScriptProcessor(frameLength, numberOfChannels, numberOfChannels);

        if (!scriptProcessor.port) {
          scriptProcessor.port = {};
        }

        scriptProcessor.onaudioprocess = (event: AudioProcessingEvent): void => {
          if (scriptProcessor.port && scriptProcessor.port.onmessage) {
            const buffer = [];
            for (let i = 0; i < event.inputBuffer.numberOfChannels; i++) {
              buffer.push(event.inputBuffer.getChannelData(i));
            }
            scriptProcessor.port.onmessage({data: {buffer}} as MessageEvent);
          }
        };

        // @ts-ignore
        // eslint-disable-next-line arrow-body-style
        scriptProcessor.port.close = (): void => {
          return;
        };

        return scriptProcessor;
      };
    }
  }
}
