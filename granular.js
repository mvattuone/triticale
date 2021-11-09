import chunk from "lodash.chunk";

class Grain {
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
      const window_fn = isVideo
        ? 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)))
        : 1;
      buffer_data[i] = this.data[i] * window_fn;
    }

    this.gainNode = this.context.createGain();
    this.gainNode.connect(this.output);
  }

  trigger(callback) {
    callback(this.buffer, this.config);
  }
}

class GranularSynth {
  constructor(context, config) {
    this.context = context;
    this.config = config;
    this.output = context.createGain();
    this.output.connect(context.destination);

    this.walkProbability = this.config.walkProbability;
  }

  createGrains(buffer) {
    const rawData = buffer.getChannelData(0);
    const grainSize = Math.floor(buffer.length / this.config.numberOfGrains);
    const chunks = chunk(rawData, grainSize);
    this.buffer = buffer;
    this.grains = chunks.map(
      function (data) {
        return new Grain(this.context, data, this.output, this.config);
      }.bind(this)
    );
  }

  updateGrains() {
    const grainSize = Math.floor(
      this.buffer.length / this.config.numberOfGrains
    );
    const rawData = this.buffer.getChannelData(0);
    const chunks = chunk(rawData, grainSize);
    this.grains = chunks.map(
      function (data) {
        return new Grain(this.context, data, this.output, this.config);
      }.bind(this)
    );
  }

  updateValues(config) {
    this.config = config;
    this.updateGrains();
  }

  stop() {
    cancelAnimationFrame(this.scheduler);
    this.stopLoop = true;
    return;
  }

  play(callback) {
    this.stopLoop = false;
    const nextGrainTime = this.context.currentTime;
    let now;
    let then = Date.now();
    let delta;

    const triggerGrain = function () {
      if (!this.stopLoop) {
        requestAnimationFrame(triggerGrain.bind(this));
      }

      let grainIndex = this.config.grainIndex;
      const interval =
        (this.grains[grainIndex].buffer.duration * 1000) /
        this.config.frameRate;
      now = Date.now();
      delta = now - then;

      if (delta > interval) {
        if (Math.random() < this.walkProbability) {
          const toggle = Math.random();
          if (toggle > 0.6) {
            grainIndex = Math.min(this.grains.length - 1, grainIndex + 1);
          } else if (toggle < 0.4) {
            grainIndex = Math.floor(Math.random() * this.grains.length) - 1;
          } else {
            grainIndex = grainIndex - 1;
          }
        }

        if (grainIndex < 0) {
          return triggerGrain.call(this);
        }

        this.grains[grainIndex].trigger(callback);

        then = now - (delta % interval);
      }
    };

    this.scheduler = requestAnimationFrame(() => {
      triggerGrain.call(this);
    });
  }
}

export default GranularSynth;
