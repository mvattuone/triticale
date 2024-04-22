export default class SynthConfig extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <label for="numberOfGrains">Grain Size</label>
      <input type="range" name="numberOfGrains" min="1" max="1000" />
      <label for="density">Grain Density</label>
      <input type="range" name="density" />
    `; 

    const numberOfGrainsInput = this.shadowRoot.querySelector('input[name="numberOfGrains"]');
    const densityInput = this.shadowRoot.querySelector('input[name="density"]');

    numberOfGrainsInput.onchange = (e) => {
      const updateNumberOfGrainsEvent = new CustomEvent("update-number-of-grains", {
        detail: parseInt(e.target.value, 10),
        bubbles: true,
        composed: true,
      });

      document.querySelector("synth-brain").dispatchEvent(updateNumberOfGrainsEvent);
    }

    densityInput.onchange = (e) => {
      const updateNumberOfGrainsEvent = new CustomEvent("update-density", {
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

