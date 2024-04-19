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
  }

  disconnectedCallback() {
    this.removeEventListener("image-uploaded", this.handleImageUploaded);
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
