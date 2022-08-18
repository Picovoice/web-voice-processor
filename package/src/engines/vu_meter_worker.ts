import { WvpMessageEvent } from '../types';

const INT_16_MAX = 32767;
const EPSILON = 1e-9;

const process = (frames: Int16Array): number => {
  const sum = [...frames].reduce(
    (accumulator, frame) => accumulator + frame ** 2,
    0,
  );
  const rms = Math.sqrt(sum / frames.length) / INT_16_MAX;
  return 20 * Math.log10(Math.max(rms, EPSILON));
};

onmessage = (e: MessageEvent<WvpMessageEvent>): void => {
  switch (e.data.command) {
    case 'process':
      postMessage(process(e.data.inputFrame));
      break;
    default:
  }
};
