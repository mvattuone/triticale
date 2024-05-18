import Databender from "databender";
import { chunk } from 'helpers/chunk.js';
import { hannWindow } from 'helpers/hannWindow.js';

export default class SynthBrain extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.audioCtx = new AudioContext();
    this.audioGrains = [];
    this.imageGrains = [];
    this.config = {
      effects: {
        biquad: {
          active: false,
          areaOfEffect: 1,
          biquadFrequency: 8500,
          detune: 0,
          enablePartial: false,
          quality: 1,
          randomValues: 2,
          randomize: false,
          type: "lowpass",
        },
        bitcrusher: {
          active: true,
          bits: 4,
          bufferSize: 4096,
          normfreq: 0.1,
        },
        convolver: {
          active: true,
          dryLevel: 1,
          highCut: 22050,
          impulse: 'minster1_000_ortf_48k.wav',
          level: 1,
          lowCut: 20,
          wetLevel: 1, 
        }
      },
      grainIndex: 1,
      grainDuration: 50,
      density: 1,
      window: 1,
      spray: 1,
      random: 0,
    };
    this.databender = new Databender(this.config.effects, this.audioCtx);
    this.shadowRoot.innerHTML = `
      <slot></slot>
    `;
    this.bufferSource;
  }

  connectedCallback() {
    this.addEventListener("image-uploaded", this.handleImageUploaded);
    this.addEventListener("update-sample", this.updateAudioSelection);
    this.addEventListener("play-synth", this.playSynth);
    this.addEventListener("stop-synth", this.stopSynth);
    this.addEventListener("update-config", this.handleUpdateConfig);
  }

  disconnectedCallback() {
    this.removeEventListener("image-uploaded", this.handleImageUploaded);
    this.removeEventListener("update-sample", this.updateAudioSelection);
    this.removeEventListener("play-synth", this.playSynth);
    this.removeEventListener("stop-synth", this.stopSynth);
    this.removeEventListener("update-config", this.handleupdateConfig);
  }

  handleUpdateConfig(e) {
    const { name, value } = e.detail;

    return this.updateConfig(name, value);

  }

  updateConfig(name, value) { 

    if (!Object.keys(this.config).includes(name.split(".")[0])) {
      console.warn(`${name} is not a valid config parameter`);
      return;
    }

    if (name.includes(".")) {
      const [groupKey, effectKey, valueKey] = name.split(".");
      this.config = { ...this.config, [groupKey]: { ...this.config[groupKey],  [effectKey]: { ...this.config[groupKey][effectKey], [valueKey]: value }}}
    } else {
      this.config = { ...this.config, [name]: value };
    }

    if (name === 'grainDuration') {
      if (this.imageBuffer) {
        this.imageGrains = this.createGrains(this.imageBuffer);
      }

      if (this.audioSelection) {
        this.audioGrains = this.createGrains(this.audioSelection);
      }
    }

    if (name.includes('effects')) {
      const [,effectKey, valueKey] = name.split(".");
      this.databender.updateConfig(effectKey, valueKey, value);
    }
  }

  handleAudioUploaded(event) {
    const { buffer } = event.detail;
    const updateAudioEvent = new CustomEvent("update-audio", {
      detail: { buffer },
      bubbles: true,
      composed: true,
    });
    this.querySelector("synth-waveform").dispatchEvent(updateAudioEvent);

    this.audioSelection = buffer;
    this.audioGrains = this.createGrains(this.audioSelection);
    document.querySelector("synth-slider[name='grainIndex']").setAttribute('max', this.audioGrains.length - 1);
  }

  handleImageUploaded(event) {
    const { image } = event.detail;

    this.databender.convert(image).then((buffer) => {
      this.imageBuffer = buffer;
      this.imageGrains = this.createGrains(this.imageBuffer);
    });
  }

  createGrains(sample) {
    const totalDurationSeconds = sample.duration;
    const totalDurationMs = totalDurationSeconds * 1000;
    this.numberOfGrains = Math.floor(totalDurationMs / this.config.grainDuration);

    this.samplesPerGrain = Math.floor(sample.length / this.numberOfGrains);
    const chunks = chunk(sample.getChannelData(0), this.samplesPerGrain);

    const grains = chunks.map((chunk) => {
      const grainBuffer = this.audioCtx.createBuffer(
        1,
        chunk.length,
        this.audioCtx.sampleRate,
      );
      const grainBufferData = grainBuffer.getChannelData(0);

      for (let i = 0; i < chunk.length; i++) {
        grainBufferData[i] = chunk[i];
      }

      return grainBuffer;
    });

    return grains;
  }

  updateAudioSelection(e) {
    const { selection, buffer } = e.detail;
    const frameCount =
      selection.end > selection.start
        ? selection.end - selection.start
        : selection.start - selection.end;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;

    this.audioSelection = this.audioCtx.createBuffer(
      numberOfChannels,
      frameCount,
      sampleRate,
    );

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const originalData = buffer.getChannelData(channel);
      const newData = this.audioSelection.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        newData[i] = originalData[i + selection.start];
      }
    }

    this.audioGrains = this.createGrains(this.audioSelection);
  }
  
  applyWindowFunction(audioBuffer, windowFunction) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const windowCoefficients = windowFunction(length, this.config.window);
    const processedBuffer = this.audioCtx.createBuffer(numberOfChannels, length, sampleRate);

    for (let channel = 0; channel < numberOfChannels; channel++) {
        const inputData = audioBuffer.getChannelData(channel);
        const outputData = processedBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            outputData[i] = inputData[i] * windowCoefficients[i];
        }
    }

    return processedBuffer;
}

  imageGrainCallback() {
    const canvas = document
      .querySelector("synth-display")
      .shadowRoot.querySelector("canvas");
    const context = canvas.getContext("2d");

    if (this.config.grainIndex - 1 > this.imageGrains.length - 1) {
      this.updateConfig('grainIndex', this.imageGrains.length - 1);
    }


    let indexToTrigger = this.config.grainIndex - 1;

    const someRandomNumber = Math.random();
    const shouldBeRandom = this.config.random > someRandomNumber;

    if (shouldBeRandom) {
      const min = this.config.grainIndex - this.config.spray;
      const max = this.config.grainIndex + this.config.spray - 1;

      indexToTrigger = Math.floor(Math.random() * (max - min)) + min;

      if (indexToTrigger < 0) {
        indexToTrigger = 0;
      }

      if (indexToTrigger > this.imageGrains.length - 1) {
        indexToTrigger = this.imageGrains.length - 1;
      }
    } 

    const grainBuffer = this.imageGrains[indexToTrigger];

    const windowedBuffer = this.applyWindowFunction(grainBuffer, hannWindow);

    this.databender
      .render(windowedBuffer)
      .then((buffer) => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        this.databender.draw(
          buffer,
          context,
          0,
          0,
          0,
          0,
          this.databender.imageData.width,
          this.databender.imageData.height / this.numberOfGrains,
          canvas.width,
          canvas.height,
        )
    
        document.querySelector('link[rel="icon"]').setAttribute('href', canvas.toDataURL('image/png'));

      });
};


  async audioGrainCallback() {

  if (this.config.grainIndex - 1 > this.audioGrains.length - 1) {
    this.updateConfig('grainIndex', this.audioGrains.length - 1);
  }


  let indexToTrigger = this.config.grainIndex - 1;

  const someRandomNumber = Math.random();
  const shouldBeRandom = this.config.random > someRandomNumber;

  if (shouldBeRandom) {

    const min = this.config.grainIndex - this.config.spray + 1;
    const max = this.config.grainIndex + this.config.spray - 1;

    indexToTrigger = Math.floor(Math.random() * (max - min)) + min;

    if (indexToTrigger < 0) {
      indexToTrigger = 0;
    }

    if (indexToTrigger > this.audioGrains.length - 1) {
      indexToTrigger = this.audioGrains.length - 1;
    }

  } 

  const grainBuffer = this.audioGrains[indexToTrigger];

  const effectedBuffer = await this.databender.render(grainBuffer);

  const windowedBuffer = this.applyWindowFunction(effectedBuffer, hannWindow);

  this.bufferSource = this.audioCtx.createBufferSource();
  this.bufferSource.buffer = windowedBuffer;
  this.bufferSource.loop = false;
  this.bufferSource.connect(this.audioCtx.destination);

  this.bufferSource.onended = () => {
    const clearGrainEvent = new Event('clear-grain', {
      bubbles: true,
      composed: true,
    });
    document.querySelector('synth-waveform').dispatchEvent(clearGrainEvent);
  };


  this.bufferSource.start(this.audioCtx.currentTime);

  const drawGrainEvent = new CustomEvent('draw-grain', {
    detail: { grainIndex: indexToTrigger, grains: this.audioGrains},
    bubbles: true,
    composed: true,
  });
  document.querySelector('synth-waveform').dispatchEvent(drawGrainEvent);
}

  playSynth() {
    const scheduleGrain = (callback) => {
      const interval = 1000 / this.config.density;  
      let expectedTime = performance.now() + interval;

      const runner = () => {
        const interval = 1000 / this.config.density;
        const drift = performance.now() - expectedTime;
        callback();
        expectedTime += interval;
        setTimeout(runner.bind(this), Math.max(0, interval - drift)); 
      };

      setTimeout(runner.bind(this), interval);
    };

    if (this.imageGrains.length > 0) {
      scheduleGrain(this.imageGrainCallback.bind(this));
    }
    
    if (this.audioGrains.length > 0) {
      scheduleGrain(this.audioGrainCallback.bind(this));
    }
  }

  stopSynth() {
    if (this.bufferSource) {
      this.bufferSource.stop();
    }

    if (this.image) {
      const updateImageEvent = new CustomEvent("update-image", {
        detail: this.image,
        bubbles: true,
        composed: true,
      });
      this.querySelector("synth-display").dispatchEvent(updateImageEvent);
    }
  }
}

customElements.define("synth-brain", SynthBrain);
