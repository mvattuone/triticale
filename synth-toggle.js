export default class SynthToggle extends HTMLElement {

  constructor() {
    super();

    const inputName = this.getAttribute('name');
    const label = this.getAttribute('label');
    const config = document.querySelector('synth-brain').config;
    let value = config[inputName] || false;

    this.attachShadow({ mode: "open" });


    this.shadowRoot.innerHTML = `
      <div>
        ${label ? '<label for="${inputName}">${label}</label>' : ''}
        <input type="checkbox" name="${inputName}" checked="${value}" />
      </div>
    `;

    this.inputElement = this.shadowRoot.querySelector('input[type="checkbox"]');
    this.handleOnChange = this.handleOnChange.bind(this);
  }

  handleOnChange(e) {
    const { name, value } = e.target;


    const updateConfigEvent = new CustomEvent("update-config", {
      detail: { name, value: parseFloat(value, 10) },
      bubbles: true,
      composed: true,
    });

    document
      .querySelector("synth-brain")
      .dispatchEvent(updateConfigEvent);
  }

  connectedCallback() {
    this.inputElement.addEventListener('input', this.handleOnChange);
  }
}

customElements.define("synth-toggle", SynthToggle);

