export default class FlexBox extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        div {
          display: flex;
          flex-direction: ${this.getAttribute('direction')};
        }
      </style>

      <div><slot></slot></div>
    `;
  }
}

customElements.define("flex-box", FlexBox);
