var context = new AudioContext;

var Grain = function(context, data, output, isAudio) {
  this.context = context;
  this.data = data;
  this.output = output;

  this.setup(isAudio);
};

Grain.prototype.setup = function(isAudio) {
  var N = this.data.length;
  this.buffer = this.context.createBuffer(1, N, this.context.sampleRate);

    var buffer_data = this.buffer.getChannelData(0);

    if (isAudio) {
      for (var i = 0; i < N; i++) {
        // Hann window, useful for removing clipping sounds from start/stop of grains.
        // But don't do for image/video because it simply removes visuals.
        window_fn = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
        buffer_data[i] = this.data[i] * window_fn;
      }
    } else {
      buffer_data.set(this.data);
    }
};

Grain.prototype.trigger = function(time, isAudio) {
  if (isAudio) {
    var bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = this.buffer;
    bufferSource.connect(audioCtx.destination);
    if (databender.config.playAudio) {
      bufferSource.start(0);
    }
  } else {
    databender.render(this.buffer, time)
      .then(databender.draw.bind(databender))
  }
};

var GranularSynth = function(context, buffer, databender, params, isAudio) {
  this.context = context;
  this.buffer = buffer;
  this.databender = databender;

  this.output = context.createDynamicsCompressor();
  this.output.connect(context.destination);

  this.grainsPerSecond = params.grainsPerSecond;
  this.grainSize = params.grainSize;
  this.walkProbability = params.walkProbability;

  this.createGrains(isAudio);
};

GranularSynth.prototype.createGrains = function(isAudio) {
  var rawData = this.buffer.getChannelData(0);
  var chunks = _.chunk(rawData, this.grainSize);

  this.grains = chunks.map(function(data) {
    return new Grain(this.context, data, this.output, isAudio)
  }.bind(this));
};

GranularSynth.prototype.stop = function() {
  clearInterval(this.scheduler);
};

GranularSynth.prototype.play = function(isAudio) {
  var scheduleAheadTime = 1;
  var nextGrainTime = this.context.currentTime;
  // I Think this is something that we want to change dynamically, maybe by pressing a key or clicking a sample
  var grainIndex = 25;

  this.scheduler = setInterval(function() {
    while (nextGrainTime < this.context.currentTime + scheduleAheadTime ) {
      if (Math.random() < this.walkProbability) {
        if (Math.random() > 0.5) {
          grainIndex = Math.min(this.grains.length - 1, grainIndex + 1);
        } else {
          grainIndex = Math.max(0, grainIndex - 1);
        }
      }

      nextGrainTime += 1 / this.grainsPerSecond;
      this.grains[grainIndex].trigger(nextGrainTime, isAudio);
    }
  }.bind(this), 250);
};

