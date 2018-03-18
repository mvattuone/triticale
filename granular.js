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
      bufferSource.start(time);
    }
  } else {
    databender.render(this.buffer, time)
      .then(databender.draw.bind(databender))
  }
};

var GranularSynth = function(context, databender) {
  this.context = context;
  this.databender = databender;
  this.config = databender.config

  this.output = context.createGain();
  this.output.connect(context.destination);

  this.grainsPerSecond = this.config.grainsPerSecond;
  this.walkProbability = this.config.walkProbability;
};

GranularSynth.prototype.createGrains = function(isAudio) {
  var buffer = isAudio ? this.audioBuffer : this.videoBuffer;
  var rawData = buffer.getChannelData(0);
  var grainSize = Math.floor(buffer.length / this.config.numberOfGrains);
  var chunks = _.chunk(rawData, grainSize);
  var grains = chunks.map(function(data) {
    return new Grain(this.context, data, this.output, isAudio)
  }.bind(this));

  if (isAudio) { 
    this.audioGrains = grains;
  } else {
    this.videoGrains = grains;
  }
};

GranularSynth.prototype.updateValues = function (config) { 
  this.config = config;
  this.createGrains(true);
  this.createGrains();
  return;
};

GranularSynth.prototype.stop = function () { 
  cancelAnimationFrame(this.scheduler);
  this.stopLoop = true;
  return;
};

GranularSynth.prototype.play = function() {
  this.stopLoop = false;
  var nextGrainTime = this.context.currentTime;
  var now;
  var then = Date.now();
  var delta;

  var triggerGrain = function() {
    if (!this.stopLoop) {
      requestAnimationFrame(triggerGrain.bind(this));
    }

    var interval = 1000 / this.config.frameRate;
    var grainIndex = this.databender.config.grainIndex;
    console.log('what is grain index', grainIndex);
    now = Date.now();
    delta = now - then;

    if (delta > interval) {
      if (Math.random() < this.walkProbability) {
        if (Math.random() > 0.5) {
          grainIndex = Math.min(this.audioGrains.length - 1, grainIndex + 1);
        } else {
          grainIndex = Math.max(0, grainIndex - 1);
        }
      }

      nextGrainTime += 1 / this.grainsPerSecond;
      this.audioGrains[grainIndex].trigger(nextGrainTime, true);
      this.videoGrains[grainIndex].trigger(nextGrainTime);

      then = now - (delta % interval);
    }
  }

  this.scheduler = requestAnimationFrame(() => {
    triggerGrain.call(this)
  });
};

