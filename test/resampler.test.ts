import { Resampler, ResamplerWorker } from "../";

const DEBUG: boolean = Cypress.env('DEBUG');

const frameLength = 512;
const testData = [
  {
    inputFile: "9khz_noise",
    inputFrequency: 48000,
    outputFrequency: 16000,
    filterOrders: [30, 40, 50]
  },
  {
    inputFile: "tone-9khz_noise",
    inputFrequency: 44100,
    outputFrequency: 16000,
    filterOrders: [100]
  },
];

const frequencyToStr = (frequency: number) => `${frequency / 1000}kHz`;

const avgFrameDiff = (input: Int16Array, output: Int16Array) => {
  let diff = 0;
  for (let i = 0; i < input.length; i++) {
    diff += Math.abs(input[i] - output[i]);
  }
  return diff / input.length;
};

describe("Resampler", () => {
  it("Should be able to resample (main)", () => {
    for (const testParam of testData) {
      const inputFile = `audio_samples/${testParam.inputFile}_${frequencyToStr(testParam.inputFrequency)}.pcm`;

      for (const filterOrder of testParam.filterOrders) {
        const outputFile = `audio_samples/${testParam.inputFile}_${frequencyToStr(testParam.outputFrequency)}_ds_${filterOrder}.pcm`;
        const output = new Int16Array(frameLength);

        cy.getFramesFromFile(inputFile).then(async inputFrames => {
          const resampler = await Resampler.create(
            testParam.inputFrequency,
            testParam.outputFrequency,
            filterOrder,
            frameLength,
          );

          cy.getFramesFromFile(outputFile).then(outputFrames => {
            const data = new Int16Array(outputFrames.length);

            for (let i = 0, j = 0; j < outputFrames.length; i += frameLength) {
              const processed = resampler.process(inputFrames.slice(i, i + frameLength), output);

              data.set(output.slice(0, processed), j);
              j += processed;
            }
            resampler.release();

            if (DEBUG) {
              const blob = new Blob([data], {type: "application/blob"});// change resultByte to bytes

              const link = document.createElement('a');
              link.href = window.URL.createObjectURL(blob);
              link.download = `main-${outputFile}`;
              link.click();
            }

            const diff = avgFrameDiff(data, outputFrames);
            expect(diff).to.be.lte(1, `${outputFile} comparison`);
          });
        });
      }
    }
  });

  it("Should be able to resample (worker)", () => {
    for (const testParam of testData) {
      const inputFile = `audio_samples/${testParam.inputFile}_${frequencyToStr(testParam.inputFrequency)}.pcm`;
      for (const filterOrder of testParam.filterOrders) {
        cy.getFramesFromFile(inputFile).then(async inputFrames => {
          let data = new Int16Array();
          let processedFrames = 0;

          const resamplerCallback = (frames: Int16Array) => {
            data.set(frames, processedFrames);
            processedFrames += frames.length;
          };

          const resampler = await ResamplerWorker.create(
            testParam.inputFrequency,
            testParam.outputFrequency,
            filterOrder,
            frameLength,
            resamplerCallback
          );

          const outputFile = `audio_samples/${testParam.inputFile}_${frequencyToStr(testParam.outputFrequency)}_ds_${filterOrder}.pcm`;

          cy.getFramesFromFile(outputFile).then(async outputFrames => {
            data = new Int16Array(outputFrames.length);

            for (let i = 0; i < inputFrames.length; i += frameLength) {
              resampler.process(inputFrames.slice(i, i + frameLength));
            }

            const waitFor = () => new Promise<void>(resolve => {
              const timer = setInterval(() => {
                if (processedFrames >= outputFrames.length - frameLength) {
                  clearInterval(timer);
                  resolve();
                }
              }, 100);
            });

            await waitFor();

            await resampler.terminate();

            if (DEBUG) {
              const blob = new Blob([data], {type: "application/blob"});// change resultByte to bytes

              const link = document.createElement('a');
              link.href = window.URL.createObjectURL(blob);
              link.download = `worker-${outputFile}`;
              link.click();
            }

            const diff = avgFrameDiff(data, outputFrames);
            expect(diff).to.be.lte(1, `${outputFile} comparison`);
          });
        });
      }
    }
  });
});
