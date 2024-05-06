export default class SynthSlider extends HTMLElement {
  static observedAttributes = ["min", "max"];

  constructor() {
    super();

    const inputName = this.getAttribute("name");
    const min = this.getAttribute("min");
    const max = this.getAttribute("max");
    const label = this.getAttribute("label");
    const step = this.getAttribute("step");
    const config = document.querySelector("synth-brain").config;
    let value = config[inputName] || 0;

    this.attachShadow({ mode: "open" });

    this.shadowRoot.innerHTML = `
        <label for="${inputName}">${label}</label>
        <input type="range" name="${inputName}" min="${min}" max="${max}" value="${value}" step="${step}" />
        <span>${value}</span>
    `;

    this.displayValue = this.shadowRoot.querySelector("span");
    this.inputElement = this.shadowRoot.querySelector('input[type="range"]');
    this.handleOnChange = this.handleOnChange.bind(this);
  }

  handleOnChange(e) {
    const { name, value } = e.target;

    const updateConfigEvent = new CustomEvent("update-config", {
      detail: { name, value: parseFloat(value, 10) },
      bubbles: true,
      composed: true,
    });

    document.querySelector("synth-brain").dispatchEvent(updateConfigEvent);

    this.displayValue.innerText = value;
  }

  connectedCallback() {
    this.inputElement.addEventListener("input", this.handleOnChange);
  }

  disconnectedCallback() {}

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "max" && oldValue !== newValue) {
      this.inputElement.setAttribute("max", newValue);
    }
  }
}

customElements.define("synth-slider", SynthSlider);
