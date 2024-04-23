import { Grain } from "./Grain.js";

const chunk = (arr, chunkSize = 1, cache = []) => {
  const tmp = [...arr];
  if (chunkSize <= 0) return cache;
  while (tmp.length) cache.push(tmp.splice(0, chunkSize));
  return cache;
};

export class GranularSynth {
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
      }.bind(this),
    );
  }

  updateGrains() {
    const grainSize = Math.floor(
      this.buffer.length / this.config.numberOfGrains,
    );
    const rawData = this.buffer.getChannelData(0);
    const chunks = chunk(rawData, grainSize);
    this.grains = chunks.map(
      function (data) {
        return new Grain(this.context, data, this.output, this.config);
      }.bind(this),
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

        this.grains[grainIndex].trigger(callback);

        then = now - (delta % interval);
      }
    };

    this.scheduler = requestAnimationFrame(() => {
      triggerGrain.call(this);
    });
  }
}
