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
  }

  disconnectedCallback() {
  }

}

customElements.define("synth-brain", SynthBrain);
