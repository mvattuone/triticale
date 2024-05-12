export default class SynthToggle extends HTMLElement {
  constructor() {
    super();

    const inputName = this.getAttribute("name");
    const label = this.getAttribute("label");
    const config = document.querySelector("synth-brain").config;

    let checked;

    if (inputName.includes(".")) {
      const [groupKey, effectKey, valueKey] = inputName.split(".");
      checked = config[groupKey][effectKey][valueKey] || false;
    } else {
      checked = config[inputName] || false;
    }


    this.attachShadow({ mode: "open" });

    this.shadowRoot.innerHTML = `
      ${label ? '<label for="${inputName}">${label}</label>' : ""}
      <input type="checkbox" name="${inputName}" />
    `;

    this.inputElement = this.shadowRoot.querySelector('input[type="checkbox"]');
    this.handleOnChange = this.handleOnChange.bind(this);

    if (checked) {
      this.inputElement.setAttribute('checked', checked); 
    }
  }

  handleOnChange(e) {
    const { name, checked } = e.target;

    const updateConfigEvent = new CustomEvent("update-config", {
      detail: { name, value: checked },
      bubbles: true,
      composed: true,
    });

    document.querySelector("synth-brain").dispatchEvent(updateConfigEvent);
  }

  connectedCallback() {
    this.inputElement.addEventListener("input", this.handleOnChange);
  }
}

customElements.define("synth-toggle", SynthToggle);
