export default class SynthSlider extends HTMLElement {
  constructor() {
    super();

    const inputName = this.getAttribute('name');
    const min = this.getAttribute('min');
    const max = this.getAttribute('max');
    const label = this.getAttribute('label');
    const config = document.querySelector('synth-brain').config;
    let value = config[inputName] || 0;

    this.attachShadow({ mode: "open" });


    this.shadowRoot.innerHTML = `
      <div>
        <label for="${inputName}">${label}</label>
        <input type="range" name="${inputName}" min="${min}" max="${max}" value="${value}" />
        <span>${value}</span>
      </div>
    `;

    this.displayValue = this.shadowRoot.querySelector('span');
    this.inputElement = this.shadowRoot.querySelector('input[type="range"]');
    this.handleOnChange = this.handleOnChange.bind(this);
  }

  handleOnChange(e) {
    const { name, value } = e.target;


    const updateConfigEvent = new CustomEvent("update-config", {
      detail: { name, value: parseInt(value, 10) },
      bubbles: true,
      composed: true,
    });

    document
      .querySelector("synth-brain")
      .dispatchEvent(updateConfigEvent);

    this.displayValue.innerText = value;
  }

  connectedCallback() {
    this.inputElement.addEventListener('input', this.handleOnChange);
  }

  disconnectedCallback() {}
}

customElements.define("synth-slider", SynthSlider);
