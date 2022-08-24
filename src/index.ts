import './polyfill/audioworklet_polyfill';

import { WvpMessageEvent, WebVoiceProcessorOptions } from './types';

import { WebVoiceProcessor} from './web_voice_processor';
import { browserCompatibilityCheck } from './utils';

import { VuMeterEngine } from './engines/vu_meter_engine';

import downsamplerWasm from '../lib/pv_downsampler.wasm';

import Downsampler from './downsampler';
import DownsamplerWorker from './downsampler_worker';

Downsampler.setWasm(downsamplerWasm);
DownsamplerWorker.setWasm(downsamplerWasm);

export {
  browserCompatibilityCheck,
  DownsamplerWorker,
  WvpMessageEvent,
  WebVoiceProcessor,
  WebVoiceProcessorOptions,
  VuMeterEngine
};
