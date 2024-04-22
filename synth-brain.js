import Databender from 'databender';

const chunk = (arr, chunkSize, cache = []) => {
  const tmp = [...arr]
  if (chunkSize <= 0) return cache
  while (tmp.length) cache.push(tmp.splice(0, chunkSize))
  return cache
}

export default class SynthBrain extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.audioCtx = new AudioContext();
    this.databender = new Databender({}, this.audioCtx);
    this.audioGrains = [];
    this.imageGrains = [];
    this.numberOfGrains = 10;
    this.density = 1;
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
    this.addEventListener("update-number-of-grains", this.updateNumberOfGrains);
    this.addEventListener("update-density", this.updateDensity);
  }

  disconnectedCallback() {
    this.removeEventListener("image-uploaded", this.handleImageUploaded);
    this.removeEventListener("audio-uploaded", this.handleAudioUploaded);
    this.removeEventListener("update-sample", this.updateAudioSelection);
    this.removeEventListener("play-synth", this.playSynth);
    this.removeEventListener("stop-synth", this.stopSynth);
    this.removeEventListener("update-number-of-grains", this.updateNumberOfGrains);
    this.removeEventListener("update-density", this.updateDensity);
  }

  updateNumberOfGrains(e) {
    this.numberOfGrains = e.detail;

    if (this.imageBuffer) {
      this.imageGrains = this.createGrains(this.imageBuffer);
    }

    if (this.audioSelection) {
      this.audioGrains = this.createGrains(this.audioSelection);
    }
  }

  updateDensity(e) {
    this.density = e.detail;
  }

  handleAudioUploaded(event) {
    const eventData = event.detail;
    const updateAudioEvent = new CustomEvent("update-audio", {
      detail: eventData,
      bubbles: true,
      composed: true,
    });
    this.querySelector("synth-waveform").dispatchEvent(updateAudioEvent);
    console.log("Custom event update-audio dispatched.");
  }

  handleImageUploaded(event) {
    const imageData = event.detail;

    const img = new Image();
    img.onload = () => {
      this.image = img;
      this.databender.convert(img)
        .then((buffer) => {
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
          console.log("Custom event update-image dispatched.");
        })
    };
    img.src = imageData;
  }

  createGrains(sample) {
    const grainSize = Math.floor(sample.length / this.numberOfGrains);

    const chunks = chunk(sample.getChannelData(0), grainSize);

    const grains = chunks.map(chunk => {
      const grainBuffer = this.audioCtx.createBuffer(1, chunk.length, this.audioCtx.sampleRate);
      const grainBufferData = grainBuffer.getChannelData(0);

      for (let i = 0; i < chunk.length; i++) {
        grainBufferData[i] = chunk[i]; 
      }

      console.log(grainBuffer.duration);

      return grainBuffer;
    });
    

    return grains;
  }

  updateAudioSelection(e) {
    const { selection, buffer } = e.detail;
    const frameCount = selection.end > selection.start ? selection.end - selection.start : selection.start - selection.end;
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

    this.audioGrains = this.createGrains(this.audioSelection)
  }

  playSynth() {
    let now;
    let then = Date.now();
    let delta;

    const triggerImageGrain = (grainIndex) => {
      console.log(grainIndex, "image grain");
      const interval = (this.imageGrains[grainIndex].duration * 1000) / 20;
      now = Date.now();
      delta = now - then;

      if (delta > interval) {
        const canvas = document.querySelector('synth-display').shadowRoot.querySelector('canvas')
        const context = canvas.getContext('2d');
        // context.clearRect(0, 0, canvas.width, canvas.height);
        this.databender.render(this.imageGrains[grainIndex])
          .then((buffer) => this.databender.draw(buffer, context, 0, 0, 0, 0, this.databender.imageData.width, this.databender.imageData.height/this.numberOfGrains, canvas.width, canvas.height))

        then = now - (delta % interval);

      }

      const randomGrainIndex = Math.floor(Math.random() * this.imageGrains.length);
      this.scheduler = requestAnimationFrame(() => { triggerImageGrain(randomGrainIndex) });
    }

    const triggerAudioGrain = (grainIndex) => {
      const interval = (this.audioGrains[grainIndex].duration * 1000) / 20;
      now = Date.now();
      delta = now - then;

      

      if (delta > interval) {

          if (this.density > 1) {
            for (let i=0; i<=this.density; i++) {

              this.bufferSource = this.audioCtx.createBufferSource();
              const randomGrainIndex = Math.floor(Math.random() * this.audioGrains.length);
              this.bufferSource.buffer = this.audioGrains[randomGrainIndex];
              this.bufferSource.loop = false;
              const gain = this.audioCtx.createGain();
              gain.gain.value = 0.1;
    

            this.bufferSource.connect(gain);

          gain.connect(this.audioCtx.destination);
              }
          } else {
            this.bufferSource = this.audioCtx.createBufferSource();
            const randomGrainIndex = Math.floor(Math.random() * this.audioGrains.length);
            this.bufferSource.buffer = this.audioGrains[randomGrainIndex];
            this.bufferSource.loop = false;
            this.bufferSource.connect(this.audioCtx.destination);

          }
          this.bufferSource.onended = () => {
            this.bufferSource.stop();
            this.bufferSource.disconnect();
          }
          this.bufferSource.start(0);

        then = now - (delta % interval);

      }

      const randomGrainIndex = Math.floor(Math.random() * this.audioGrains.length);

      this.scheduler = requestAnimationFrame(() => { triggerAudioGrain(randomGrainIndex) });
    }

    this.scheduler = requestAnimationFrame(() => {

      if (this.imageGrains.length > 0) {
        const randomGrainIndex = Math.floor(Math.random() * this.imageGrains.length);
        triggerImageGrain(randomGrainIndex);
      }


      if (this.audioGrains.length > 0) {
        const randomGrainIndex = Math.floor(Math.random() * this.audioGrains.length);
        triggerAudioGrain(randomGrainIndex);
      }
    });
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
  }
}

customElements.define("synth-brain", SynthBrain);
