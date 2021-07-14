import DsWorker from 'web-worker:./downsampling_worker.ts';

import {
  DownsamplingWorkerResponse,
  DownsamplingWorker,
} from './worker_types';

export default class DownsamplerWorkerFactory {
  private constructor() {}

  public static async create(
    inputFrequency: number,
    outputFrequency?: number,
    frameLength?: number,
  ): Promise<Worker> {
    const downsamplingWorker = new DsWorker() as DownsamplingWorker;

    downsamplingWorker.postMessage({
      command: 'init',
      inputSampleRate: inputFrequency,
      outputSampleRate: outputFrequency,
      frameLength: frameLength,
    });

    const workerPromise = new Promise<Worker>((resolve, reject) => {
      downsamplingWorker.onmessage = function (
        event: MessageEvent<DownsamplingWorkerResponse>,
      ): void {
        if (event.data.command === 'ds-ready') {
          resolve(downsamplingWorker);
        }
      };
    });
    return workerPromise;
  }
}
