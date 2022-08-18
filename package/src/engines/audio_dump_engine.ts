import { WvpMessageEvent } from '../types';

export class AudioDumpEngine {
  private _buffers: Array<Int16Array> = [];

  onmessage(e: MessageEvent<WvpMessageEvent>): void {
    switch (e.data.command) {
      case 'process':
        this._buffers.push(e.data.inputFrame);
        break;
      default:
    }
  }

  onend(): Blob {
    return new Blob(this._buffers);
  }
}
