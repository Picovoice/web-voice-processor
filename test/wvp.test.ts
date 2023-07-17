import { WebVoiceProcessor, VuMeterEngine } from "../";

const engine = {
  onmessage: function(e: MessageEvent) {
    expect(e).to.not.be.null;
  }
};

const vuMeter = new VuMeterEngine(db => {
  expect(db).to.not.be.null;
});

const emptyObj = {};

describe("Web Voice Processor", () => {
  it("Should be able to handle engine", async () => {
    await WebVoiceProcessor.subscribe(engine);
    // @ts-ignore
    expect(WebVoiceProcessor.instance()._engines.size).to.be.gt(0);
  });

  it("Should be able to remove engine", async () => {
    await WebVoiceProcessor.unsubscribe(engine);
    // @ts-ignore
    expect(WebVoiceProcessor.instance()._engines.size).to.be.eq(0);
  });


  it("Should be able to add VU meter", async () => {
    await WebVoiceProcessor.subscribe(vuMeter);
    // @ts-ignore
    expect(WebVoiceProcessor.instance()._engines.size).to.be.gt(0);
  });

  it("Should be able to remove VU meter", async () => {
    await WebVoiceProcessor.unsubscribe(vuMeter);
    // @ts-ignore
    expect(WebVoiceProcessor.instance()._engines.size).to.be.eq(0);
  });

  it("Should be able to add/remove multiple engines", async () => {
    await WebVoiceProcessor.subscribe([engine, vuMeter]);
    // @ts-ignore
    expect(WebVoiceProcessor.instance()._engines.size).to.be.gt(0);

    await WebVoiceProcessor.unsubscribe([engine, vuMeter]);
    // @ts-ignore
    expect(WebVoiceProcessor.instance()._engines.size).to.be.eq(0);
  });

  it("Should be able to reset", async () => {
    await WebVoiceProcessor.subscribe([engine, vuMeter]);
    // @ts-ignore
    expect(WebVoiceProcessor.instance()._engines.size).to.be.gt(0);

    await WebVoiceProcessor.reset();
    // @ts-ignore
    expect(WebVoiceProcessor.instance()._engines.size).to.be.eq(0);
  });

  it("Should be able to handle unexpected objects", async () => {
    try {
      await WebVoiceProcessor.subscribe(emptyObj);
      // @ts-ignore
      expect(WebVoiceProcessor.instance()._engines.size).to.be.eq(0);
    } catch (e) {
      // @ts-ignore
      expect(WebVoiceProcessor.instance()._engines.size).to.be.eq(0);
    }
  });
});
