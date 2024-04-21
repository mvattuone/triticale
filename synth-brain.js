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
    this.numberOfGrains = 2;
    this.shadowRoot.innerHTML = `
      <slot></slot>
    `; 
    this.bufferSource;
  }

  connectedCallback() {
    this.addEventListener("image-uploaded", this.handleImageUploaded);
    this.addEventListener("audio-uploaded", this.handleAudioUploaded);
    this.addEventListener("update-sample", this.updateSample);
    this.addEventListener("play-synth", this.playSynth);
    this.addEventListener("stop-synth", this.stopSynth);
    this.addEventListener("update-number-of-grains", this.updateNumberOfGrains);
    console.log("Listener for image-uploaded added successfully.");
  }

  disconnectedCallback() {
    this.removeEventListener("image-uploaded", this.handleImageUploaded);
    this.removeEventListener("audio-uploaded", this.handleAudioUploaded);
    this.removeEventListener("update-sample", this.updateSample);
    this.removeEventListener("play-synth", this.playSynth);
    this.removeEventListener("stop-synth", this.stopSynth);
    this.removeEventListener("update-number-of-grains", this.updateNumberOfGrains);
    console.log("Listener for image-uploaded removed.");
  }

  updateNumberOfGrains(e) {
    this.numberOfGrains = e.detail;

    if (this.sample) {
      this.grains = this.createGrains();
    }
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
    const eventData = event.detail;
    const updateImageEvent = new CustomEvent("update-image", {
      detail: eventData,
      bubbles: true,
      composed: true,
    });
    this.querySelector("synth-display").dispatchEvent(updateImageEvent);
    console.log("Custom event update-image dispatched.");
  }

  createGrains() {
    const grainSize = Math.floor(this.sample.length / this.numberOfGrains);

    const chunks = chunk(this.sample.getChannelData(0), grainSize);

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

  updateSample(e) {
    const { selection, buffer } = e.detail;
    const frameCount = selection.end > selection.start ? selection.end - selection.start : selection.start - selection.end;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;

    this.sample = this.audioCtx.createBuffer(
      numberOfChannels,
      frameCount,
      sampleRate,
    );

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const originalData = buffer.getChannelData(channel);
      const newData = this.sample.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        newData[i] = originalData[i + selection.start];
      }
    }
  }

  playSynth() {
    let now;
    let then = Date.now();
    let delta;

    const triggerGrain = (grainIndex) => {
      const interval = (this.grains[grainIndex].duration * 1000) / 60;
      now = Date.now();
      delta = now - then;

      if (delta > interval) {
        this.bufferSource = this.audioCtx.createBufferSource();
        this.bufferSource.buffer = this.grains[grainIndex];
        this.bufferSource.loop = false;
        this.bufferSource.connect(this.audioCtx.destination);
        this.bufferSource.onended = () => {
          this.bufferSource.stop();
          this.bufferSource.disconnect();
        }
        this.bufferSource.start(0);

        then = now - (delta % interval);

      }

      this.scheduler = requestAnimationFrame(() => { triggerGrain(9) });
    }

    this.scheduler = requestAnimationFrame(() => {
      triggerGrain(9);
    });
  }

  stopSynth() {
    this.bufferSource.stop();
    cancelAnimationFrame(this.scheduler);
  }
}

customElements.define("synth-brain", SynthBrain);
