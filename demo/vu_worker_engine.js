const INT_16_MAX = 32767;

function process(frames) {
  const sum = [...frames].reduce(
    (accumulator, frame) => accumulator + frame ** 2,
    0,
  );
  const rms = Math.sqrt(sum / frames.length) / INT_16_MAX;
  let dBFS = 20 * Math.log10(rms);

  postMessage(dBFS);
}

onmessage = function (e) {
  switch (e.data.command) {
    case 'process':
      process(e.data.inputFrame);
      break;
    default:
      console.warn(
        'Unhandled command in vu_worker_engine.js: ' + e.data.command,
      );
      break;
  }
};
