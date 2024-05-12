export default class SynthSelect extends HTMLElement {
  constructor() {
    super();

    const selectName = this.getAttribute("name");
    const options = this.getAttribute("options");

    this.attachShadow({ mode: "open" });

    this.shadowRoot.innerHTML = `
      <select name="${selectName}">
        ${options.map((option) => `<option value=${option}>${option}</option>`)}
      </select>
    `;

    this.selectElement = this.shadowRoot.querySelector("select");
    this.handleOnChange = this.handleOnChange.bind(this);
  }

  handleOnChange(e) {
    const { name, value } = e.target;

    const updateConfigEvent = new CustomEvent("update-config", {
      detail: { name, value },
      bubbles: true,
      composed: true,
    });

    document.querySelector("synth-brain").dispatchEvent(updateConfigEvent);
  }

  connectedCallback() {
    this.selectElement.addEventListener("change", this.handleOnChange);
  }

  disconnectedCallback() {}
}

customElements.define("synth-select", SynthSelect);
