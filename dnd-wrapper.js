import { ensureBoxSizing } from 'helpers/boxSizing.js';

export default class DndWrapper extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
            <style>
                ::slotted(.dropping) {
                  background-color: #efefef;
                }

          
            </style>
            <slot></slot>
        `;

    ensureBoxSizing(this.shadowRoot);

    this.dropzone = this.shadowRoot.querySelector("slot").assignedElements()[0];
    this.dropzone.ondragover = this.handleDragOver.bind(this);
    this.dropzone.ondragleave = this.handleDragLeave.bind(this);
    this.dropzone.ondrop = this.handleDrop.bind(this);
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    this.dropzone.classList.add("dropping");
  }

  handleDragLeave(e) {
    e.preventDefault();
    this.dropzone.classList.remove("dropping");
  }

  handleDrop(e) {
    e.preventDefault();
    this.dropzone.classList.remove("dropping");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.dropzone.dispatchEvent(
        new CustomEvent("drop-success", {
          detail: { file: files[0] },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }
}

customElements.define("dnd-wrapper", DndWrapper);
