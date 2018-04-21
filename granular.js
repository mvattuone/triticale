import chunk from 'lodash.chunk';

class Grain {

  constructor(context, data, output, isAudio, databender) {
    this.databender = databender;
    this.context = context;
    this.data = data;
    this.output = output;

    this.setup(isAudio);
  }

  setup(isAudio) {
    var N = this.data.length;
    this.buffer = this.context.createBuffer(1, N, this.context.sampleRate);

    var buffer_data = this.buffer.getChannelData(0);

    if (isAudio) {
      for (var i = 0; i < N; i++) {
        // Hann window, useful for removing clipping sounds from start/stop of grains.
        // But don't do for image/video since it removes visuals we want
        const window_fn = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
        buffer_data[i] = this.data[i] * window_fn;
      }
    } else {
      buffer_data.set(this.data);
    }

    this.gainNode = this.context.createGain();
    this.gainNode.connect(this.output);
  };

  trigger(isAudio) {
    if (isAudio) {
      var bufferSource = this.context.createBufferSource();
      bufferSource.buffer = this.buffer;
      bufferSource.connect(this.context.destination);
      if (this.databender.config.playAudio) {
        var duration = this.databender.config.enableEnvelops ? this.databender.config.attack + this.databender.config.release : bufferSource.buffer.duration
        bufferSource.start(0,this.databender.config.offset,duration);
        bufferSource.loop = this.databender.config.loopAudio;
        if (this.databender.config.enableEnvelopes) {
          this.gainNode.gain.setValueAtTime(0.0, 0);
          this.gainNode.gain.linearRampToValueAtTime(Math.random(),0 + this.databender.config.attack);
          this.gainNode.gain.linearRampToValueAtTime(0, 0 + (this.databender.config.attack + this.databender.config.release));
        }
      }
    } else {
      this.databender.render(this.buffer)
        .then(this.databender.draw.bind(this.databender))
    }
  };
};

class GranularSynth {
  constructor(context, databender) {
    this.context = context;
    this.databender = databender;
    this.config = databender.config

    this.output = context.createGain();
    this.output.connect(context.destination);

    this.walkProbability = this.config.walkProbability;
  }

  createGrains(isAudio) {
    const buffer = isAudio ? this.audioBuffer : this.videoBuffer;
    const rawData = buffer.getChannelData(0);
    const grainSize = Math.floor(buffer.length / this.config.numberOfGrains);
    const chunks = chunk(rawData, grainSize);
    const grains = chunks.map(function(data) {
      return new Grain(this.context, data, this.output, isAudio, this.databender)
    }.bind(this));

    if (isAudio) { 
      this.audioGrains = grains;
    } else {
      this.videoGrains = grains;
    }
  };

  updateValues(config) { 
    this.config = config;
    this.createGrains(true);
    this.createGrains();
  };

  stop() { 
    cancelAnimationFrame(this.scheduler);
    this.stopLoop = true;
    return;
  };

  play() {
    this.stopLoop = false;
    var nextGrainTime = this.context.currentTime;
    var now;
    var then = Date.now();
    var delta;

    var triggerGrain = function() {
      if (!this.stopLoop) {
        requestAnimationFrame(triggerGrain.bind(this));
      }

      var grainIndex = this.databender.config.grainIndex;
      var interval = (this.audioGrains[grainIndex].buffer.duration * 1000) / this.config.frameRate;
      now = Date.now();
      delta = now - then;

      if (delta > interval) {
        if (Math.random() < this.walkProbability) {
          var toggle = Math.random();
          if (toggle > 0.6) {
            grainIndex = Math.min(this.audioGrains.length - 1, grainIndex + 1);
          } else if (toggle < 0.4) {
            grainIndex = Math.max(Math.floor(Math.random() * this.audioGrains.length) - 1, 0);
          } else {
            grainIndex = Math.max(0, grainIndex - 1);
          }
        }

        this.audioGrains[grainIndex].trigger(true);
        this.videoGrains[grainIndex].trigger(false);

        then = now - (delta % interval);
      }
    }

    this.scheduler = requestAnimationFrame(() => {
      triggerGrain.call(this)
    });
  };
};

export default GranularSynth;
