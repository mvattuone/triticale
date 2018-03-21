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
        // But don't do for image/video since it removes visuals we want
        window_fn = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
        buffer_data[i] = this.data[i] * window_fn;
      }
    } else {
      buffer_data.set(this.data);
    }

    this.gainNode = this.context.createGain();
    this.gainNode.connect(this.output);
};

Grain.prototype.trigger = function(isAudio) {
  if (isAudio) {
    var bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = this.buffer;
    bufferSource.connect(audioCtx.destination);
    if (databender.config.playAudio) {
      var duration = databender.config.enableEnvelops ? databender.config.attack + databender.config.release : bufferSource.buffer.duration
      bufferSource.start(0,databender.config.offset,duration);
      bufferSource.loop = databender.config.loopAudio;
      if (databender.config.enableEnvelopes) {
        this.gainNode.gain.setValueAtTime(0.0, 0);
        this.gainNode.gain.linearRampToValueAtTime(Math.random(),0 + databender.config.attack);
        this.gainNode.gain.linearRampToValueAtTime(0, 0 + (databender.config.attack + databender.config.release));
      }
    }
  } else {
    databender.render(this.buffer)
      .then(databender.draw.bind(databender))
  }
};

var GranularSynth = function(context, databender) {
  this.context = context;
  this.databender = databender;
  this.config = databender.config

  this.output = context.createGain();
  this.output.connect(context.destination);

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

    var grainIndex = this.databender.config.grainIndex;
    console.log(this.audioGrains[grainIndex].buffer.duration);
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

