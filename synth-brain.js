export default class SynthBrain extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.audioCtx = new AudioContext();
    this.shadowRoot.innerHTML = `
      <slot></slot>
    `; 
  }

  connectedCallback() {
    this.addEventListener("image-uploaded", this.handleImageUploaded);
    this.addEventListener("audio-uploaded", this.handleAudioUploaded);
    this.addEventListener("play-synth", this.playSynth);
    this.addEventListener("stop-synth", this.stopSynth);
    console.log("Listener for image-uploaded added successfully.");
  }

  disconnectedCallback() {
    this.removeEventListener("image-uploaded", this.handleImageUploaded);
    this.removeEventListener("audio-uploaded", this.handleAudioUploaded);
    this.removeEventListener("toggle-synth", this.toggleSynth);
    console.log("Listener for image-uploaded removed.");
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

  playSynth(e) {
    const { selection, buffer } = e.detail;
    const frameCount = selection.end - selection.start;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;

    let newBuffer = this.audioCtx.createBuffer(
      numberOfChannels,
      frameCount,
      sampleRate,
    );

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const originalData = buffer.getChannelData(channel);
      const newData = newBuffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        newData[i] = originalData[i + selection.start];
      }
    }

    this.source = this.audioCtx.createBufferSource();
    this.source.buffer = newBuffer;
    this.source.connect(this.audioCtx.destination);

    this.source.start();
  }

  stopSynth() {
    this.source.stop();
  }
}

customElements.define("synth-brain", SynthBrain);
