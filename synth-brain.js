import Databender from "databender";

const chunk = (arr, chunkSize, cache = []) => {
  const tmp = [...arr];
  if (chunkSize <= 0) return cache;
  while (tmp.length) cache.push(tmp.splice(0, chunkSize));
  return cache;
};

function blackmanWindow(length) {
    const alpha = 0.16;
    const a0 = (1 - alpha) / 2;
    const a1 = 0.5;
    const a2 = alpha / 2;
    let window = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        window[i] = a0 - a1 * Math.cos((2 * Math.PI * i) / (length - 1)) + a2 * Math.cos((4 * Math.PI * i) / (length - 1));
    }
    return window;
}

function hammingWindow(length) {
let window = new Float32Array(length);
for (let i = 0; i < length; i++) {
    window[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (length - 1));
}
return window;
}

function hannWindow(length) {
    let window = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (length - 1)));
    }
    return window;
}

function gaussianWindow(length, sigma = 0.4) {
    const window = new Float32Array(length);
    const midpoint = (length - 1) / 2;

    for (let i = 0; i < length; i++) {
        const x = (i - midpoint) / (sigma * midpoint);
        window[i] = Math.exp(-0.5 * x * x);
    }

    return window;
}

function triangleWindow(length) {
    const window = new Float32Array(length);
    const midpoint = (length - 1) / 2;

    for (let i = 0; i < length; i++) {
        window[i] = 1 - Math.abs((i - midpoint) / midpoint);
    }

    return window;
}

const windowMap = {
  blackman: blackmanWindow,
  gaussian: gaussianWindow,
  hann: hannWindow,
  hamming: hammingWindow,
  triangle: triangleWindow,
};

export default class SynthBrain extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.audioCtx = new AudioContext();
    this.databender = new Databender({}, this.audioCtx);
    this.audioGrains = [];
    this.imageGrains = [];
    this.config = {
      grainSize: 10,
      density: 1,
      window: 'hann',
    };
    this.shadowRoot.innerHTML = `
      <slot></slot>
    `;
    this.bufferSource;
  }

  connectedCallback() {
    this.addEventListener("image-uploaded", this.handleImageUploaded);
    this.addEventListener("audio-uploaded", this.handleAudioUploaded);
    this.addEventListener("update-sample", this.updateAudioSelection);
    this.addEventListener("play-synth", this.playSynth);
    this.addEventListener("stop-synth", this.stopSynth);
    this.addEventListener("update-config", this.updateConfig);
  }

  disconnectedCallback() {
    this.removeEventListener("image-uploaded", this.handleImageUploaded);
    this.removeEventListener("audio-uploaded", this.handleAudioUploaded);
    this.removeEventListener("update-sample", this.updateAudioSelection);
    this.removeEventListener("play-synth", this.playSynth);
    this.removeEventListener("stop-synth", this.stopSynth);
    this.removeEventListener("update-config", this.updateConfig);
  }

  updateConfig(e) { 
  
    const { name, value } = e.detail;

    if (!Object.keys(this.config).includes(name)) {
      console.warn(`${name} is not a valid config parameter`);
      return;
    }

    this.config = { ...this.config, [name]: value };

    if (name === 'grainSize') {
      if (this.imageBuffer) {
        this.imageGrains = this.createGrains(this.imageBuffer);
      }

      if (this.audioSelection) {
        this.audioGrains = this.createGrains(this.audioSelection);
      }
      

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
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;

    this.audioSelection = buffer;
    this.audioGrains = this.createGrains(this.audioSelection);
  }

  handleImageUploaded(event) {
    const imageData = event.detail;

    const img = new Image();
    img.onload = () => {
      this.image = img;
      this.databender.convert(img).then((buffer) => {
        // We need to figure out a way to separate the initial uploaded image
        // OR we immediately display a grain version instead of the real thing?
        this.imageBuffer = buffer;
        this.imageGrains = this.createGrains(this.imageBuffer);
        const updateImageEvent = new CustomEvent("update-image", {
          detail: img,
          bubbles: true,
          composed: true,
        });
        this.querySelector("synth-display").dispatchEvent(updateImageEvent);
      });
    };
    img.src = imageData;
  }

  createGrains(sample) {
    const grainCount = Math.floor(sample.length / this.config.grainSize);

    const chunks = chunk(sample.getChannelData(0), grainCount);

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
    const windowCoefficients = windowFunction(length);
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

  playSynth() {
    let now;
    let then = Date.now();
    let delta;

    const triggerImageGrain = (grainIndex) => {
      const interval = Math.max(1000 / this.config.density, this.imageGrains[grainIndex].duration);


      now = Date.now();
      delta = now - then;

      if (delta > interval) {
        const canvas = document
          .querySelector("synth-display")
          .shadowRoot.querySelector("canvas");
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);

        const grainBuffer = this.imageGrains[grainIndex];

        let windowedBuffer = grainBuffer;
      
        if (this.config.window !== 'none') {
          windowedBuffer = this.applyWindowFunction(grainBuffer, windowMap[this.config.window]);
        }

        this.databender
          .render(windowedBuffer)
          .then((buffer) =>
            this.databender.draw(
              buffer,
              context,
              0,
              0,
              0,
              0,
              this.databender.imageData.width,
              this.databender.imageData.height / this.config.grainSize,
              canvas.width,
              canvas.height,
            ),
          );

        then = now - (delta % interval);
      }

      const randomGrainIndex = Math.floor(Math.random() * this.imageGrains.length);
      this.scheduler = requestAnimationFrame(() => {
        triggerImageGrain(randomGrainIndex);
      });
    };

    this.then = Date.now();

    const triggerAudioGrain = (grainIndex) => {
      const interval = Math.max(1000 / this.config.density, this.audioGrains[grainIndex].duration);
      now = Date.now();
      delta = now - this.then;

      if (delta > interval) {
        const grainBuffer = this.audioGrains[grainIndex];

        let windowedBuffer = grainBuffer;
      
        if (this.config.window !== 'none') {
          windowedBuffer = this.applyWindowFunction(grainBuffer, windowMap[this.config.window]);
        }

        this.bufferSource = this.audioCtx.createBufferSource();
        this.bufferSource.buffer = windowedBuffer;
        this.bufferSource.loop = false;
        this.bufferSource.connect(this.audioCtx.destination);

        this.bufferSource.onended = () => {
          this.bufferSource.stop();
          this.bufferSource.disconnect();
          const clearGrainEvent = new Event('clear-grain', {
            bubbles: true,
            composed: true,
          });
          document.querySelector('synth-waveform').dispatchEvent(clearGrainEvent);
        };
        this.bufferSource.start(this.audioCtx.currentTime);

        const drawGrainEvent = new CustomEvent('draw-grain', {
          detail: { grainIndex, grains: this.audioGrains},
          bubbles: true,
          composed: true,
        });
        document.querySelector('synth-waveform').dispatchEvent(drawGrainEvent);

        this.then = now;
      }

      const randomGrainIndex = Math.floor(Math.random() * this.audioGrains.length);
      let nextCall = interval - (delta % interval);

      if (this.audioScheduler) {
        clearTimeout(this.audioScheduler);
      }

      this.audioScheduler = setTimeout(() => {
        triggerAudioGrain(randomGrainIndex);
      }, nextCall);
    };

    this.scheduler = requestAnimationFrame(() => {
      if (this.imageGrains.length > 0) {
        const randomGrainIndex = Math.floor(Math.random() * this.imageGrains.length);
        triggerImageGrain(randomGrainIndex);
      }
    });


    if (this.audioGrains.length > 0) {
      const randomGrainIndex = Math.floor(Math.random() * this.audioGrains.length);
      triggerAudioGrain(randomGrainIndex);
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

    cancelAnimationFrame(this.scheduler);
    clearTimeout(this.audioScheduler);
  }
}

customElements.define("synth-brain", SynthBrain);
