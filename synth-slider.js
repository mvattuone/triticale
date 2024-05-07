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
        <style>
         :host  {
           align-items: center;
           display: inline-flex;
           flex-direction: column;
         }

          input[type="range"] {
              appearance: slider-vertical;
              width: 8px;
              height: 100%;
          }

          /* Style the track */
          input[type="range"]::-webkit-slider-runnable-track,
          input[type="range"]::-moz-range-track,
          input[type="range"]::-ms-track {
              background: #ddd; /* Light grey track */
              border-radius: 5px;
          }

          /* Style the thumb */
          input[type="range"]::-webkit-slider-thumb,
          input[type="range"]::-moz-range-thumb,
          input[type="range"]::-ms-thumb {
              -webkit-appearance: none;
              height: 20px;
              width: 20px;
              border-radius: 50%;
              background: black;
              cursor: pointer; /* Makes the thumb appear clickable */
              margin-top: -6px; /* Aligns the thumb with the track */
          }

          /* Add focus styles for accessibility */
          input[type="range"]:focus {
              outline: none;
          }
        </style>
        <span>${value}</span>
        <input type="range" name="${inputName}" min="${min}" max="${max}" value="${value}" step="${step}" />
        <label for="${inputName}">${label}</label>
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
