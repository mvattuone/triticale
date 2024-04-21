export default class SynthConfig extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <input type="range" />
    `; 

    const input = this.shadowRoot.querySelector('input');

    input.onchange = (e) => {
      const updateNumberOfGrainsEvent = new CustomEvent("update-number-of-grains", {
        detail: parseInt(e.target.value, 10),
        bubbles: true,
        composed: true,
      });

      document.querySelector("synth-brain").dispatchEvent(updateNumberOfGrainsEvent);
    }
  }

  connectedCallback() {
  }

  disconnectedCallback() {
  }
}

customElements.define("synth-config", SynthConfig);

