import '@free-side/audioworklet-polyfill';

import { WvpMessageEvent, WebVoiceProcessorOptions } from './types';

import { WebVoiceProcessor} from './web_voice_processor';
import { browserCompatibilityCheck } from './utils';

import downsamplerWasm from '../../lib/pv_downsampler.wasm';

import Downsampler from './downsampler';
import DownsamplerWorker from './downsampler_worker';

Downsampler.setWasm(downsamplerWasm);
DownsamplerWorker.setWasm(downsamplerWasm);

export {
  WvpMessageEvent,
  WebVoiceProcessorOptions,
  browserCompatibilityCheck,
  WebVoiceProcessor,
  DownsamplerWorker,
};
