export class Grain {

  constructor(context, data, output, config, isVideo) {
    this.config = config;
    this.context = context;
    this.data = data;
    this.output = output;

    this.setup(isVideo);
  }

  setup(isVideo) {
    const N = this.data.length;
    this.buffer = this.context.createBuffer(1, N, this.context.sampleRate);

    const buffer_data = this.buffer.getChannelData(0);

    for (let i = 0; i < N; i++) {
      // Hann window, useful for removing clipping sounds from start/stop of grains.
      // But don't do for image/video since it removes visuals we want
      const window_fn = isVideo ? 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1))) : 1;
      buffer_data[i] = this.data[i] * window_fn;
    }

    this.gainNode = this.context.createGain();
    this.gainNode.connect(this.output);
  };

  trigger(callback) {
    callback(this.buffer, this.gainNode)
  };
};
