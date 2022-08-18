class RecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const { numberOfChannels = 1, frameLength = 512 } = options?.processorOptions;

    this._numberOfChannels = numberOfChannels;
    this._frameLength = frameLength;

    this._copied = 0;
    this._recorderBuffer = new Array(numberOfChannels).fill(new Float32Array(frameLength));
  }

  process(inputs, outputs, parameters) {
    let input = inputs[0]; // get first input
    if (input.length === 0) {
      return true;
    }

    let remaining = input[0].length;
    while (remaining > 0) {
      const toCopy = Math.min(remaining, this._frameLength - this._copied);

      for (let ch = 0; ch < this._numberOfChannels; ch++) {
        this._recorderBuffer[ch].set(input[ch].slice(0, toCopy), this._copied);
      }

      remaining -= toCopy;
      this._copied += toCopy;

      if (this._copied >= this._frameLength) {
        this.port.postMessage({
          buffer: this._recorderBuffer
        });
        this._copied = 0;
      }
    }

    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
