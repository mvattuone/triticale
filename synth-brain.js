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
  }

  disconnectedCallback() {
    this.removeEventListener("image-uploaded", this.handleImageUploaded);
    this.removeEventListener("audio-uploaded", this.handleAudioUploaded);
  handleAudioUploaded(event) {
    const eventData = event.detail;
    const updateAudioEvent = new CustomEvent("update-audio", {
      detail: eventData,
      bubbles: true,
      composed: true,
    });
    this.querySelector("synth-waveform").dispatchEvent(updateAudioEvent);
  }

  handleImageUploaded(event) {
    const eventData = event.detail;
    const updateImageEvent = new CustomEvent("update-image", {
      detail: eventData,
      bubbles: true,
      composed: true,
    });
    this.querySelector("synth-display").dispatchEvent(updateImageEvent);
  }
  }
}

customElements.define("synth-brain", SynthBrain);
