import './polyfill/audioworklet_polyfill';

import { WvpMessageEvent, WebVoiceProcessorOptions } from './types';

import { WebVoiceProcessor} from './web_voice_processor';
import { browserCompatibilityCheck } from './utils';

import { VuMeterEngine } from './engines/vu_meter_engine';

import resamplerWasm from '../lib/pv_resampler.wasm';

import Resampler from './resampler';
import ResamplerWorker from './resampler_worker';

Resampler.setWasm(resamplerWasm);
ResamplerWorker.setWasm(resamplerWasm);

export {
  ResamplerWorker,
  VuMeterEngine,
  WebVoiceProcessor,
  WebVoiceProcessorOptions,
  WvpMessageEvent,
  browserCompatibilityCheck,
};
