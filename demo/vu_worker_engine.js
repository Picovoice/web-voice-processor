function process(frames) {
  const sum = [...frames].reduce(
    (accumulator, frame) => accumulator + frame ** 2,
    0,
  );
  const rms = Math.sqrt(sum / frames.length);
  let dBFS = 20 * Math.log10(rms);

  if (dBFS < 0) {
    dBFS = 0;
  }
  if (dBFS > 100) {
    dBFS = 100;
  }
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
